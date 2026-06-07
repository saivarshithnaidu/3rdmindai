import { NextRequest, NextResponse } from 'next/server';
import csoPipelineService from '../../../../services/cso-pipeline.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, agentId, userId, targetMarket, count } = await req.json();
    if (!projectId || !agentId || !userId || !targetMarket) {
      return NextResponse.json({ error: 'Missing projectId, agentId, userId, or targetMarket' }, { status: 400 });
    }

    const result = await csoPipelineService.runFullOutreachPipeline(
      projectId,
      agentId,
      userId,
      targetMarket,
      count || 3
    );

    return NextResponse.json({ result });
  } catch (err: any) {
    console.error('Error in outreach pipeline API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
