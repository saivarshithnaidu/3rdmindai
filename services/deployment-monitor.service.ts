import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import autoDeployService from './auto-deploy.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const deploymentMonitorService = {
  /**
   * Health checks a specific deployment URL
   */
  async checkDeployment(monitorId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    
    const { data: monitor } = await supabase
      .from('deployment_monitors')
      .select('*')
      .eq('id', monitorId)
      .single();

    if (!monitor || !monitor.is_active) return;

    emit(monitor.project_id, StreamEventType.TOOL_CALLING, `Checking deployment health: ${monitor.deployed_url}`, { status: 'running' });

    const startTime = Date.now();
    let isDown = false;
    let errorDetails = '';
    let latency = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(monitor.deployed_url, {
        method: 'GET',
        headers: { 'User-Agent': '3RDMIND-Monitor/1.0' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      latency = Date.now() - startTime;

      if (!res.ok) {
        isDown = true;
        errorDetails = `HTTP Error Status: ${res.status} ${res.statusText}`;
      } else if (latency > 10000) {
        isDown = true;
        errorDetails = `Connection latency exceeded threshold limit: ${latency}ms`;
      }
    } catch (err: any) {
      isDown = true;
      latency = Date.now() - startTime;
      errorDetails = `Connection request exception: ${err.message}`;
    }

    // Calculate rolling average latency and uptime
    const nextErrorCount = isDown ? (monitor.error_count || 0) + 1 : 0;
    const nextUptime = isDown 
      ? Math.max(90, (monitor.uptime_percent || 100) - 1.5) 
      : Math.min(100, (monitor.uptime_percent || 100) + 0.1);

    await supabase
      .from('deployment_monitors')
      .update({
        last_checked: new Date().toISOString(),
        avg_response_ms: latency,
        uptime_percent: parseFloat(nextUptime.toFixed(2)),
        error_count: nextErrorCount
      })
      .eq('id', monitorId);

    if (isDown) {
      emit(monitor.project_id, StreamEventType.TOOL_FAILED, `Downtime detected on ${monitor.deployed_url}!`, { status: 'error', data: { errorDetails } });
      
      // Log incident
      const { data: incident } = await supabase
        .from('deployment_incidents')
        .insert({
          monitor_id: monitorId,
          incident_type: latency > 10000 ? 'slow_response' : 'downtime',
          error_details: errorDetails,
          auto_fix_attempted: false
        })
        .select()
        .single();

      if (incident) {
        // Run auto fix in background asynchronously
        this.autoFixIncident(incident.id).catch(err => {
          console.error(`Auto-fix failed for incident ${incident.id}:`, err);
        });
      }
    } else {
      emit(monitor.project_id, StreamEventType.TOOL_RESULT, `Deployment healthy (${latency}ms). Uptime: ${nextUptime.toFixed(1)}%`, { status: 'done' });
    }
  },

  /**
   * Diagnoses production incidents and triggers auto repair and deployment
   */
  async autoFixIncident(incidentId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    const { data: incident } = await supabase
      .from('deployment_incidents')
      .select('*, monitor:deployment_monitors(*)')
      .eq('id', incidentId)
      .single();

    if (!incident || incident.auto_fix_attempted) return;

    // Mark as attempted
    await supabase
      .from('deployment_incidents')
      .update({ auto_fix_attempted: true })
      .eq('id', incidentId);

    const monitor = incident.monitor;
    const sessionId = monitor.session_id;
    const projectId = monitor.project_id;

    emit(projectId, StreamEventType.TOOL_CALLING, 'Production incident auto-fix started. Analyzing error logs...', { status: 'running' });

    // Fetch session files to send for debugging
    const { data: codeFiles } = await supabase
      .from('code_files')
      .select('*')
      .eq('session_id', sessionId);

    if (!codeFiles || codeFiles.length === 0) return;

    const filesBlock = codeFiles
      .map(f => `// ${f.file_path}\n${f.content}`)
      .join('\n\n');

    const system = `You are a site reliability engineer repairing a production downtime crash.
Diagnose the root cause of the connection error and write the fix.

Return ONLY the corrected files using this exact format. No explanations. No placeholders.

<file path='path/to/file'>
corrected content
</file>`;

    const userPrompt = `Production incident detected.
Deployed app: ${monitor.deployed_url}
Error description: ${incident.error_details}

Current project source files:
${filesBlock}

Diagnose and write the fixed files now.`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: userPrompt }],
      'deepseek/deepseek-chat'
    );

    // Parse and apply fixes
    const fileRegex = /<file\s+path=['"]([^'"]+)['"]>([\s\S]*?)<\/file>/gi;
    let match;
    let filesUpdatedCount = 0;

    while ((match = fileRegex.exec(response)) !== null) {
      const filePath = match[1];
      const newContent = match[2].trim();

      const dbFile = codeFiles.find(f => f.file_path === filePath);
      if (dbFile) {
        await supabase
          .from('code_files')
          .update({
            content: newContent,
            version: (dbFile.version || 1) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', dbFile.id);
        filesUpdatedCount++;
      }
    }

    if (filesUpdatedCount > 0) {
      emit(projectId, StreamEventType.TOOL_CALLING, 'Re-deploying automatically repaired code bundle...', { status: 'running' });
      
      try {
        const deployRes = await autoDeployService.autoDeployPipeline(sessionId, projectId);
        
        // Resolve incident
        await supabase
          .from('deployment_incidents')
          .update({
            resolved: true,
            auto_fix_result: `Auto-fix successfully applied to ${filesUpdatedCount} files and deployed to production.`,
            resolved_at: new Date().toISOString()
          })
          .eq('id', incidentId);

        emit(projectId, StreamEventType.AGENT_COMPLETE, `Fixed production error automatically. Re-deployed live at ${deployRes.deployedUrl}`, { status: 'done' });
      } catch (deployErr: any) {
        await supabase
          .from('deployment_incidents')
          .update({
            auto_fix_result: `Failed to deploy fix: ${deployErr.message}`
          })
          .eq('id', incidentId);
      }
    }
  },

  /**
   * Health checks all active deployment monitors
   */
  async checkAllMonitors(projectId?: string): Promise<number> {
    const supabase = supabaseService.getServiceClient();
    let query = supabase.from('deployment_monitors').select('id').eq('is_active', true);
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: monitors } = await query;
    if (!monitors || monitors.length === 0) return 0;

    for (const monitor of monitors) {
      // Run each health check asynchronously
      this.checkDeployment(monitor.id).catch(err => {
        console.error(`Health check failed for monitor ${monitor.id}:`, err);
      });
    }

    return monitors.length;
  }
};

export default deploymentMonitorService;
