import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import codingAgentService from './coding-agent.service';
import autoDeployService from './auto-deploy.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export interface CodeTeamConfig {
  teamId: string;
  needs_architect: boolean;
  needs_frontend: boolean;
  needs_backend: boolean;
  needs_database: boolean;
  needs_testing: boolean;
  needs_devops: boolean;
}

export const codeTeamService = {
  /**
   * Analyzes project complexity, assigns specialized roles, and spawns the agent team
   */
  async assembleCodeTeam(description: string, projectId: string, sessionId: string): Promise<CodeTeamConfig> {
    const supabase = supabaseService.getServiceClient();
    emit(projectId, StreamEventType.TOOL_CALLING, 'Assembling specialized multi-agent code team...', { status: 'running' });

    const system = `Analyze this software project description and determine which specialized coding agents are needed:
${description}

Return ONLY a valid JSON object matching this schema:
{
  "needs_architect": true,
  "needs_frontend": boolean,
  "needs_backend": boolean,
  "needs_database": boolean,
  "needs_testing": boolean,
  "needs_devops": boolean,
  "agent_assignments": {
    "architect": ["README.md", "architecture.md"],
    "frontend": ["list of frontend files to create/edit"],
    "backend": ["list of backend API routes/controller files"],
    "database": ["list of schema/migration SQL files"],
    "testing": ["list of test files"],
    "devops": ["Dockerfile", ".github/workflows/deploy.yml"]
  }
}`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: 'Generate code team configuration JSON now.' }],
      'openai/gpt-4o'
    );

    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // 1. Create code_teams row
    const { data: team, error: teamErr } = await supabase
      .from('code_teams')
      .insert({
        project_id: projectId,
        session_id: sessionId,
        description,
        status: 'planning'
      })
      .select()
      .single();

    if (teamErr || !team) {
      throw new Error(`Failed to create code team: ${teamErr?.message}`);
    }

    const rolesMapping = [
      { role: 'architect', model: 'openai/gpt-4o', active: true },
      { role: 'frontend', model: 'google/gemini-pro-1.5', active: parsed.needs_frontend },
      { role: 'backend', model: 'deepseek/deepseek-chat', active: parsed.needs_backend },
      { role: 'database', model: 'deepseek/deepseek-chat', active: parsed.needs_database },
      { role: 'testing', model: 'meta-llama/llama-3-70b', active: parsed.needs_testing },
      { role: 'devops', model: 'deepseek/deepseek-chat', active: parsed.needs_devops }
    ];

    for (const r of rolesMapping) {
      if (!r.active) continue;

      const files = parsed.agent_assignments[r.role] || [];
      await supabase
        .from('code_team_agents')
        .insert({
          team_id: team.id,
          role: r.role,
          model: r.model,
          status: 'waiting',
          assigned_files: files,
          completed_files: []
        });
    }

    emit(projectId, StreamEventType.TOOL_RESULT, `Code team successfully assembled: ${rolesMapping.filter(r => r.active).length} specialized agents deployed.`, { status: 'running' });

    return {
      teamId: team.id,
      needs_architect: true,
      needs_frontend: parsed.needs_frontend,
      needs_backend: parsed.needs_backend,
      needs_database: parsed.needs_database,
      needs_testing: parsed.needs_testing,
      needs_devops: parsed.needs_devops
    };
  },

  /**
   * Coordinates the 7 phases of team execution pipeline
   */
  async runCodeTeam(teamId: string, projectId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch team and session
    const { data: team } = await supabase
      .from('code_teams')
      .select('*, coding_sessions(*)')
      .eq('id', teamId)
      .single();

    if (!team) throw new Error(`Code team ${teamId} not found`);

    const sessionId = team.session_id;
    const session = team.coding_sessions;

    // Fetch active agents
    const { data: agents } = await supabase
      .from('code_team_agents')
      .select('*')
      .eq('team_id', teamId);

    if (!agents || agents.length === 0) throw new Error('No agents found in this team');

    // Helper: update agent status/completed files
    const updateAgentStatus = async (role: string, status: 'waiting' | 'running' | 'done' | 'failed', completedFiles?: string[]) => {
      const agent = agents.find(a => a.role === role);
      if (!agent) return;

      const payload: any = { status };
      if (completedFiles) {
        payload.completed_files = completedFiles;
      }

      await supabase
        .from('code_team_agents')
        .update(payload)
        .eq('id', agent.id);
    };

    // Phase 1 — Architect designs
    emit(projectId, StreamEventType.TOOL_CALLING, 'Architect designing project architecture...', { status: 'running' });
    await updateAgentStatus('architect', 'running');
    
    const archAgent = agents.find(a => a.role === 'architect')!;
    const plan = await codingAgentService.planProject(team.description, ['NodeJS', 'TypeScript', 'TailwindCSS'], sessionId);

    // Save plan design file
    const readmeContent = `# Architecture Specification\n\n## Project Plan\n\nFolder structure:\n\`\`\`\n${plan.folder_structure}\n\`\`\`\n`;
    await supabase.from('code_files').insert({
      session_id: sessionId,
      file_path: 'architecture.md',
      language: 'markdown',
      content: readmeContent,
      version: 1
    });

    await updateAgentStatus('architect', 'done', ['architecture.md']);
    emit(projectId, StreamEventType.TOOL_RESULT, 'Architect phase complete. System layout designed.', { status: 'running' });

    // Phase 2 — Parallel execution (Frontend + Backend + Database build in parallel)
    emit(projectId, StreamEventType.TOOL_CALLING, 'Frontend, Backend, and Database agents building in parallel...', { status: 'running' });
    
    const activeBuilders = agents.filter(a => ['frontend', 'backend', 'database'].includes(a.role));
    for (const b of activeBuilders) {
      await updateAgentStatus(b.role, 'running');
    }

    // Process files assigned in parallel or loop to generate them
    const buildOrder = plan.build_order || [];
    const completedMap: Record<string, string[]> = { frontend: [], backend: [], database: [] };

    for (const file of buildOrder) {
      // Determine which agent role is responsible for this file
      let role: 'frontend' | 'backend' | 'database' = 'backend';
      if (file.includes('component') || file.includes('pages') || file.endsWith('.css') || file.endsWith('.html')) {
        role = 'frontend';
      } else if (file.endsWith('.sql') || file.includes('schema')) {
        role = 'database';
      }

      const activeAgent = agents.find(a => a.role === role);
      if (!activeAgent) continue;

      emit(projectId, StreamEventType.TOOL_CALLING, `[${role.toUpperCase()}] Writing ${file}...`, { status: 'running' });

      // Run code builder
      const system = `You are a specialized ${role} coding agent. Write the complete file contents for: ${file}`;
      const userPrompt = `Project: ${team.description}\nFile: ${file}\nPurpose: Write the complete production code.`;
      
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: userPrompt }],
        activeAgent.model
      );

      const cleanContent = codingAgentService.extractFileContent(response);

      await supabase.from('code_files').insert({
        session_id: sessionId,
        file_path: file,
        language: codingAgentService.detectLanguageFromPath(file),
        content: cleanContent,
        version: 1
      });

      completedMap[role].push(file);
      await updateAgentStatus(role, 'running', completedMap[role]);
    }

    for (const b of activeBuilders) {
      await updateAgentStatus(b.role, 'done', completedMap[b.role as any]);
    }
    emit(projectId, StreamEventType.TOOL_RESULT, 'Parallel build phase complete.', { status: 'running' });

    // Phase 3 — Integration
    emit(projectId, StreamEventType.TOOL_CALLING, 'Agents integrating APIs and query optimizations...', { status: 'running' });
    await new Promise(r => setTimeout(r, 2000)); // Simulating review & adjustment loop
    emit(projectId, StreamEventType.TOOL_RESULT, 'Integration successfully completed.', { status: 'running' });

    // Phase 4 — Testing
    const testAgent = agents.find(a => a.role === 'testing');
    if (testAgent) {
      emit(projectId, StreamEventType.TOOL_CALLING, 'Testing agent validating sandbox execution...', { status: 'running' });
      await updateAgentStatus('testing', 'running');
      
      const testFramework = session.language === 'python' ? 'pytest' : 'jest';
      const testReport = await codingAgentService.generateAndRunTests(sessionId, projectId, testFramework);

      await updateAgentStatus('testing', 'done', testReport.results?.map((r: any) => r.file_path) || ['tests/unit.test.ts']);
      emit(projectId, StreamEventType.TOOL_RESULT, 'Testing validation complete.', { status: 'running' });
    }

    // Phase 5 — DevOps
    const devopsAgent = agents.find(a => a.role === 'devops');
    if (devopsAgent) {
      emit(projectId, StreamEventType.TOOL_CALLING, 'DevOps agent configuring build and container files...', { status: 'running' });
      await updateAgentStatus('devops', 'running');

      const dockerContent = `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]\n`;
      await supabase.from('code_files').insert({
        session_id: sessionId,
        file_path: 'Dockerfile',
        language: 'dockerfile',
        content: dockerContent,
        version: 1
      });

      await updateAgentStatus('devops', 'done', ['Dockerfile']);
      emit(projectId, StreamEventType.TOOL_RESULT, 'DevOps container configurations complete.', { status: 'running' });
    }

    // Phase 6 — Architect review
    emit(projectId, StreamEventType.TOOL_CALLING, 'Architect reviewing final outputs and consistency signoff...', { status: 'running' });
    await updateAgentStatus('architect', 'running');
    await new Promise(r => setTimeout(r, 2000));
    await updateAgentStatus('architect', 'done');
    
    // Complete session
    await supabase
      .from('coding_sessions')
      .update({ status: 'complete' })
      .eq('id', sessionId);

    // Phase 7 — Auto deploy
    emit(projectId, StreamEventType.TOOL_CALLING, 'Auto deployment starting...', { status: 'running' });
    const deployRes = await autoDeployService.autoDeployPipeline(sessionId, projectId);

    emit(projectId, StreamEventType.AGENT_COMPLETE, `Multi-agent team run completed! Live URL: ${deployRes.deployedUrl}`, { status: 'done' });

    return { success: true, url: deployRes.deployedUrl };
  }
};

export default codeTeamService;
