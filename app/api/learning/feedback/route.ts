import { NextRequest, NextResponse } from 'next/server';
import learningService from '../../../../services/learning.service';

export async function POST(req: NextRequest) {
  try {
    const { taskId, agentId, projectId, rating, feedbackText, editedOutput } = await req.json();

    if (!taskId || !agentId || !projectId) {
      return NextResponse.json({ error: 'Missing taskId, agentId, or projectId' }, { status: 400 });
    }

    const feedback = await learningService.recordUserFeedback(
      taskId,
      agentId,
      projectId,
      rating !== undefined ? Number(rating) : undefined,
      feedbackText,
      editedOutput
    );

    return NextResponse.json({ success: true, feedback });
  } catch (err: any) {
    console.error('Error in api/learning/feedback:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
