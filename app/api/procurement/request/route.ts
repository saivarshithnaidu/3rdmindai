import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import procurementService from '../../../../services/procurement.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requirement, budget, projectId, timeline } = body;

    if (!projectId || !requirement) {
      return NextResponse.json({ error: 'Missing required fields: projectId, requirement' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    // Create the request row
    const { data: request, error } = await supabase
      .from('procurement_requests')
      .insert({
        project_id: projectId,
        requirement,
        budget: budget || null,
        timeline: timeline || null
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger researchRequirement in background
    setTimeout(() => {
      procurementService.researchRequirement(request.id).catch((err) => {
        console.error('Background researchRequirement failed:', err);
      });
    }, 0);

    return NextResponse.json({ success: true, requestId: request.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId query parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    const { data: requests, error } = await supabase
      .from('procurement_requests')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, requests: requests || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
