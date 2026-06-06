import { NextRequest, NextResponse } from 'next/server';
import { dataAgentService } from '../../../../services/data-agent.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, agentId, message, rowsTarget } = await req.json();

    if (!projectId || !message) {
      return NextResponse.json({ error: 'Missing projectId or message' }, { status: 400 });
    }

    // 1. Detect if this is a structured data request
    const detection = await dataAgentService.detectDataRequest(message);

    if (!detection.isDataRequest || !detection.mode || !detection.name) {
      return NextResponse.json({ isDataRequest: false });
    }

    // 2. Infer column schemas
    const columns = await dataAgentService.inferSchema(message, detection.mode);

    // 3. Create canvas in database
    const canvas = await dataAgentService.createCanvas(
      projectId,
      agentId || null,
      detection.name,
      columns,
      detection.mode,
      detection.rowsTarget || rowsTarget || 20
    );

    return NextResponse.json({
      isDataRequest: true,
      mode: detection.mode,
      enrichmentItems: detection.enrichmentItems || [],
      canvas,
    });
  } catch (error) {
    console.error('Error in /api/canvas/create:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
