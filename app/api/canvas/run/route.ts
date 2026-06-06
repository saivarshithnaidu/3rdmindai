import { NextRequest, NextResponse } from 'next/server';
import { dataAgentService } from '../../../../services/data-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { canvasId, query, columns, mode, enrichmentItems, rowsTarget } = await req.json();

    if (!canvasId || !query || !columns || !mode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Trigger execution in the background
    if (mode === 'enrich') {
      const items = Array.isArray(enrichmentItems) ? enrichmentItems : [];
      dataAgentService.runEnrichMode(canvasId, items, columns).catch((err) => {
        console.error('Error in background runEnrichMode:', err);
      });
    } else {
      const target = rowsTarget || 20;
      dataAgentService.runSearchMode(canvasId, query, columns, target).catch((err) => {
        console.error('Error in background runSearchMode:', err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in /api/canvas/run:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
