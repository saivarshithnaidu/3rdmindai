import { NextRequest, NextResponse } from 'next/server';
import hiringAgentService from '../../../../services/hiring-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { interviewId, notes } = await req.json();
    if (!interviewId || !notes) {
      return NextResponse.json({ error: 'Missing interviewId or notes' }, { status: 400 });
    }
    await hiringAgentService.generateAssessment(interviewId, notes);
    return NextResponse.json({ success: true, message: 'Assessment completed successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
