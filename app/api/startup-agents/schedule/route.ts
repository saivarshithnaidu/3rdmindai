import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import agentScheduleService from '../../../../services/agent-schedule.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getClient();

    const { data: schedules, error } = await supabase
      .from('agent_schedules')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ schedules });
  } catch (err: any) {
    console.error('Error in startup-agents schedule GET route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, projectId, taskTemplate, cron } = await req.json();

    if (!agentId || !projectId || !taskTemplate || !cron) {
      return NextResponse.json(
        { error: 'Missing agentId, projectId, taskTemplate, or cron' },
        { status: 400 }
      );
    }

    const schedule = await agentScheduleService.createSchedule(
      agentId,
      projectId,
      taskTemplate,
      cron
    );

    return NextResponse.json({ schedule });
  } catch (err: any) {
    console.error('Error in startup-agents schedule POST route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let scheduleId = '';
    
    // Support retrieving scheduleId from body or query params
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get('scheduleId');
    if (queryId) {
      scheduleId = queryId;
    } else {
      try {
        const body = await req.json();
        scheduleId = body.scheduleId;
      } catch (e) {
        // Body reading failed, ignore
      }
    }

    if (!scheduleId) {
      return NextResponse.json({ error: 'Missing scheduleId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { error } = await supabase
      .from('agent_schedules')
      .update({ is_active: false })
      .eq('id', scheduleId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in startup-agents schedule DELETE route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
