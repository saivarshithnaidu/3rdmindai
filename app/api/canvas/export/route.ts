import { NextRequest, NextResponse } from 'next/server';
import { dataAgentService } from '../../../../services/data-agent.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const canvasId = searchParams.get('canvasId');

    if (!canvasId) {
      return NextResponse.json({ error: 'Missing canvasId' }, { status: 400 });
    }

    const buffer = await dataAgentService.exportToXlsx(canvasId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="export-${canvasId}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error in /api/canvas/export:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
