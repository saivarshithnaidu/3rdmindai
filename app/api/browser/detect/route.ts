import { NextRequest, NextResponse } from 'next/server';
import browserAgentService from '../../../../services/browser-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const detection = await browserAgentService.detectBrowserRequest(message);
    return NextResponse.json(detection);
  } catch (err: any) {
    console.error('Error in browser request detection:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
