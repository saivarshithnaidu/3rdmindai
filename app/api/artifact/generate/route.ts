import { NextRequest, NextResponse } from 'next/server';
import { artifactService } from '../../../../services/artifact.service';
import { DEFAULT_ORCHESTRATOR_MODEL } from '../../../../lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { projectId, agentId, prompt, type, title, model } = await req.json();

    if (!projectId || !prompt || !type || !title) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const selectedModel = model || DEFAULT_ORCHESTRATOR_MODEL;

    // 1. Save empty placeholder artifact to DB to get its ID
    const artifact = await artifactService.saveArtifact(
      projectId,
      agentId || null,
      type,
      title,
      "" // placeholder
    );

    // 2. Call streamModel
    const stream = artifactService.generateArtifactStream(prompt, type, selectedModel);
    
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    let accumulatedCode = '';
    
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
          
          // Once the stream is done, clean the code and save it to the DB
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
            artifact.id,
            cleaned,
            1
          );
          
          controller.close();
        } catch (err) {
          console.error("Stream compilation/save failed:", err);
          controller.error(err);
        }
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Artifact-Id': artifact.id,
        'X-Artifact-Title': artifact.title,
        'X-Artifact-Type': artifact.type,
        'X-Artifact-Version': '1',
      }
    });
  } catch (error) {
    console.error('Error in /api/artifact/generate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
