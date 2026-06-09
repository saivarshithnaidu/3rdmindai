import { NextRequest, NextResponse } from 'next/server';
import codingAgentService from '../../../../services/coding-agent.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    const downloadUrl = await codingAgentService.packageAsZip(sessionId);

    return NextResponse.json({ success: true, downloadUrl });
  } catch (err: any) {
    console.error('Download API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
