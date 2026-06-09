import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }
    const supabase = supabaseService.getServiceClient();
    const { data: jobs, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, jobs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = supabaseService.getServiceClient();
    const { data: job, error } = await supabase
      .from('job_postings')
      .insert({
        project_id: body.projectId,
        title: body.title,
        department: body.department,
        location: body.location,
        work_type: body.workType || 'remote',
        salary_min: body.salaryMin || null,
        salary_max: body.salaryMax || null,
        currency: body.currency || 'INR',
        requirements: body.requirements,
        nice_to_have: body.niceToHave || null,
        status: 'draft'
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
