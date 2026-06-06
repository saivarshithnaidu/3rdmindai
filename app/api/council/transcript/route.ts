import { NextRequest, NextResponse } from 'next/server';
import { orchestratorService } from '../../../../services/orchestrator.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const managerId = searchParams.get('managerId');
    const projectId = searchParams.get('projectId');

    if (!managerId || !projectId) {
      return NextResponse.json({ error: 'Missing managerId or projectId' }, { status: 400 });
    }

    const markdown = await orchestratorService.generateCouncilTranscript(managerId, projectId);

    const encoder = new TextEncoder();
    const data = encoder.encode(markdown);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="council-transcript-${managerId}.md"`,
      },
    });
  } catch (error) {
    console.error('Error in /api/council/transcript:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
