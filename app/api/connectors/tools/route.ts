import { NextRequest, NextResponse } from 'next/server';
import mcpService from '../../../../services/mcp.service';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000000';

    const tools = await mcpService.getAvailableTools(userId, null);
    return NextResponse.json({ tools });
  } catch (err: any) {
    console.error('Failed to get available tools:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
