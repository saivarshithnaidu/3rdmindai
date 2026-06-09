import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: files, error } = await supabase
      .from('code_files')
      .select('*')
      .eq('session_id', sessionId)
      .order('file_path', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, files: files || [] });
  } catch (err: any) {
    console.error('List files API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
