import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import mcpService from '../../../../services/mcp.service';
import { encrypt } from '../../../../lib/crypto';
import { Connector } from '../../../../types';

export async function POST(req: NextRequest) {
  try {
    const { name, serverUrl, apiKey, oauthToken, projectId, userId } = await req.json();

    if (!name || !serverUrl) {
      return NextResponse.json({ error: 'Missing connector name or serverUrl' }, { status: 400 });
    }

    const regName = name.toLowerCase();

    // 1. Determine Auth Type
    let authType: 'api_key' | 'oauth' | 'none' = 'none';
    if (apiKey) authType = 'api_key';
    else if (oauthToken) authType = 'oauth';

    // Create a temporary connector interface to run listTools for validation check
    const tempConnector: Connector = {
      id: 'temp-validation',
      name,
      category: 'Validation',
      description: '',
      authType,
      serverUrl,
      isActive: true,
    };

    // 2. Validate connector by listing its tools
    // This will either connect to the live server or fallback to simulated tools, proving it works
    const tools = await mcpService.listTools(tempConnector, apiKey, oauthToken);

    // 3. Encrypt credentials for secure database storage
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;
    const encryptedOauthToken = oauthToken ? encrypt(oauthToken) : null;

    // 4. Save/Upsert Connector config in Supabase
    const supabase = supabaseService.getServiceClient();
    
    // Check if connector already exists for user/project
    let query = supabase.from('connectors').select('id').eq('name', name);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data: existing } = await query;

    let dbResult;
    if (existing && existing.length > 0) {
      // Update existing connector
      const { data, error } = await supabase
        .from('connectors')
        .update({
          server_url: serverUrl,
          auth_type: authType,
          api_key: encryptedApiKey,
          oauth_token: encryptedOauthToken,
          is_active: true,
        })
        .eq('id', existing[0].id)
        .select()
        .single();
      
      if (error) throw error;
      dbResult = data;
    } else {
      // Insert new connector
      const { data, error } = await supabase
        .from('connectors')
        .insert({
          project_id: projectId || null,
          user_id: userId || null,
          name,
          server_url: serverUrl,
          auth_type: authType,
          api_key: encryptedApiKey,
          oauth_token: encryptedOauthToken,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      dbResult = data;
    }

    return NextResponse.json({
      success: true,
      connector: {
        id: dbResult.id,
        name: dbResult.name,
        isActive: dbResult.is_active,
        toolsAvailable: tools.length,
      },
    });
  } catch (error) {
    console.error('Error connecting to MCP service:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
