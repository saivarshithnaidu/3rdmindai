import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing parameter: sessionId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: monitor, error } = await supabase
      .from('deployment_monitors')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) throw error;

    if (!monitor) {
      return NextResponse.json({ success: true, status: 'deploying', url: null });
    }

    return NextResponse.json({
      success: true,
      status: monitor.is_active ? 'live' : 'inactive',
      url: monitor.deployed_url,
      monitor
    });
  } catch (err: any) {
    console.error('Deploy status API failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
