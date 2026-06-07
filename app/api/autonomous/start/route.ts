import { NextRequest, NextResponse } from 'next/server';
import autonomousService from '../../../../services/autonomous.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, userId } = await req.json();
    if (!projectId || !userId) {
      return NextResponse.json({ error: 'Missing projectId or userId' }, { status: 400 });
    }
    const run = await autonomousService.startWeeklyRun(projectId, userId);
    return NextResponse.json({ run });
  } catch (err: any) {
    console.error('Error in autonomous start API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
