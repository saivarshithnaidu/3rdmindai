import { NextRequest, NextResponse } from 'next/server';
import mcpService from '../../../../../services/mcp.service';
import { ALL_CONNECTORS } from '../../../../../lib/connectors.registry';
import { encrypt } from '../../../../../lib/crypto';
import supabaseService from '../../../../../services/supabase.service';
import { Connector } from '../../../../../types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, apiKey, userId } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const activeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const config = ALL_CONNECTORS.find(c => c.slug === slug);
    if (!config) {
      return NextResponse.json({ error: `Connector config not found for slug: ${slug}` }, { status: 404 });
    }

    if (config.authType === 'api_key' && !apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Prepare temp connector object for validation
    const tempConnector: Connector = {
      id: 'temp-id',
      name: config.name,
      slug: config.slug,
      category: config.category,
      description: config.description,
      authType: 'api_key',
      serverUrl: config.serverUrl,
      isActive: true
    };

    // Validate key by listing tools
    const tools = await mcpService.listTools(tempConnector, apiKey, undefined);
    
    // Save to connectors table
    const encryptedKey = encrypt(apiKey);
    const supabase = supabaseService.getServiceClient();

    const { error } = await supabase.from('connectors').upsert({
      user_id: activeUserId,
      slug: slug,
      name: config.name,
      category: config.category,
      auth_type: 'api_key',
      api_key: encryptedKey,
      is_active: true,
      server_url: config.serverUrl,
      tools_available: tools.length,
      metadata: {
        connected_at: new Date().toISOString(),
        tool_count: tools.length
      }
    }, {
      onConflict: 'user_id,slug'
    });

    if (error) {
      console.error('Failed to save API key connector to DB:', error.message);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      toolCount: tools.length
    });
  } catch (err: any) {
    console.error('API key connector validation failed:', err);
    return NextResponse.json({ error: err.message || 'Validation failed' }, { status: 520 });
  }
}
