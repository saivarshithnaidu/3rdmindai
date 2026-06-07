import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId query parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getClient();
    const { data: leads, error } = await supabase
      .from('outreach_leads')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ leads });
  } catch (err: any) {
    console.error('Error in outreach leads API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
