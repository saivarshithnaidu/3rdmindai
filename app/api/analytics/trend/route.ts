import { NextRequest, NextResponse } from 'next/server';
import analyticsService from '../../../../services/analytics.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const projectId = searchParams.get('projectId');
    const weeksStr = searchParams.get('weeks');
    const weeks = weeksStr ? parseInt(weeksStr) : 8;

    if (!agentId || !projectId) {
      return NextResponse.json({ error: 'Missing agentId or projectId query parameters' }, { status: 400 });
    }

    const trend = await analyticsService.getAgentTrend(agentId, projectId, weeks);
    return NextResponse.json({ trend });
  } catch (err: any) {
    console.error('Error in analytics trend API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
