import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    const supabase = supabaseService.getClient();

    const { data: messages, error } = await supabase
      .from('agent_messages')
      .select('*')
      .or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error('Error in startup-agents messages GET route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
