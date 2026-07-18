import { NextRequest, NextResponse } from 'next/server';
import learningService from '../../../../services/learning.service';

export async function POST(req: NextRequest) {
  try {
    const { taskId, agentId, projectId } = await req.json();

    if (!taskId || !agentId || !projectId) {
      return NextResponse.json({ error: 'Missing taskId, agentId, or projectId' }, { status: 400 });
    }

    const log = await learningService.recordTaskPerformance(taskId, agentId, projectId);

    return NextResponse.json({ success: true, log });
  } catch (err: any) {
    console.error('Error in api/learning/record:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
