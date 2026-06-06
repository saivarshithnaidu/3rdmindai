import { NextRequest, NextResponse } from 'next/server';
import { artifactService } from '../../../../services/artifact.service';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const detection = await artifactService.detectArtifactRequest(message);

    return NextResponse.json(detection);
  } catch (error) {
    console.error('Error in /api/artifact/detect:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
