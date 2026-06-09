import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

interface ImageGenerationOptions {
  model?: 'flux-pro' | 'flux-dev' | 'sdxl';
  width?: number;
  height?: number;
  negativePrompt?: string;
  style?: 'photorealistic' | 'illustration' | 'logo' | 'minimal' | '3d' | 'cartoon';
  projectId: string;
  agentId?: string;
  messageId?: string;
  taskContext?: string;
}

interface GeneratedImageResult {
  imageUrl: string;
  storagePath: string | null;
  imageId: string;
}

const FAL_MODELS: Record<string, string> = {
  'flux-pro': 'fal-ai/flux-pro',
  'flux-dev': 'fal-ai/flux/dev',
  'sdxl': 'fal-ai/fast-sdxl',
};

export const imageService = {

  async enhancePrompt(prompt: string, style: string, model: string, taskContext?: string): Promise<string> {
    const system = `You are a professional image prompt engineer. Enhance the given prompt for ${model} image generation.

Return ONLY the enhanced prompt text. Do not include any explanations, quotes, or extra formatting. Just the prompt.

Guidelines:
- Add style descriptors, lighting, composition, quality tags
- Keep the core intent of the original prompt
- Make it specific and detailed for AI image generation
- If style is "photorealistic", add: 8k, ultra detailed, professional photography
- If style is "illustration", add: digital art, vibrant colors, detailed illustration
- If style is "logo", add: minimalist, vector style, clean lines, professional logo design
- If style is "minimal", add: clean, simple, modern, white space
- If style is "3d", add: 3D render, octane render, studio lighting, detailed
- If style is "cartoon", add: cartoon style, fun, colorful, expressive`;

    const userContent = `Original prompt: ${prompt}
Style: ${style}
${taskContext ? `Context: ${taskContext}` : ''}

Write an enhanced prompt:`;

    try {
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: userContent }],
        'deepseek/deepseek-chat'
      );
      return response.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      console.error('Prompt enhancement failed, using original:', err);
      return prompt;
    }
  },

  async generateImage(prompt: string, options: ImageGenerationOptions): Promise<GeneratedImageResult> {
    const supabase = supabaseService.getServiceClient();
    const model = options.model || 'flux-pro';
    const width = options.width || 1024;
    const height = options.height || 1024;
    const style = options.style || 'photorealistic';
    const { projectId, agentId, messageId, taskContext } = options;

    // Emit start
    emit(projectId, StreamEventType.AGENT_STARTED, `Generating image with ${model}...`, {
      agentName: 'Image Generator',
      agentRole: 'creative',
      detail: prompt.substring(0, 100),
      status: 'running',
    });

    try {
      // Step 1: Enhance prompt
      emit(projectId, StreamEventType.AGENT_THINKING, 'Enhancing prompt for optimal results...', {
        agentName: 'Image Generator',
        status: 'running',
      });

      const enhancedPrompt = await this.enhancePrompt(prompt, style, model, taskContext);

      // Step 2: Call fal.ai
      emit(projectId, StreamEventType.AGENT_THINKING, `Rendering image with ${model}...`, {
        agentName: 'Image Generator',
        status: 'running',
        detail: enhancedPrompt.substring(0, 120),
      });

      const falKey = process.env.FAL_KEY;
      if (!falKey) {
        throw new Error('FAL_KEY environment variable is not set');
      }

      const falModel = FAL_MODELS[model] || 'fal-ai/flux-pro';

      // Call fal.ai REST API directly
      const falResponse = await fetch(`https://queue.fal.run/${falModel}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          negative_prompt: options.negativePrompt || 'blurry, low quality, distorted, watermark, text overlay, nsfw',
          image_size: { width, height },
          num_images: 1,
          enable_safety_checker: true,
        }),
      });

      if (!falResponse.ok) {
        const errText = await falResponse.text();
        throw new Error(`fal.ai error ${falResponse.status}: ${errText}`);
      }

      const falResult = await falResponse.json();

      // Handle queued responses — poll for result
      let imageUrl: string;
      if (falResult.images && falResult.images.length > 0) {
        imageUrl = falResult.images[0].url;
      } else if (falResult.request_id) {
        // Poll for result
        const requestId = falResult.request_id;
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;

          const statusRes = await fetch(`https://queue.fal.run/${falModel}/requests/${requestId}/status`, {
            headers: { 'Authorization': `Key ${falKey}` },
          });
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            const resultRes = await fetch(`https://queue.fal.run/${falModel}/requests/${requestId}`, {
              headers: { 'Authorization': `Key ${falKey}` },
            });
            const resultData = await resultRes.json();
            if (resultData.images && resultData.images.length > 0) {
              imageUrl = resultData.images[0].url;
              break;
            }
            throw new Error('No images in fal.ai result');
          } else if (statusData.status === 'FAILED') {
            throw new Error(`fal.ai generation failed: ${statusData.error || 'unknown error'}`);
          }
        }

        if (!imageUrl!) {
          throw new Error('fal.ai generation timed out');
        }
      } else {
        throw new Error('Unexpected fal.ai response format');
      }

      // Step 3: Save to Supabase Storage
      let storagePath: string | null = null;
      let publicUrl: string = imageUrl;

      try {
        const imgResponse = await fetch(imageUrl);
        if (imgResponse.ok) {
          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          const fileName = `${projectId}/${crypto.randomUUID()}.png`;

          const { error: uploadErr } = await supabase.storage
            .from('images')
            .upload(fileName, buffer, {
              contentType: 'image/png',
              upsert: false,
            });

          if (!uploadErr) {
            storagePath = fileName;
            const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
            if (urlData?.publicUrl) {
              publicUrl = urlData.publicUrl;
            }
          } else {
            console.warn('Storage upload failed, using fal.ai URL directly:', uploadErr.message);
          }
        }
      } catch (storageErr) {
        console.warn('Storage upload error, using fal.ai URL:', storageErr);
      }

      // Step 4: Save to generated_images table
      const { data: imageRow, error: insertErr } = await supabase
        .from('generated_images')
        .insert({
          project_id: projectId,
          agent_id: agentId || null,
          message_id: messageId || null,
          prompt: enhancedPrompt,
          negative_prompt: options.negativePrompt || null,
          model,
          width,
          height,
          image_url: publicUrl,
          storage_path: storagePath,
          task_context: taskContext || null,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Failed to save image record:', insertErr);
        throw insertErr;
      }

      // Step 5: Emit completion
      emit(projectId, StreamEventType.AGENT_COMPLETE, 'Image generated successfully', {
        agentName: 'Image Generator',
        status: 'done',
        data: {
          imageUrl: publicUrl,
          imageId: imageRow.id,
          model,
          dimensions: `${width}x${height}`,
        },
      });

      return {
        imageUrl: publicUrl,
        storagePath,
        imageId: imageRow.id,
      };
    } catch (err: any) {
      console.error('Image generation failed:', err);
      emit(projectId, StreamEventType.STREAM_ERROR, `Image generation failed: ${err.message}`, {
        agentName: 'Image Generator',
        status: 'error',
      });
      throw err;
    }
  },

  async generateAdCreative(
    adCopy: { headline: string; body?: string },
    brandContext: { industry: string; companyName?: string },
    projectId: string,
    agentId?: string
  ): Promise<GeneratedImageResult> {
    const prompt = `Professional advertisement creative. ${brandContext.industry} brand${
      brandContext.companyName ? ` for ${brandContext.companyName}` : ''
    }. Clean, modern design. Message: ${adCopy.headline}. Style: Professional marketing photo, high contrast, brand colors implied, no text overlay needed`;

    return this.generateImage(prompt, {
      projectId,
      agentId,
      style: 'minimal',
      width: 1200,
      height: 628,
      model: 'flux-pro',
      taskContext: 'Ad creative generation',
    });
  },

  async generateSocialPost(
    topic: string,
    platform: 'linkedin' | 'twitter' | 'instagram' | 'story',
    brandContext: { industry: string; companyName?: string },
    projectId: string,
    agentId?: string
  ): Promise<GeneratedImageResult> {
    const sizes: Record<string, { width: number; height: number }> = {
      linkedin: { width: 1200, height: 627 },
      twitter: { width: 1600, height: 900 },
      instagram: { width: 1080, height: 1080 },
      story: { width: 1080, height: 1920 },
    };

    const { width, height } = sizes[platform] || sizes.linkedin;

    const prompt = `Professional social media post image for ${platform}. Topic: ${topic}. ${
      brandContext.industry
    } industry. Clean, modern, engaging visual. No text overlay. Professional quality.`;

    return this.generateImage(prompt, {
      projectId,
      agentId,
      style: 'photorealistic',
      width,
      height,
      model: 'flux-pro',
      taskContext: `${platform} social post`,
    });
  },

  async generateProductMockup(
    productDescription: string,
    style: string,
    projectId: string,
    agentId?: string
  ): Promise<GeneratedImageResult> {
    const prompt = `Professional product mockup. ${productDescription}. Clean white background. Studio lighting. Commercial photography quality. No text.`;

    return this.generateImage(prompt, {
      projectId,
      agentId,
      style: 'photorealistic',
      width: 1024,
      height: 1024,
      model: 'flux-pro',
      taskContext: 'Product mockup',
    });
  },

  async generateLogo(
    brandName: string,
    industry: string,
    logoStyle: string,
    colors: string,
    projectId: string,
    agentId?: string
  ): Promise<GeneratedImageResult> {
    const prompt = `Minimalist logo design for ${brandName}. ${industry} company. Style: ${logoStyle}. Colors: ${colors}. Clean vector style. White background. Professional. No text except brand name.`;

    return this.generateImage(prompt, {
      projectId,
      agentId,
      style: 'logo',
      width: 512,
      height: 512,
      model: 'flux-pro',
      taskContext: 'Logo generation',
    });
  },

  async generatePresentation(
    slideTitle: string,
    content: string,
    projectId: string,
    agentId?: string
  ): Promise<GeneratedImageResult> {
    const prompt = `Professional presentation slide background. Topic: ${slideTitle}. ${content}. Clean, modern, professional. Subtle gradient or abstract design. No text. Corporate quality.`;

    return this.generateImage(prompt, {
      projectId,
      agentId,
      style: 'minimal',
      width: 1920,
      height: 1080,
      model: 'flux-dev',
      taskContext: 'Presentation slide',
    });
  },
};

export default imageService;
