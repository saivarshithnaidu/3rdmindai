import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');

    const supabase = supabaseService.getServiceClient();
    let query = supabase.from('price_watches').select('*');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Sort by created_at desc
    const { data: watches, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Database error in price watch list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, watches });
  } catch (error: any) {
    console.error('Error in /api/price-watch/list:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
