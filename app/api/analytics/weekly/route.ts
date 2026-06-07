import { NextRequest, NextResponse } from 'next/server';
import analyticsService from '../../../../services/analytics.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, weekStart } = await req.json();
    if (!projectId || !weekStart) {
      return NextResponse.json({ error: 'Missing projectId or weekStart' }, { status: 400 });
    }
    const analytics = await analyticsService.computeWeeklyAnalytics(projectId, weekStart);
    return NextResponse.json({ analytics });
  } catch (err: any) {
    console.error('Error in analytics weekly API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
