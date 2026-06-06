import { NextRequest, NextResponse } from 'next/server';
import mcpService from '../../../../services/mcp.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || null;
    const userId = searchParams.get('userId') || null;

    const tools = await mcpService.getAvailableTools(userId, projectId);

    return NextResponse.json(tools);
  } catch (error) {
    console.error('Error fetching available tools:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
