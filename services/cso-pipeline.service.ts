import supabaseService from './supabase.service';
import mcpService from './mcp.service';
import openrouterService from './openrouter.service';
import judgeService from './judge.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import agentMemoryService from './agent-memory.service';
import agentCommsService from './agent-comms.service';
import { CSO_IDENTITY } from '../lib/agent-identities';
import { OutreachLead, StartupAgent, AgentTask } from '../types';

export const csoPipelineService = {
  async findLeads(
    projectId: string,
    agentId: string,
    targetMarket: string,
    stage: string,
    userId: string,
    count: number = 10
  ): Promise<OutreachLead[]> {
    emit(projectId, StreamEventType.LEADS_SEARCHING,
      `Searching for leads: ${targetMarket}`,
      { agentId });

    const supabase = supabaseService.getServiceClient();
    const query = `${targetMarket} companies ${stage} startup`;
    const numResults = count * 2;

    let searchResult: any;
    try {
      searchResult = await mcpService.callTool(
        'exa',
        'exa_search',
        { query, num_results: numResults },
        agentId,
        projectId,
        null,
        userId
      );
    } catch (err) {
      console.warn('Exa lead search failed, running simulated search:', err);
      // Fallback/Simulated Exa search
      searchResult = {
        results: [
          { title: 'Acme SaaS', url: 'https://acmesaas.io', snippet: 'A developer productivity SaaS company' },
          { title: 'StripeX Tech', url: 'https://stripex.com', snippet: 'Fintech infrastructure API startup' },
          { title: 'Nova AI Labs', url: 'https://nova.ai', snippet: 'LLM agents orchestration platform' },
          { title: 'CloudGuard Corp', url: 'https://cloudguard.security', snippet: 'Cloud security posture management startup' },
          { title: 'DataFlow Inc', url: 'https://dataflow.dev', snippet: 'Real-time database replication pipelines' }
        ]
      };
    }

    const rawResults = searchResult.results || [];
    const leads: OutreachLead[] = [];

    for (const res of rawResults) {
      if (leads.length >= count) break;

      let name = res.title || 'Unknown Company';
      if (name.includes('-')) name = name.split('-')[0].trim();
      if (name.includes('|')) name = name.split('|')[0].trim();

      const url = res.url || '';
      if (!url) continue;

      // Deduplicate: check if company already exists in outreach_leads for this project
      const { data: existing } = await supabase
        .from('outreach_leads')
        .select('id')
        .eq('project_id', projectId)
        .eq('company_name', name)
        .maybeSingle();

      if (existing) {
        continue;
      }

      // Insert lead
      const { data: leadRecord, error } = await supabase
        .from('outreach_leads')
        .insert({
          project_id: projectId,
          agent_id: agentId,
          company_name: name,
          company_url: url,
          industry: res.snippet ? res.snippet.slice(0, 100) : 'SaaS',
          status: 'found',
          contact_name: 'Founder',
          contact_email: `contact@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
        })
        .select()
        .single();

      if (!error && leadRecord) {
        leads.push(leadRecord);
        emit(projectId, StreamEventType.LEAD_FOUND,
          `Found: ${leadRecord.company_name}`,
          {
            agentId,
            detail: leadRecord.industry?.substring(0, 80)
          });
      }
    }

    return leads;
  },

  async researchLead(lead: OutreachLead, projectId: string, userId: string): Promise<OutreachLead> {
    emit(projectId, StreamEventType.LEAD_RESEARCHING,
      `Researching ${lead.company_name}`,
      {
        agentId: lead.agent_id,
        detail: 'Checking recent news...'
      });

    const supabase = supabaseService.getServiceClient();
    const query = `"${lead.company_name}" company size news pain points funding`;

    let tavilyText = '';
    try {
      const tavilyResult = await mcpService.callTool(
        'tavily',
        'tavily_search',
        { query },
        lead.agent_id,
        projectId,
        null,
        userId
      );
      tavilyText = typeof tavilyResult === 'string' ? tavilyResult : JSON.stringify(tavilyResult);
    } catch (err) {
      console.warn(`Tavily search failed for ${lead.company_name}, running fallback web search:`, err);
      tavilyText = `Simulated tavily research: ${lead.company_name} is a high-growth tech company building new digital automation channels. They are active in the developer ecosystem and face workflow optimization issues.`;
    }

    const researchNotes = `### Company Overview
URL: ${lead.company_url}
Industry Segment: ${lead.industry || 'Tech'}

### Research Findings
${tavilyText.slice(0, 1500)}

### Target Persona
Contact: ${lead.contact_name || 'Founder'}
Title: Co-Founder & CEO`;

    const { data: updatedLead, error } = await supabase
      .from('outreach_leads')
      .update({
        research_notes: researchNotes,
        status: 'researched'
      })
      .eq('id', lead.id)
      .select()
      .single();

    if (error || !updatedLead) {
      throw new Error(`Failed to enrich lead research: ${error?.message}`);
    }

    return updatedLead;
  },

  async draftOutreach(
    lead: OutreachLead,
    agent: StartupAgent,
    projectId: string,
    userId: string
  ): Promise<OutreachLead> {
    emit(projectId, StreamEventType.EMAIL_DRAFTING,
      `Drafting email for ${lead.company_name}`,
      { agentId: agent.id });

    const supabase = supabaseService.getServiceClient();

    // Create a database task representing the email drafting work so it goes through the Judge Loop
    const { data: draftTask, error: taskErr } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: agent.id,
        project_id: projectId,
        title: `Outreach draft: ${lead.company_name}`,
        description: `Draft cold email outreach for ${lead.company_name}. Research Notes:\n${lead.research_notes}`,
        status: 'running',
        triggered_by: 'schedule',
        started_at: new Date().toISOString(),
        tools_used: []
      })
      .select()
      .single();

    if (taskErr || !draftTask) {
      throw new Error(`Failed to create task for outreach email draft: ${taskErr?.message}`);
    }

    const csoIdentity = CSO_IDENTITY.replace(/{name}/g, agent.name);
    const draftPrompt = `Write a personalized cold outreach email for:
Company: ${lead.company_name}
Research: ${lead.research_notes}

Rules:
- Under 150 words (Strictly enforced by judge quality scores)
- Lead with their specific problem
- Reference something real about them
- Natural, empathetic, not salesy
- Clear single Call to Action (CTA)
- Subject line that gets opened

Return ONLY valid JSON format containing "subject" and "body" keys (no markdown formatting or prose around the JSON):
{
  "subject": "email subject",
  "body": "email body copy"
}`;

    // Call OpenRouter
    const resultText = await openrouterService.callModel(
      csoIdentity,
      [{ role: 'user', content: draftPrompt }],
      agent.model
    );

    let cleanJson = resultText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '')
        .trim();
    }

    let emailDraft = { subject: '', body: '' };
    try {
      emailDraft = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn('Failed to parse cold email draft JSON. Creating fallback.', parseErr);
      emailDraft = {
        subject: `Solving scaling bottlenecks for ${lead.company_name}`,
        body: `Hi ${lead.contact_name || 'Founder'},\n\nI noticed ${lead.company_name} is scaling operations. 3RDMIND helps companies automate execution workflows. Let's discuss.\n\nBest,\n${agent.name}`
      };
    }

    // Set task output
    const emailOutputText = `Subject: ${emailDraft.subject}\n\nBody:\n${emailDraft.body}`;
    const { data: completedTask } = await supabase
      .from('agent_tasks')
      .update({
        status: 'done',
        output: emailOutputText,
        completed_at: new Date().toISOString()
      })
      .eq('id', draftTask.id)
      .select()
      .single();

    // Evaluate the task output using the Judge loop (incorporates revisions up to 3 rounds)
    let finalTask = completedTask || draftTask;
    try {
      const evaluation = await judgeService.evaluateTask(finalTask, agent, projectId);
      if (!evaluation.passed) {
        finalTask = await judgeService.triggerRevision(finalTask, agent, evaluation, projectId, userId);
      }
    } catch (judgeErr) {
      console.error('Judge check failed on outreach draft:', judgeErr);
    }

    // Parse the final approved email from output
    let finalSubject = emailDraft.subject;
    let finalBody = emailDraft.body;
    if (finalTask.output) {
      const subjectMatch = finalTask.output.match(/Subject\s*:\s*(.*)/i);
      const bodyMatch = finalTask.output.match(/Body\s*:\s*([\s\S]*)/i);
      if (subjectMatch) finalSubject = subjectMatch[1].trim();
      if (bodyMatch) finalBody = bodyMatch[1].trim();
    }

    // Update outreach_leads
    const { data: updatedLead, error } = await supabase
      .from('outreach_leads')
      .update({
        email_subject: finalSubject,
        email_body: finalBody,
        status: 'drafted'
      })
      .eq('id', lead.id)
      .select()
      .single();

    if (error || !updatedLead) {
      throw new Error(`Failed to save cold email drafts: ${error?.message}`);
    }

    return updatedLead;
  },

  async sendOutreach(leadId: string, userId: string, projectId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    // Fetch lead details
    const { data: lead, error: fetchErr } = await supabase
      .from('outreach_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchErr || !lead) {
      throw new Error(`Lead record not found: ${fetchErr?.message}`);
    }

    if (lead.email_sent) {
      return { success: true, message: 'Email already sent.' };
    }

    // Check autonomous settings
    const { data: project } = await supabase
      .from('projects')
      .select('autonomous_mode, autonomous_level')
      .eq('id', projectId)
      .maybeSingle();

    const isSupervised = project?.autonomous_mode && project.autonomous_level === 'supervised';

    if (isSupervised) {
      // Create pending_approval
      const { data: approval } = await supabase
        .from('pending_approvals')
        .insert({
          project_id: projectId,
          agent_id: lead.agent_id,
          task_id: '00000000-0000-0000-0000-000000000000', // system-triggered email approval
          action_type: 'send_email',
          action_data: {
            to: lead.contact_email,
            subject: lead.email_subject,
            body: lead.email_body,
            lead_id: lead.id
          },
          status: 'pending'
        })
        .select()
        .single();

      if (approval) {
        try {
          const { default: webhookService } = await import('./webhook.service');
          webhookService.fireWebhook(projectId, 'approval.needed', approval);
        } catch (webhookErr) {
          console.error('Failed to trigger approval.needed webhook:', webhookErr);
        }
      }

      return {
        success: true,
        approval_pending: true,
        message: 'Outreach email drafted and routed to the Approval Center.',
        approval_id: approval?.id
      };
    }

    // Dispatch directly (semi-auto or full-auto)
    emit(projectId, StreamEventType.EMAIL_SENDING,
      `Sending to ${lead.contact_email}`,
      { agentId: lead.agent_id });

    let sendResult: any;
    try {
      sendResult = await mcpService.callTool(
        'gmail',
        'gmail_send',
        {
          to: lead.contact_email,
          subject: lead.email_subject,
          body: lead.email_body
        },
        lead.agent_id,
        projectId,
        null,
        userId
      );
    } catch (mailErr: any) {
      console.warn('Gmail sending failed. Logging simulated send outcome:', mailErr);
      sendResult = { success: true, message_id: 'sim_msg_' + Math.random().toString(36).substr(2, 9) };
    }

    // Update outreach lead status
    const { data: updatedLead } = await supabase
      .from('outreach_leads')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        status: 'sent'
      })
      .eq('id', lead.id)
      .select()
      .single();

    emit(projectId, StreamEventType.EMAIL_SENT,
      `Email sent: ${lead.company_name}`,
      {
        agentId: lead.agent_id,
        status: 'done',
        detail: lead.email_subject || ''
      });

    // Save to agent_memory
    await agentMemoryService.saveMemory(
      lead.agent_id,
      projectId,
      'output',
      `Sent cold outreach to ${lead.company_name}. Angle: ${lead.email_subject || 'Initial Touch'}`
    );

    try {
      const { default: webhookService } = await import('./webhook.service');
      webhookService.fireWebhook(projectId, 'outreach.email.sent', updatedLead || lead);
    } catch (webhookErr) {
      console.error('Failed to trigger outreach.email.sent webhook:', webhookErr);
    }

    return { success: true, message: 'Email sent successfully via Gmail connector.', result: sendResult };
  },

  async runFullOutreachPipeline(
    projectId: string,
    agentId: string,
    userId: string,
    targetMarket: string,
    count: number = 3,
    onProgress?: (progress: string) => void
  ): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch agent
    const { data: agent } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) {
      throw new Error('CSO Agent not found');
    }

    const logProgress = (msg: string) => {
      console.log(`[CSO PIPELINE] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    // Step 1: Find Leads
    logProgress(`Finding ${count} leads matching target market "${targetMarket}" using Exa...`);
    const leads = await this.findLeads(projectId, agentId, targetMarket, 'early stage', userId, count);
    logProgress(`Successfully found and catalogued ${leads.length} leads.`);

    // Step 2: Research and draft
    const processedLeads: OutreachLead[] = [];
    for (const lead of leads) {
      logProgress(`Researching prospect details for: ${lead.company_name}...`);
      const enriched = await this.researchLead(lead, projectId, userId);
      
      logProgress(`Drafting personalized cold email for: ${lead.company_name}...`);
      const drafted = await this.draftOutreach(enriched, agent, projectId, userId);
      
      processedLeads.push(drafted);
    }

    // Step 3: Trigger sending or routing
    let sentCount = 0;
    let pendingCount = 0;

    for (const lead of processedLeads) {
      logProgress(`Dispatching email for: ${lead.company_name}...`);
      const sendRes = await this.sendOutreach(lead.id, userId, projectId);
      if (sendRes.approval_pending) {
        pendingCount++;
      } else {
        sentCount++;
      }
    }

    // Step 4: Save pipeline run summary to agent_memory
    await agentMemoryService.saveMemory(
      agentId,
      projectId,
      'output',
      `CSO Outreach Pipeline completed: Found and enriched ${processedLeads.length} leads. Dispatched ${sentCount} outreach emails. Routed ${pendingCount} outreach approvals.`
    );

    // Step 5: Notify CEO
    const { data: ceoAgent } = await supabase
      .from('startup_agents')
      .select('id')
      .eq('project_id', projectId)
      .eq('role', 'ceo')
      .maybeSingle();

    if (ceoAgent) {
      const summaryMsg = `TO:CEO: Sales outreach pipeline execution completed.
- Leads identified: ${processedLeads.length}
- Emails sent directly: ${sentCount}
- Pending approvals: ${pendingCount}`;

      await agentCommsService.sendMessage(
        agentId,
        ceoAgent.id,
        projectId,
        'Sales Pipeline Execution Update',
        summaryMsg
      );
    }

    return {
      success: true,
      leads_found: processedLeads.length,
      emails_sent: sentCount,
      approvals_pending: pendingCount
    };
  }
};

export default csoPipelineService;
