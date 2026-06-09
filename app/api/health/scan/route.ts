import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import websiteHealthService from '../../../../services/website-health.service';

export async function POST(req: NextRequest) {
  try {
    const { targetUrl, projectId } = await req.json();
    if (!targetUrl || !projectId) {
      return NextResponse.json({ error: 'Missing targetUrl or projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    // Insert scan with 'running' status
    const { data: scan, error: insertErr } = await supabase
      .from('health_scans')
      .insert({
        project_id: projectId,
        target_url: targetUrl,
        status: 'running',
        score: null,
        checks_passed: 0,
        checks_failed: 0
      })
      .select()
      .single();

    if (insertErr || !scan) {
      return NextResponse.json({ error: `Failed to initialize scan: ${insertErr?.message}` }, { status: 500 });
    }

    // Trigger analysis in background
    setTimeout(async () => {
      try {
        await websiteHealthService.runHealthScan(scan.id, targetUrl);
      } catch (err) {
        console.error('Background health scan failed:', err);
      }
    }, 100);

    return NextResponse.json({ success: true, scanId: scan.id, message: 'Health scan triggered in background' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
