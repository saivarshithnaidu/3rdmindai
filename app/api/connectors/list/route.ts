import { NextRequest, NextResponse } from 'next/server';
import mcpService from '../../../../services/mcp.service';
import { ALL_CONNECTORS } from '../../../../lib/connectors.registry';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000000';

    // Get active user connectors from Supabase
    const activeConnectors = await mcpService.getConnectors(userId);

    // Merge registry with database states
    const connectorsList = ALL_CONNECTORS.map(connector => {
      const active = activeConnectors.find(c => c.slug === connector.slug);
      const isConnected = !!active?.isActive;
      
      return {
        ...connector,
        isConnected,
        toolsAvailable: isConnected ? (active?.toolsAvailable || connector.tools.length) : 0,
        // Exclude secret tokens from being leaked to client
        isActive: isConnected
      };
    });

    return NextResponse.json({ connectors: connectorsList });
  } catch (err: any) {
    console.error('Failed to list connectors:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
