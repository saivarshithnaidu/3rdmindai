import { NextRequest, NextResponse } from 'next/server';
import judgeService from '../../../../services/judge.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const projectId = searchParams.get('projectId');

    if (!agentId || !projectId) {
      return NextResponse.json({ error: 'Missing agentId or projectId query parameters' }, { status: 400 });
    }

    const stats = await judgeService.getAgentQualityStats(agentId, projectId);
    return NextResponse.json({ stats });
  } catch (err: any) {
    console.error('Error in judge stats API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
