import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scanId = searchParams.get('scanId');

    if (!scanId) {
      return NextResponse.json({ error: 'Missing scanId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    // 1. Fetch scan metadata
    const { data: scan, error: scanErr } = await supabase
      .from('health_scans')
      .select('*')
      .eq('id', scanId)
      .single();

    if (scanErr || !scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // 2. Fetch findings
    const { data: findings, error: findingsErr } = await supabase
      .from('health_findings')
      .select('*')
      .eq('scan_id', scanId)
      .order('priority', { ascending: false }); // High priority first (or custom ordering logic)

    if (findingsErr) {
      return NextResponse.json({ error: findingsErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, scan, findings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
