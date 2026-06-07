import { NextRequest, NextResponse } from 'next/server';
import judgeService from '../../../../services/judge.service';

export async function POST(req: NextRequest) {
  try {
    const { task, agent, projectId } = await req.json();
    if (!task || !agent || !projectId) {
      return NextResponse.json({ error: 'Missing task, agent, or projectId' }, { status: 400 });
    }
    const evaluation = await judgeService.evaluateTask(task, agent, projectId);
    return NextResponse.json({ evaluation });
  } catch (err: any) {
    console.error('Error in judge evaluate API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
