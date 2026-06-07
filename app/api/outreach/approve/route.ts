import { NextRequest, NextResponse } from 'next/server';
import csoPipelineService from '../../../../services/cso-pipeline.service';

export async function POST(req: NextRequest) {
  try {
    const { leadId, userId, projectId } = await req.json();
    if (!leadId || !userId || !projectId) {
      return NextResponse.json({ error: 'Missing leadId, userId, or projectId' }, { status: 400 });
    }

    const result = await csoPipelineService.sendOutreach(leadId, userId, projectId);
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error('Error in outreach approve API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
