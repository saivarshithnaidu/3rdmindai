import { NextRequest, NextResponse } from 'next/server';
import hiringAgentService from '../../../../services/hiring-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    // Trigger asynchronously in background
    setTimeout(async () => {
      try {
        await hiringAgentService.scoreCandidates(jobId);
      } catch (err) {
        console.error('Background candidate scoring failed:', err);
      }
    }, 100);

    return NextResponse.json({ success: true, message: 'Candidate scoring started in background' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
