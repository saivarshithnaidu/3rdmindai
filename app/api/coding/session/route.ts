import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import codingAgentService from '../../../../services/coding-agent.service';
import { Client } from '@upstash/qstash';

const qstashToken = process.env.QSTASH_TOKEN || '';
const qstashClient = new Client({ token: qstashToken });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      description,
      mode,
      language: reqLang,
      framework: reqFramework,
      projectId,
      userId
    } = body;

    if (!projectId || !description || !mode) {
      return NextResponse.json({ error: 'Missing required fields: projectId, description, mode' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    // 1. Detect language/framework if not specified
    let language = reqLang || 'typescript';
    let framework = reqFramework || null;
    let stack = [language];
    if (framework) stack.push(framework);

    if (mode === 'build' && (!reqLang || !reqFramework)) {
      try {
        const detection = await codingAgentService.detectLanguageAndFramework(description);
        language = reqLang || detection.language;
        framework = reqFramework || detection.framework;
        stack = detection.suggestedStack || [language];
      } catch (err) {
        console.warn('Language detection failed, using defaults:', err);
      }
    }

    // 2. Create session in DB
    const { data: session, error: sessionErr } = await supabase
      .from('coding_sessions')
      .insert({
        project_id: projectId,
        user_id: userId || '00000000-0000-0000-0000-000000000000',
        mode,
        language,
        framework,
        description,
        status: 'running'
      })
      .select()
      .single();

    if (sessionErr || !session) {
      throw new Error(`Failed to create session: ${sessionErr?.message}`);
    }

    let plan: any = null;

    if (mode === 'build') {
      // 3. Plan project architecture
      try {
        plan = await codingAgentService.planProject(description, stack, session.id);
      } catch (err: any) {
        console.error('Planning project failed:', err);
        await supabase
          .from('coding_sessions')
          .update({ status: 'failed' })
          .eq('id', session.id);
        return NextResponse.json({ error: `Planning failed: ${err.message}` }, { status: 500 });
      }

      // Check complexity: if >= 4 files, spawn Code Team
      const isComplex = plan?.files?.length >= 4;
      const appUrl = process.env.APP_URL || 'http://localhost:3000';

      if (isComplex) {
        try {
          const { default: codeTeamService } = await import('../../../../services/code-team.service');
          const teamConfig = await codeTeamService.assembleCodeTeam(description, projectId, session.id);

          // Trigger team execution pipeline asynchronously
          const executeUrl = `${appUrl}/api/coding/team/run`;

          if (!qstashToken || qstashToken.startsWith('mock_')) {
            console.warn('[QStash simulator] Queuing coding team run locally.');
            setTimeout(async () => {
              try {
                const targetUrl = `${appUrl.startsWith('https://3rdmind.ai') ? 'http://localhost:3000' : appUrl}/api/coding/team/run`;
                await fetch(targetUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ teamId: teamConfig.teamId, projectId })
                });
              } catch (e) {
                console.error('Local team run fetch failed:', e);
              }
            }, 100);
          } else {
            await qstashClient.publishJSON({
              url: executeUrl,
              body: { teamId: teamConfig.teamId, projectId },
              retries: 2
            });
          }

          return NextResponse.json({ success: true, sessionId: session.id, plan, teamAssembled: true });
        } catch (teamErr) {
          console.error('Failed to assemble/run code team, falling back to single agent:', teamErr);
        }
      }

      // 4. Queue building task (QStash or fallback)
      const executeUrl = `${appUrl}/api/coding/build`;

      if (!qstashToken || qstashToken.startsWith('mock_')) {
        console.warn('[QStash simulator] Queuing coding build locally.');
        setTimeout(async () => {
          try {
            const targetUrl = `${appUrl.startsWith('https://3rdmind.ai') ? 'http://localhost:3000' : appUrl}/api/coding/build`;
            await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: session.id, plan, stack, description })
            });
          } catch (e) {
            console.error('Local build fetch failed:', e);
          }
        }, 100);
      } else {
        try {
          await qstashClient.publishJSON({
            url: executeUrl,
            body: { sessionId: session.id, plan, stack, description },
            retries: 2
          });
        } catch (qstashErr) {
          console.error('Failed to publish QStash build event, falling back to local trigger:', qstashErr);
          setTimeout(async () => {
            try {
              const targetUrl = `${appUrl.startsWith('https://3rdmind.ai') ? 'http://localhost:3000' : appUrl}/api/coding/build`;
              await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session.id, plan, stack, description })
              });
            } catch (e) {
              console.error('Local build fallback failed:', e);
            }
          }, 100);
        }
      }
    } else {
      // In modes other than build, set status to complete or ready
      await supabase
        .from('coding_sessions')
        .update({ status: 'complete' })
        .eq('id', session.id);
    }

    return NextResponse.json({ success: true, sessionId: session.id, plan });
  } catch (err: any) {
    console.error('Create coding session endpoint failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
