import { NextRequest, NextResponse } from 'next/server';
import hiringAgentService from '../../../../services/hiring-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }
    const jd = await hiringAgentService.generateJobDescription(jobId);
    return NextResponse.json({ success: true, jd });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
