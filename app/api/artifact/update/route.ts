import { NextRequest, NextResponse } from 'next/server';
import { artifactService } from '../../../../services/artifact.service';
import { DEFAULT_ORCHESTRATOR_MODEL } from '../../../../lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { artifactId, changeRequest, currentCode, version, model } = await req.json();

    if (!artifactId || !changeRequest || !currentCode || typeof version !== 'number') {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const selectedModel = model || DEFAULT_ORCHESTRATOR_MODEL;

    // 1. Call streamModel for updating
    const stream = artifactService.updateArtifactStream(
      artifactId,
      changeRequest,
      currentCode,
      selectedModel
    );
    
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    let accumulatedCode = '';
    const newVersion = version + 1;
    
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const chunkText = decoder.decode(value, { stream: true });
            accumulatedCode += chunkText;
            controller.enqueue(value);
          }
          
          // Once done, clean the code and save it
          let cleaned = accumulatedCode.trim();
          if (cleaned.startsWith('```html')) {
            cleaned = cleaned.slice(7);
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
          }
          if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
          }
          cleaned = cleaned.trim();
          
          await artifactService.saveUpdatedArtifact(
            artifactId,
            cleaned,
            newVersion
          );
          
          controller.close();
        } catch (err) {
          console.error("Stream update/save failed:", err);
          controller.error(err);
        }
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Artifact-Id': artifactId,
        'X-Artifact-Version': String(newVersion),
      }
    });
  } catch (error) {
    console.error('Error in /api/artifact/update:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
