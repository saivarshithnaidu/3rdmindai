import { NextRequest, NextResponse } from 'next/server';
import learningService from '../../../../services/learning.service';

export async function POST(req: NextRequest) {
  try {
    const { taskId, agentId, projectId, eventType, eventValue, metadata } = await req.json();

    if (!agentId || !projectId || !eventType) {
      return NextResponse.json({ error: 'Missing agentId, projectId, or eventType' }, { status: 400 });
    }

    const event = await learningService.recordOutcome(
      taskId || null,
      agentId,
      projectId,
      eventType,
      eventValue !== undefined ? Number(eventValue) : undefined,
      metadata
    );

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    console.error('Error in api/outcomes/record:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
