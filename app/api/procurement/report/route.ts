import { NextRequest, NextResponse } from 'next/server';
import procurementService from '../../../../services/procurement.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId query parameter' }, { status: 400 });
    }

    const report = await procurementService.generateStackReport(projectId);

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
