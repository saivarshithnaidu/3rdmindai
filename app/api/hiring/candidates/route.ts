import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const candidateId = searchParams.get('candidateId');
    const status = searchParams.get('status');
    const supabase = supabaseService.getServiceClient();

    // If candidateId is provided, fetch detailed profile
    if (candidateId) {
      const { data: candidate, error: candErr } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (candErr || !candidate) {
        return NextResponse.json({ error: candErr?.message || 'Candidate not found' }, { status: 404 });
      }

      // Fetch related emails
      const { data: emails } = await supabase
        .from('candidate_emails')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

      // Fetch related interviews
      const { data: interviews } = await supabase
        .from('interviews')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('scheduled_at', { ascending: false });

      return NextResponse.json({ 
        success: true, 
        candidate, 
        emails: emails || [], 
        interviews: interviews || [] 
      });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    let query = supabase
      .from('candidates')
      .select('*')
      .eq('job_id', jobId);
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: candidates, error } = await query.order('match_score', { ascending: false, nullsFirst: false });
    if (error) throw error;

    return NextResponse.json({ success: true, candidates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { candidateId, status } = await req.json();
    if (!candidateId || !status) {
      return NextResponse.json({ error: 'Missing candidateId or status' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: candidate, error } = await supabase
      .from('candidates')
      .update({ status })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, candidate });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
