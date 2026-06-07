import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import autonomousService from '../../../../services/autonomous.service';
import { queueAgentTask, qstashClient } from '../../../../lib/qstash';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  
  // Auth checks
  const authHeader = req.headers.get('Authorization');
  const customSecret = req.headers.get('x-cron-secret');
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('cron_secret');

  const isAuthorized = 
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && customSecret === cronSecret) ||
    (cronSecret && querySecret === cronSecret) ||
    (process.env.NODE_ENV === 'development') ||
    (!cronSecret); // Allow if not configured yet

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let trigger: string;
  try {
    const body = await req.json();
    trigger = body.trigger;
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!trigger) {
    return NextResponse.json({ error: 'Missing trigger parameter' }, { status: 400 });
  }

  const supabase = supabaseService.getServiceClient();
  let triggeredCount = 0;

  try {
    switch (trigger) {
      case 'weekly_run': {
        // Fetch all projects where autonomous_mode is true
        const { data: projects, error } = await supabase
          .from('projects')
          .select('id')
          .eq('autonomous_mode', true);

        if (error) throw error;
        if (!projects || projects.length === 0) break;

        const projectIds = projects.map((p) => p.id);

        // Fetch active agents in those projects
        const { data: agents, error: agentsErr } = await supabase
          .from('startup_agents')
          .select('*')
          .eq('is_active', true)
          .in('project_id', projectIds);

        if (agentsErr) throw agentsErr;
        if (!agents || agents.length === 0) break;

        // Queue task in QStash for each agent
        for (const agent of agents) {
          const taskDescription = agent.role === 'ceo'
            ? 'Review all agent outputs from last week. Set top 3 priorities for this week. Send specific task instructions to each team member using TO:{role}: format.'
            : autonomousService.getDefaultTaskForRole(agent.role);

          await queueAgentTask(
            agent.id,
            agent.project_id,
            taskDescription,
            'schedule'
          );
          triggeredCount++;
        }
        break;
      }

      case 'check_schedules': {
        // Fetch due schedules
        const { data: schedules, error } = await supabase
          .from('agent_schedules')
          .select('*')
          .eq('is_active', true)
          .lte('next_trigger', new Date().toISOString());

        if (error) throw error;
        if (!schedules || schedules.length === 0) break;

        const { getNextTriggerTime } = await import('../../../../services/agent-schedule.service');

        for (const sched of schedules) {
          await queueAgentTask(
            sched.agent_id,
            sched.project_id,
            sched.task_template,
            'schedule'
          );

          const nextTrigger = getNextTriggerTime(sched.cron_expression);

          await supabase
            .from('agent_schedules')
            .update({
              last_triggered: new Date().toISOString(),
              next_trigger: nextTrigger,
            })
            .eq('id', sched.id);

          triggeredCount++;
        }
        break;
      }

      case 'daily_cso': {
        // Fetch all autonomous projects
        const { data: projects, error } = await supabase
          .from('projects')
          .select('id')
          .eq('autonomous_mode', true);

        if (error) throw error;
        if (!projects || projects.length === 0) break;

        const projectIds = projects.map((p) => p.id);

        // Fetch active CSO agents
        const { data: agents, error: agentsErr } = await supabase
          .from('startup_agents')
          .select('id, project_id')
          .eq('role', 'cso')
          .eq('is_active', true)
          .in('project_id', projectIds);

        if (agentsErr) throw agentsErr;
        if (!agents || agents.length === 0) break;

        const taskDescription = 'Find 5 new leads matching ICP. Research each. Draft personalized emails. Send if auto-mode active.';

        for (const agent of agents) {
          await queueAgentTask(
            agent.id,
            agent.project_id,
            taskDescription,
            'schedule'
          );
          triggeredCount++;
        }
        break;
      }

      case 'weekly_digest': {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Fetch completed runs from the last week
        const { data: runs, error } = await supabase
          .from('autonomous_runs')
          .select('id, project_id')
          .eq('status', 'done')
          .gte('created_at', oneWeekAgo.toISOString());

        if (error) throw error;
        if (!runs || runs.length === 0) break;

        const runIds = runs.map((r) => r.id);

        // Fetch existing digests
        const { data: digests, error: digestsErr } = await supabase
          .from('weekly_digests')
          .select('run_id')
          .in('run_id', runIds);

        if (digestsErr) throw digestsErr;

        const digestedRunIds = new Set((digests || []).map((d) => d.run_id));
        const runsWithoutDigest = runs.filter((r) => !digestedRunIds.has(r.id));

        const appUrl = process.env.APP_URL || 'https://3rdmind.ai';

        for (const run of runsWithoutDigest) {
          if (!process.env.QSTASH_TOKEN || process.env.QSTASH_TOKEN.startsWith('mock_')) {
            // Offline simulator fallback
            setTimeout(async () => {
              try {
                const { default: digestService } = await import('../../../../services/digest.service');
                await digestService.generateWeeklyDigest(run.id, run.project_id);
              } catch (e) {
                console.error('[QStash offline simulator] Digest generation failed:', e);
              }
            }, 100);
          } else {
            // Production QStash publish
            await qstashClient.publishJSON({
              url: `${appUrl}/api/digest/generate`,
              body: {
                runId: run.id,
                projectId: run.project_id,
              },
              retries: 3,
            });
          }
          triggeredCount++;
        }
        break;
      }

      case 'price_watch': {
        const { default: priceWatchService } = await import('../../../../services/price-watch.service');
        triggeredCount = await priceWatchService.checkAllDueWatches();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown trigger type: ${trigger}` }, { status: 400 });
    }

    return NextResponse.json({ triggered: triggeredCount });
  } catch (err: any) {
    console.error('Error executing master cron trigger:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
