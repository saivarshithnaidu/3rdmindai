import { NextRequest, NextResponse } from 'next/server';
import digestService from '../../../../services/digest.service';

export async function POST(req: NextRequest) {
  try {
    const { runId, projectId } = await req.json();
    if (!runId || !projectId) {
      return NextResponse.json({ error: 'Missing runId or projectId' }, { status: 400 });
    }
    const digestContent = await digestService.generateWeeklyDigest(runId, projectId);
    return NextResponse.json({ content: digestContent });
  } catch (err: any) {
    console.error('Error in digest generate API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
