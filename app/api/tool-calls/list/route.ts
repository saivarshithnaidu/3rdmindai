import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('tool_calls')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to retrieve tool calls:', error.message);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ toolCalls: data || [] });
  } catch (err: any) {
    console.error('List tool calls endpoint failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
