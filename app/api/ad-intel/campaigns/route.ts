import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: campaigns, error } = await supabase
      .from('generated_campaigns')
      .select('*, competitor:competitor_profiles(competitor_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaigns });
  } catch (error: any) {
    console.error('Error in /api/ad-intel/campaigns:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
