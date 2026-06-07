import { NextRequest, NextResponse } from 'next/server';
import digestService from '../../../../services/digest.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId query parameter' }, { status: 400 });
    }

    const digests = await digestService.getWeeklyDigests(projectId);
    return NextResponse.json({ digests });
  } catch (err: any) {
    console.error('Error in digest list API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
