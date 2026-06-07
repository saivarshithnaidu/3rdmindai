import { NextRequest, NextResponse } from 'next/server';
import autonomousService from '../../../../services/autonomous.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId query parameter' }, { status: 400 });
    }

    const runs = await autonomousService.getWeeklyRuns(projectId);
    return NextResponse.json({ runs });
  } catch (err: any) {
    console.error('Error in autonomous runs API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
