import { NextRequest, NextResponse } from 'next/server';
import hiringAgentService from '../../../../services/hiring-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { candidateId } = await req.json();
    if (!candidateId) {
      return NextResponse.json({ error: 'Missing candidateId' }, { status: 400 });
    }
    await hiringAgentService.sendRejectionEmail(candidateId);
    return NextResponse.json({ success: true, message: 'Rejection email sent successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
