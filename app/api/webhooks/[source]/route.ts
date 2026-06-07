import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import supabaseService from '../../../../services/supabase.service';
import agentRuntimeService from '../../../../services/agent-runtime.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId query parameter' }, { status: 400 });
  }

  const rawBody = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = supabaseService.getServiceClient();

  try {
    // 1. Fetch webhook config for this source and project
    const { data: config, error: configErr } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('project_id', projectId)
      .eq('direction', 'inbound')
      .eq('source', source)
      .eq('is_active', true)
      .maybeSingle();

    if (configErr || !config) {
      return NextResponse.json({ error: 'No active inbound webhook configuration found for this source' }, { status: 404 });
    }

    const secret = config.secret;

    // 2. Verify signature per source
    let verified = false;

    if (source === 'stripe') {
      const signatureHeader = req.headers.get('stripe-signature') || '';
      const parts = signatureHeader.split(',');
      const tPart = parts.find((p) => p.trim().startsWith('t='));
      const v1Part = parts.find((p) => p.trim().startsWith('v1='));

      if (tPart && v1Part) {
        const t = tPart.split('=')[1];
        const v1 = v1Part.split('=')[1];
        const computed = crypto
          .createHmac('sha256', secret)
          .update(`${t}.${rawBody}`)
          .digest('hex');

        if (computed === v1) {
          verified = true;
        }
      }
    } else if (source === 'github') {
      const signatureHeader = req.headers.get('x-hub-signature-256') || '';
      const signature = signatureHeader.startsWith('sha256=')
        ? signatureHeader.substring(7)
        : signatureHeader;

      const computed = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (computed === signature) {
        verified = true;
      }
    } else if (source === 'typeform') {
      const signatureHeader = req.headers.get('typeform-signature') || '';
      const signature = signatureHeader.startsWith('sha256=')
        ? signatureHeader.substring(7)
        : signatureHeader;

      const computed = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (computed === signature) {
        verified = true;
      }
    } else if (source === 'custom') {
      const secretHeader = req.headers.get('x-webhook-secret') || '';
      if (secretHeader === secret) {
        verified = true;
      }
    }

    if (!verified) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // 3. Parse event and payload into agent task parameters
    let taskDescription = '';
    let agentRole = config.agent_role || 'ceo';
    let taskTitle = `Webhook Trigger: ${source.toUpperCase()}`;

    if (source === 'stripe') {
      const eventType = payload.type;
      if (eventType === 'checkout.session.completed') {
        const session = payload.data?.object || {};
        const name = session.customer_details?.name || session.name || 'Valued Customer';
        const company = session.customer_details?.company || session.company || 'Unknown Company';
        taskDescription = `New customer ${name} from ${company}. Research them and send personalized onboarding outreach.`;
        agentRole = config.agent_role || 'cso';
        taskTitle = `Stripe Sale: ${company}`;
      } else {
        taskDescription = `Stripe Event: ${eventType}. Payload details:\n${JSON.stringify(payload)}`;
      }
    } else if (source === 'github') {
      const issue = payload.issue || {};
      const number = issue.number || '0';
      const title = issue.title || 'Untitled';
      const body = issue.body || 'No description provided';
      taskDescription = `New GitHub issue #${number}: ${title}.\n\n${body}.\n\nSuggest solution approach.`;
      agentRole = config.agent_role || 'cto';
      taskTitle = `GitHub Issue #${number}`;
    } else if (source === 'typeform') {
      const formResponse = payload.form_response || {};
      const answers = formResponse.answers || [];
      const summary = answers
        .map((a: any) => {
          const val = a.text || a.number || a.email || a.choice?.label || JSON.stringify(a);
          return `- Question Ref: ${a.field?.ref || a.field?.id || 'Q'}\n  Answer: ${val}`;
        })
        .join('\n');
      taskDescription = `New Typeform Submission:\n${summary}`;
      agentRole = config.agent_role || 'ceo';
      taskTitle = 'Typeform Submission';
    } else {
      // Custom inbound mapping
      agentRole = payload.agentRole || config.agent_role || 'ceo';
      taskDescription = payload.task || JSON.stringify(payload);
      taskTitle = payload.title || 'Custom Webhook Event';
    }

    // Prepend task prefix if configured
    if (config.task_prefix) {
      taskDescription = `${config.task_prefix}\n${taskDescription}`;
    }

    // 4. Find active agent in the project with this role
    const { data: agent, error: agentErr } = await supabase
      .from('startup_agents')
      .select('id')
      .eq('project_id', projectId)
      .eq('role', agentRole.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (agentErr || !agent) {
      return NextResponse.json({
        success: false,
        error: `No active agent found for role ${agentRole.toUpperCase()} in project ${projectId}`
      }, { status: 400 });
    }

    // 5. Queue task asynchronously (without awaiting execution)
    // We execute queueTask, which runs the runtime in the background and returns immediately
    const queuedTask = await agentRuntimeService.queueTask(
      agent.id,
      projectId,
      taskTitle,
      taskDescription,
      'user'
    );

    // Return 200 immediately
    return NextResponse.json({
      success: true,
      taskId: queuedTask.id,
      status: 'queued',
      message: `Task successfully queued for agent ${agentRole.toUpperCase()}`
    }, { status: 200 });

  } catch (err: any) {
    console.error('Inbound webhook execution failure:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
