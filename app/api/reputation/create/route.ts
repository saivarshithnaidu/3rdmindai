import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = supabaseService.getServiceClient();
    const { data: monitor, error } = await supabase
      .from('reputation_monitors')
      .insert({
        project_id: body.projectId,
        brand_name: body.brandName,
        keywords: body.keywords || [],
        platforms: body.platforms || [],
        check_interval: body.checkInterval || 24,
        auto_respond: body.autoRespond || false
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, monitor });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
