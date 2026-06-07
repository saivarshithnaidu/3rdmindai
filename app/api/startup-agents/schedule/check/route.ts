import { NextRequest, NextResponse } from 'next/server';
import agentScheduleService from '../../../../../services/agent-schedule.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    await agentScheduleService.checkAndRunScheduled(projectId);

    return NextResponse.json({ success: true, message: 'Checked and triggered schedules.' });
  } catch (err: any) {
    console.error('Error checking schedules:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json().catch(() => ({ projectId: undefined }));

    await agentScheduleService.checkAndRunScheduled(projectId);

    return NextResponse.json({ success: true, message: 'Checked and triggered schedules.' });
  } catch (err: any) {
    console.error('Error checking schedules:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
