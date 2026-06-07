import { NextRequest, NextResponse } from 'next/server';
import agentCommsService from '../../../../../services/agent-comms.service';

export async function POST(req: NextRequest) {
  try {
    const { messageId } = await req.json();

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    await agentCommsService.markRead(messageId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in startup-agents messages markRead route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
