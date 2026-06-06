import { NextRequest, NextResponse } from 'next/server';
import mcpService from '../../../../services/mcp.service';
import { AVAILABLE_CONNECTORS } from '../../../../lib/connectors';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || null;

    // Fetch user connectors from database
    const dbConnectors = await mcpService.getConnectors(userId);

    // Merge registered available connectors with their DB configurations
    const merged = AVAILABLE_CONNECTORS.map((reg) => {
      const dbMatch = dbConnectors.find((dbc) => dbc.name.toLowerCase() === reg.id.toLowerCase());
      
      return {
        id: dbMatch ? dbMatch.id : reg.id, // DB UUID if connected, else string slug
        name: reg.name,
        category: reg.category,
        description: reg.description,
        authType: reg.authType,
        serverUrl: dbMatch ? dbMatch.serverUrl : reg.serverUrl,
        isActive: dbMatch ? dbMatch.isActive : false,
        docsUrl: reg.docsUrl,
        icon: reg.icon,
      };
    });

    return NextResponse.json(merged);
  } catch (error) {
    console.error('Error listing connectors:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
