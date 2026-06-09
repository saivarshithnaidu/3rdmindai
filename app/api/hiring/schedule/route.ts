import { NextRequest, NextResponse } from 'next/server';
import hiringAgentService from '../../../../services/hiring-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { candidateId, scheduledAt, type = 'technical' } = await req.json();
    if (!candidateId || !scheduledAt) {
      return NextResponse.json({ error: 'Missing candidateId or scheduledAt' }, { status: 400 });
    }
    const interviewId = await hiringAgentService.scheduleInterview(candidateId, scheduledAt, type);
    return NextResponse.json({ success: true, interviewId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
