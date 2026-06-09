import { NextRequest, NextResponse } from 'next/server';
import voiceBriefingService from '../../../../services/voice-briefing.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, userId } = await req.json();

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'Missing projectId or userId' }, { status: 400 });
    }

    // Trigger runMorningBriefing in background
    setTimeout(async () => {
      try {
        await voiceBriefingService.runMorningBriefing(projectId, userId);
      } catch (err) {
        console.error('Background morning briefing failed:', err);
      }
    }, 100);

    return NextResponse.json({ success: true, message: 'Generating briefing...' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
