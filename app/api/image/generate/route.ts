import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import { imageService } from '../../../../services/image.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, style, width, height, model, projectId, agentId, messageId, negativePrompt, taskContext } = body;

    if (!prompt || !projectId) {
      return NextResponse.json({ error: 'Missing prompt or projectId' }, { status: 400 });
    }

    // Fire image generation in background
    setTimeout(async () => {
      try {
        await imageService.generateImage(prompt, {
          model: model || 'flux-pro',
          width: width || 1024,
          height: height || 1024,
          negativePrompt: negativePrompt || undefined,
          style: style || 'photorealistic',
          projectId,
          agentId: agentId || undefined,
          messageId: messageId || undefined,
          taskContext: taskContext || undefined,
        });
      } catch (err) {
        console.error('Background image generation failed:', err);
      }
    }, 100);

    return NextResponse.json({
      success: true,
      message: 'Image generation started...',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
