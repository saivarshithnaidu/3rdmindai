import { NextRequest, NextResponse } from 'next/server';
import projectService from '../../../services/project.service';
import agentService from '../../../services/agent.service';
import orchestratorService from '../../../services/orchestrator.service';
import messageService from '../../../services/message.service';
import supabaseService from '../../../services/supabase.service';
import { DEFAULT_ORCHESTRATOR_MODEL } from '../../../lib/constants';

export async function POST(req: NextRequest) {
  try {
    let { projectId, goal, model, options } = await req.json();

    if (!goal) {
      return NextResponse.json({ error: 'Missing goal' }, { status: 400 });
    }

    let projectObj;
    if (!projectId) {
      // 1. Create project in the database (this also spawns the initial orchestrator agent)
      projectObj = await projectService.createProject(goal);
      projectId = projectObj.id;
      
      // If masterResume is provided, save it to the newly created project
      if (options?.masterResume) {
        projectObj = await projectService.updateProject(projectId, {
          master_resume: options.masterResume,
          master_resume_filename: options.filename || null,
        });
      }
    } else {
      // Fetch project to make sure it exists
      projectObj = await projectService.getProject(projectId);
    }

    const agentsList = await agentService.getProjectAgents(projectId);
    let orchestrator = agentsList.find((a) => a.type === 'orchestrator');

    if (!orchestrator) {
      // If orchestrator is not found, create it
      orchestrator = await agentService.createAgent(
        projectId,
        '3RDMIND',
        'Orchestrator',
        goal,
        'orchestrator',
        model || DEFAULT_ORCHESTRATOR_MODEL,
        null,
        1,
        'manager',
        8000
      );
    } else {
      // Ensure budget and settings are correct for the run
      await agentService.updateAgent(orchestrator.id, {
        token_budget: 8000,
        agent_mode: 'manager',
        depth: 1,
        status: 'running'
      });
    }

    const selectedModel = model || orchestrator.model || DEFAULT_ORCHESTRATOR_MODEL;

    // 1. Plan L2 managers synchronously so we can return them
    const plan = await orchestratorService.planManagerAgents(goal, selectedModel, projectId, options);

    if (plan.managers && plan.managers.length > 0) {
      // Save plan message in orchestrator chat
      await messageService.saveMessage(
        orchestrator.id,
        projectId,
        'assistant',
        `**Workflow Plan Created**\n\n${plan.summary}\n\nSpawning ${plan.managers.length} L2 Manager agents.`
      );

      // 2. Spawn L2 manager agents
      const spawnedManagers = [];
      for (const managerPlan of plan.managers) {
        let managerName = managerPlan.name;
        let managerTask = managerPlan.task;
        if (options?.councilMode) {
          if (!managerName.toLowerCase().includes('council')) {
            managerName = `${managerName} Council`;
          }
          if (!managerTask.toLowerCase().includes('debate')) {
            managerTask = `[AI Council Mode Active] Convene a multi-model debate/consensus panel. ${managerTask}`;
          }
        }

        const managerAgent = await agentService.createAgent(
          projectId,
          managerName,
          managerPlan.role,
          managerTask,
          'subagent',
          selectedModel,
          orchestrator.id,
          2, // L2 Depth
          'executor', // Initially set to executor, decisions will toggle
          4000 // Manager budget
        );
        spawnedManagers.push(managerAgent);
      }

      // 3. Dispatch each L2 manager agent in parallel asynchronously
      Promise.all(
        spawnedManagers.map((manager) => orchestratorService.dispatchManager(manager, projectId, selectedModel))
      ).catch((err) => {
        console.error(`Error in dispatching L2 managers for project ${projectId}:`, err);
      });

      return NextResponse.json({
        ...projectObj,
        orchestratorId: orchestrator.id,
        managersPlanned: plan.managers.map(m => m.name)
      }, { status: 200 });
    } else {
      // No L2 managers planned (e.g. casual hello / chat)
      const supabase = supabaseService.getServiceClient();
      const { data: thinkingMsgs } = await supabase
        .from('messages')
        .select('*')
        .eq('agent_id', orchestrator.id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      if (thinkingMsgs && thinkingMsgs.length > 0) {
        await supabase
          .from('messages')
          .update({ content: plan.summary })
          .eq('id', thinkingMsgs[0].id);
      } else {
        await messageService.saveMessage(
          orchestrator.id,
          projectId,
          'assistant',
          plan.summary
        );
      }

      await agentService.updateAgentStatus(orchestrator.id, 'done');

      return NextResponse.json({
        ...projectObj,
        orchestratorId: orchestrator.id,
        managersPlanned: []
      }, { status: 200 });
    }

  } catch (e) {
    console.error('Error starting orchestration:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
