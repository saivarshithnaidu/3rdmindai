import { NextRequest, NextResponse } from 'next/server';
import autoDeployService from '../../../../../services/auto-deploy.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, projectId } = body;

    if (!sessionId || !projectId) {
      return NextResponse.json({ error: 'Missing parameters: sessionId, projectId' }, { status: 400 });
    }

    await autoDeployService.autoDeployPipeline(sessionId, projectId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('QStash deploy worker failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
