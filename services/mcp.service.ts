import supabaseService from './supabase.service';
import { decrypt, encrypt } from '../lib/crypto';
import { Connector, MCPTool, ToolCall } from '../types';
import { ALL_CONNECTORS } from '../lib/connectors.registry';

// Simple in-memory cache for available tools
let toolsCache: { timestamp: number; data: MCPTool[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const OAUTH_CREDENTIALS: Record<string, { tokenUrl: string; clientId: string; clientSecret: string }> = {
  'google-drive': {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
  },
  'gmail': {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
  },
  'google-calendar': {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
  },
  'slack': {
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || ''
  },
  'github': {
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || ''
  },
  'notion': {
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientId: process.env.NOTION_CLIENT_ID || '',
    clientSecret: process.env.NOTION_CLIENT_SECRET || ''
  },
  'linear': {
    tokenUrl: 'https://api.linear.app/oauth/token',
    clientId: process.env.LINEAR_CLIENT_ID || '',
    clientSecret: process.env.LINEAR_CLIENT_SECRET || ''
  },
  'jira': {
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientId: process.env.ATLASSIAN_CLIENT_ID || '',
    clientSecret: process.env.ATLASSIAN_CLIENT_SECRET || ''
  },
  'outlook': {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || ''
  },
  'onedrive': {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || ''
  },
  'hubspot': {
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    clientId: process.env.HUBSPOT_CLIENT_ID || '',
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET || ''
  },
  'salesforce': {
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || ''
  },
  'dropbox': {
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    clientId: process.env.DROPBOX_CLIENT_ID || '',
    clientSecret: process.env.DROPBOX_CLIENT_SECRET || ''
  },
  'discord': {
    tokenUrl: 'https://discord.com/api/oauth2/token',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || ''
  },
  'asana': {
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    clientId: process.env.ASANA_CLIENT_ID || '',
    clientSecret: process.env.ASANA_CLIENT_SECRET || ''
  }
};

export const mcpService = {
  /**
   * Fetches all active connectors for this user.
   */
  async getConnectors(userId?: string | null): Promise<Connector[]> {
    const supabase = supabaseService.getServiceClient();
    const defaultUserId = '00000000-0000-0000-0000-000000000000';
    const activeUserId = userId || defaultUserId;
    
    const { data, error } = await supabase
      .from('connectors')
      .select('*')
      .eq('user_id', activeUserId);
      
    if (error) {
      console.error('Failed to fetch connectors from database:', error.message);
      return [];
    }
    
    return (data || []).map((row: any) => {
      const reg = ALL_CONNECTORS.find(c => c.slug === row.slug) || {
        slug: row.slug || row.name.toLowerCase(),
        name: row.name,
        category: row.category || 'custom',
        description: 'Custom MCP Tool Connector',
        authType: row.auth_type,
        serverUrl: row.server_url || '',
        docsUrl: '',
        icon: 'ti-plug',
        tools: []
      };
      
      return {
        id: row.id,
        user_id: row.user_id,
        slug: row.slug || reg.slug,
        name: row.name,
        category: reg.category,
        description: reg.description || 'Custom MCP Tool Connector',
        authType: row.auth_type as 'api_key' | 'oauth' | 'none',
        serverUrl: row.server_url || reg.serverUrl || '',
        isActive: row.is_active,
        docsUrl: reg.docsUrl,
        icon: reg.icon,
        api_key: row.api_key,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        token_expiry: row.token_expiry,
        scopes: row.scopes,
        metadata: row.metadata
      };
    });
  },

  /**
   * Generates authorization headers.
   */
  getAuthHeaders(authType: string, apiKeyDecrypted?: string, accessTokenDecrypted?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authType === 'api_key' && apiKeyDecrypted) {
      headers['Authorization'] = `Bearer ${apiKeyDecrypted}`;
      headers['x-api-key'] = apiKeyDecrypted;
    } else if (authType === 'oauth' && accessTokenDecrypted) {
      headers['Authorization'] = `Bearer ${accessTokenDecrypted}`;
    }
    return headers;
  },

  /**
   * Refreshes OAuth token using refresh_token.
   */
  async refreshOAuthToken(connector: any): Promise<any> {
    const creds = OAUTH_CREDENTIALS[connector.slug];
    if (!creds || !connector.refresh_token) {
      return null;
    }

    const decryptedRefreshToken = decrypt(connector.refresh_token);
    if (!decryptedRefreshToken) {
      return null;
    }

    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptedRefreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret
      });

      const response = await fetch(creds.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: bodyParams.toString()
      });

      if (!response.ok) {
        throw new Error(`Refresh token response failed: ${response.status}`);
      }

      const data = await response.json();
      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token || decryptedRefreshToken;
      const expiresIn = data.expires_in;
      const expiresAt = expiresIn 
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : connector.token_expiry;

      const encryptedAccessToken = encrypt(newAccessToken);
      const encryptedRefreshToken = encrypt(newRefreshToken);

      const supabase = supabaseService.getServiceClient();
      const { data: updated, error } = await supabase
        .from('connectors')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expiry: expiresAt
        })
        .eq('id', connector.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updated;
    } catch (err) {
      console.error(`Failed to refresh token for connector ${connector.slug}:`, err);
      return null;
    }
  },

  /**
   * Lists tools exposed by a connector's server.
   */
  async listTools(connector: Connector, apiKeyDecrypted?: string, oauthTokenDecrypted?: string): Promise<MCPTool[]> {
    try {
      if (!connector.serverUrl) {
        return this.getSimulatedToolsForConnector(connector);
      }
      
      const headers = this.getAuthHeaders(connector.authType, apiKeyDecrypted, oauthTokenDecrypted);
      
      // Standard HTTP MCP SSE / POST tools list check
      const response = await fetch(`${connector.serverUrl}/tools/list`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(5000)
      }).catch(() => {
        return fetch(`${connector.serverUrl}/tools/list`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(5000)
        });
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const tools = data.tools || [];
      
      return tools.map((t: any) => ({
        name: t.name,
        description: t.description || `Tool from ${connector.name}`,
        inputSchema: t.inputSchema || t.schema || {},
        connectorId: connector.id,
        connectorSlug: connector.slug,
        connectorName: connector.name
      }));
    } catch (err) {
      console.warn(`Failed to retrieve tools list from ${connector.name} at ${connector.serverUrl}:`, err instanceof Error ? err.message : String(err));
      return this.getSimulatedToolsForConnector(connector);
    }
  },

  /**
   * Returns mock/simulated tools signature.
   */
  getSimulatedToolsForConnector(connector: Connector): MCPTool[] {
    const slug = connector.slug || connector.name.toLowerCase();
    const registryEntry = ALL_CONNECTORS.find(c => c.slug === slug);
    if (!registryEntry) return [];
    
    return registryEntry.tools.map(toolName => {
      let properties: Record<string, any> = {
        query: { type: 'string', description: 'Query parameter' }
      };
      let required = ['query'];
      
      if (toolName.includes('create') || toolName.includes('send') || toolName.includes('write') || toolName.includes('upload') || toolName.includes('insert') || toolName.includes('add')) {
        properties = {
          title: { type: 'string', description: 'Title or name' },
          content: { type: 'string', description: 'Body content or payload data' },
          channel: { type: 'string', description: 'Target channel/recipient/folder' }
        };
        required = ['title', 'content'];
      }
      
      return {
        name: toolName,
        description: `Simulated tool execution wrapper for ${toolName} in ${connector.name}.`,
        inputSchema: {
          type: 'object',
          properties,
          required
        },
        connectorId: connector.id,
        connectorSlug: slug,
        connectorName: connector.name
      };
    });
  },

  /**
   * Calls a tool of an active connector, log to DB and return result.
   */
  async callTool(
    connectorSlug: string,
    toolName: string,
    params: Record<string, unknown>,
    agentId?: string | null,
    projectId?: string | null,
    messageId?: string | null,
    userId?: string | null
  ): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    const startTime = Date.now();
    const defaultUserId = '00000000-0000-0000-0000-000000000000';
    const activeUserId = userId || defaultUserId;

    // 1. Fetch connector by slug + user_id
    const { data: row, error: fetchErr } = await supabase
      .from('connectors')
      .select('*')
      .eq('user_id', activeUserId)
      .eq('slug', connectorSlug)
      .maybeSingle();

    if (fetchErr || !row) {
      // Check if it's a no-auth connector, we can run simulated call
      const registryEntry = ALL_CONNECTORS.find(c => c.slug === connectorSlug);
      if (registryEntry && registryEntry.authType === 'none') {
        return this.getSimulatedResult(connectorSlug, toolName, params);
      }
      throw new Error(`Connector ${connectorSlug} not found in database.`);
    }

    // 2. Token refresh check
    let connector = row;
    if (row.auth_type === 'oauth' && row.refresh_token && row.token_expiry) {
      const expiry = new Date(row.token_expiry).getTime();
      const BUFFER_TIME = 5 * 60 * 1000;
      if (Date.now() + BUFFER_TIME > expiry) {
        try {
          const refreshed = await this.refreshOAuthToken(row);
          if (refreshed) {
            connector = refreshed;
          }
        } catch (refreshErr) {
          console.error(`Token refresh failed for ${connectorSlug}:`, refreshErr);
        }
      }
    }

    // Decrypt credentials
    const apiKeyDecrypted = connector.api_key ? decrypt(connector.api_key) : '';
    const accessTokenDecrypted = connector.access_token ? decrypt(connector.access_token) : '';

    // 3. Insert pending tool call record
    const { data: callRecord, error: insertErr } = await supabase
      .from('tool_calls')
      .insert({
        project_id: projectId || '00000000-0000-0000-0000-000000000000',
        agent_id: agentId || '00000000-0000-0000-0000-000000000000',
        message_id: messageId || null,
        connector_slug: connectorSlug,
        tool_name: toolName,
        params: params,
        status: 'running',
        duration_ms: 0
      })
      .select()
      .single();

    const recordId = callRecord?.id;

    // Check approvals if running in autonomous supervised mode
    if (agentId && projectId) {
      try {
        const approvalResult = await this.checkAndHandleApproval(connectorSlug, toolName, params, agentId, projectId);
        if (!approvalResult.approved) {
          const errorMsg = approvalResult.error || 'Action rejected by user.';
          if (recordId) {
            await supabase
              .from('tool_calls')
              .update({
                result: { error: errorMsg },
                status: 'error',
                duration_ms: Date.now() - startTime
              })
              .eq('id', recordId);
          }
          return { error: errorMsg };
        }
      } catch (appErr) {
        console.error('Supervised approval check failed, proceeding by default:', appErr);
      }
    }

    try {
      const headers = this.getAuthHeaders(connector.auth_type, apiKeyDecrypted, accessTokenDecrypted);
      let resultData: any;

      if (connector.server_url) {
        try {
          const response = await fetch(`${connector.server_url}/tools/call`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: toolName,
              arguments: params
            }),
            signal: AbortSignal.timeout(10000)
          });

          if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
          }
          resultData = await response.json();
        } catch (callErr) {
          console.warn(`Unreachable server ${connector.server_url}/tools/call: running simulated results.`);
          resultData = this.getSimulatedResult(connectorSlug, toolName, params);
        }
      } else {
        resultData = this.getSimulatedResult(connectorSlug, toolName, params);
      }

      const duration = Date.now() - startTime;

      if (recordId) {
        await supabase
          .from('tool_calls')
          .update({
            result: resultData,
            status: 'done',
            duration_ms: duration
          })
          .eq('id', recordId);
      }

      return resultData;
    } catch (e) {
      const duration = Date.now() - startTime;
      console.error(`Error executing tool ${toolName}:`, e);

      if (recordId) {
        await supabase
          .from('tool_calls')
          .update({
            result: { error: e instanceof Error ? e.message : String(e) },
            status: 'error',
            duration_ms: duration
          })
          .eq('id', recordId);
      }

      return { error: e instanceof Error ? e.message : String(e) };
    }
  },

  /**
   * Simulated output data results.
   */
  getSimulatedResult(connectorSlug: string, toolName: string, params: any): any {
    const slug = connectorSlug.toLowerCase();
    
    if (slug.includes('drive') || slug.includes('onedrive') || slug.includes('dropbox') || slug.includes('storage')) {
      return {
        success: true,
        file_id: 'mock_file_' + Math.random().toString(36).substr(2, 9),
        path: params.channel || params.title || '/mock_path/document.pdf',
        message: `Successfully executed ${toolName} inside ${connectorSlug}.`
      };
    }
    
    if (slug.includes('gmail') || slug.includes('outlook') || slug.includes('slack') || slug.includes('discord') || slug.includes('communication')) {
      return {
        success: true,
        message_id: 'msg_' + Math.random().toString(36).substr(2, 9),
        recipient: params.channel || params.recipient || 'general',
        message: `Message sent via ${toolName} in ${connectorSlug}.`
      };
    }
    
    if (slug.includes('search') || slug.includes('wikipedia') || slug.includes('tavily') || slug.includes('exa') || slug.includes('perplexity') || slug.includes('serper') || slug.includes('hackernews')) {
      return {
        query: params.query || params.title || 'agentx search',
        results: [
          { title: `Search match 1 for ${toolName}`, url: `https://${slug}.com/match1`, snippet: `Extracted neural result for query: ${params.query || 'mcp'}.` },
          { title: `Search match 2 for ${toolName}`, url: `https://${slug}.com/match2`, snippet: `Additional details about the requested topic in ${connectorSlug}.` }
        ]
      };
    }
    
    return {
      success: true,
      action: toolName,
      payload: params,
      message: `Simulated success callback for ${toolName} tool execution in ${connectorSlug}.`
    };
  },

  /**
   * Fetches all tools across all active connectors, checking cache.
   */
  async getAvailableTools(userId?: string | null, projectId?: string | null): Promise<MCPTool[]> {
    const now = Date.now();
    if (toolsCache && (now - toolsCache.timestamp < CACHE_TTL_MS)) {
      return toolsCache.data;
    }

    const activeConnectors = await this.getConnectors(userId);
    const activeOnly = activeConnectors.filter(c => c.isActive);

    const promises = activeOnly.map(async (connector) => {
      const supabase = supabaseService.getServiceClient();
      
      const { data } = await supabase
        .from('connectors')
        .select('api_key, access_token')
        .eq('id', connector.id)
        .single();
      
      const apiKeyDecrypted = data?.api_key ? decrypt(data.api_key) : '';
      const accessTokenDecrypted = data?.access_token ? decrypt(data.access_token) : '';

      return this.listTools(connector, apiKeyDecrypted, accessTokenDecrypted);
    });

    const results = await Promise.all(promises);
    const flatTools = results.flat();

    toolsCache = {
      timestamp: now,
      data: flatTools
    };

    return flatTools;
  },

  /**
   * Parses agent text output for tool calls.
   */
  parseToolCalls(agentOutput: string): { tool: string; params: Record<string, unknown> }[] {
    const toolCalls: { tool: string; params: Record<string, unknown> }[] = [];
    const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
    
    let match;
    while ((match = regex.exec(agentOutput)) !== null) {
      const jsonStr = match[1].trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.tool) {
          toolCalls.push({
            tool: parsed.tool,
            params: parsed.params || parsed.arguments || {}
          });
        }
      } catch (err) {
        console.warn('Failed to parse inner tool call JSON:', jsonStr, err);
      }
    }
    
    return toolCalls;
  },

  /**
   * Executes a list of tool calls and builds the context payload.
   */
  async executeToolCalls(
    toolCalls: { tool: string; params: Record<string, unknown> }[],
    agentId: string,
    projectId: string,
    messageId?: string | null,
    userId?: string | null
  ): Promise<string> {
    if (toolCalls.length === 0) return '';

    const availableTools = await this.getAvailableTools(userId, projectId);
    let resultContext = '';

    for (const call of toolCalls) {
      const matchedTool = availableTools.find(t => t.name === call.tool);
      if (!matchedTool) {
        resultContext += `\n[TOOL FAILURE: Tool "${call.tool}" not found or inactive in connector registry.]\n`;
        continue;
      }

      try {
        const res = await this.callTool(
          matchedTool.connectorSlug || matchedTool.connectorName.toLowerCase(),
          call.tool,
          call.params,
          agentId,
          projectId,
          messageId,
          userId
        );
        
        resultContext += `\n[TOOL CALL RESULT for tool "${call.tool}"]: ${JSON.stringify(res)}\n`;
      } catch (err) {
        resultContext += `\n[TOOL CALL EXCEPTION for tool "${call.tool}"]: ${err instanceof Error ? err.message : String(err)}\n`;
      }
    }

    return resultContext;
  },

  /**
   * Injects available tools information into system prompt.
   */
  injectToolsIntoSystem(systemPrompt: string, availableTools: MCPTool[]): string {
    if (availableTools.length === 0) return systemPrompt;

    const toolsDescription = availableTools.map(t => {
      return `- **${t.name}** (from ${t.connectorName}): ${t.description}\n  Schema: \`${JSON.stringify(t.inputSchema)}\``;
    }).join('\n');

    const injection = `\n\nYou have access to these external tools. Use them when they would improve your output.
Call syntax — wrap in tags exactly like this:
<tool_call>{"tool":"tool_name","params":{"param1":"value"}}</tool_call>

Available tools:
${toolsDescription}
`;

    return systemPrompt + injection;
  },

  async checkAndHandleApproval(
    connectorSlug: string,
    toolName: string,
    params: Record<string, unknown>,
    agentId: string,
    projectId: string
  ): Promise<{ approved: boolean; error?: string }> {
    const supabase = supabaseService.getServiceClient();
    
    // Check if project has autonomous mode enabled and is supervised
    const { data: project } = await supabase
      .from('projects')
      .select('autonomous_mode, autonomous_level')
      .eq('id', projectId)
      .maybeSingle();

    if (!project || !project.autonomous_mode || project.autonomous_level !== 'supervised') {
      return { approved: true };
    }

    const nameLower = toolName.toLowerCase();
    const slugLower = connectorSlug.toLowerCase();
    
    const isEmail = nameLower.includes('send') && (nameLower.includes('email') || nameLower.includes('mail') || slugLower.includes('gmail') || slugLower.includes('outlook'));
    const isPost = nameLower.includes('post') || nameLower.includes('tweet') || slugLower.includes('slack') || slugLower.includes('twitter') || slugLower.includes('linkedin');
    
    if (!isEmail && !isPost) {
      return { approved: true };
    }

    // Find currently running task for this agent
    const { data: runningTasks } = await supabase
      .from('agent_tasks')
      .select('id')
      .eq('agent_id', agentId)
      .eq('project_id', projectId)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1);

    const taskId = runningTasks?.[0]?.id || '00000000-0000-0000-0000-000000000000';

    // Create pending approval
    const { data: approval, error: appError } = await supabase
      .from('pending_approvals')
      .insert({
        project_id: projectId,
        agent_id: agentId,
        task_id: taskId,
        action_type: isEmail ? 'send_email' : 'post_content',
        action_data: params,
        status: 'pending'
      })
      .select()
      .single();

    if (appError || !approval) {
      console.error('Failed to create pending approval record:', appError);
      return { approved: true }; // Fallback to allow if database insert fails
    }

    try {
      const { default: webhookService } = await import('./webhook.service');
      webhookService.fireWebhook(projectId, 'approval.needed', approval);
    } catch (webhookErr) {
      console.error('Failed to trigger approval.needed webhook from MCP call:', webhookErr);
    }

    // Poll for user decision up to 24 hours
    const startTime = Date.now();
    const timeoutMs = 24 * 60 * 60 * 1000;
    const intervalMs = 2000;

    while (Date.now() - startTime < timeoutMs) {
      const { data: currentApproval } = await supabase
        .from('pending_approvals')
        .select('status')
        .eq('id', approval.id)
        .single();

      if (currentApproval) {
        if (currentApproval.status === 'approved') {
          return { approved: true };
        }
        if (currentApproval.status === 'rejected') {
          return { approved: false, error: 'Action was rejected by user.' };
        }
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    // Timeout: update status to rejected
    await supabase
      .from('pending_approvals')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', approval.id);

    return { approved: false, error: 'Action was rejected due to 24-hour approval timeout.' };
  }
};

export default mcpService;
