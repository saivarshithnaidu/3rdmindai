import { NextRequest, NextResponse } from 'next/server';
import codebaseIntelligenceService from '../../../../../services/codebase-intelligence.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, source, githubRepo, userId, sessionId } = body;

    if (!projectId || !source) {
      return NextResponse.json({ error: 'Missing parameters: projectId, source' }, { status: 400 });
    }

    if (source === 'github') {
      await codebaseIntelligenceService.indexCodebase(projectId, 'github', {
        repo: githubRepo,
        userId: userId || '00000000-0000-0000-0000-000000000000'
      });
    } else if (source === 'session') {
      await codebaseIntelligenceService.indexCodebase(projectId, 'session', { sessionId });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('QStash Indexing worker failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
