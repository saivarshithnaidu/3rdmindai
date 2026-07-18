import { NextRequest, NextResponse } from 'next/server';
import codebaseIntelligenceService from '../../../../services/codebase-intelligence.service';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const query = url.searchParams.get('query');

    if (!projectId || !query) {
      return NextResponse.json({ error: 'Missing parameters: projectId, query' }, { status: 400 });
    }

    const results = await codebaseIntelligenceService.searchCodebase(projectId, query);
    const context = await codebaseIntelligenceService.buildCodeContext(projectId, query);

    return NextResponse.json({ success: true, results, context });
  } catch (err: any) {
    console.error('Codebase search API failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
