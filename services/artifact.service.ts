import { supabaseService } from './supabase.service';
import { openrouterService } from './openrouter.service';
import { Artifact } from '../types';

export const artifactService = {
  async detectArtifactRequest(message: string): Promise<{
    isArtifactRequest: boolean;
    type?: 'app' | 'document' | 'chart' | 'tool' | 'game' | 'code';
    title?: string;
  }> {
    const system = `You are a classifier that detects if a user's prompt is a request to build, generate, or render a standalone interactive visual component, dashboard, single-page web application, document, custom chart, SVG graphic, interactive utility/tool (like a timer, calculator), or game.
Respond ONLY with a JSON object. No markdown formatting.

Expected JSON output formats:
If it warrants an interactive component/artifact:
{
  "isArtifactRequest": true,
  "type": "app" | "document" | "chart" | "tool" | "game" | "code",
  "title": "A short, descriptive, professional title for the component (e.g., 'Pomodoro Timer', 'Interactive Pitch Deck', 'SaaS Dashboard')"
}

Otherwise:
{
  "isArtifactRequest": false
}
`;

    try {
      const responseText = await openrouterService.callModel(
        system,
        [{ role: 'user', content: message }],
        'deepseek/deepseek-chat'
      );

      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error('Failed to detect artifact request:', err);
      return { isArtifactRequest: false };
    }
  },

  async generateArtifact(
    prompt: string,
    type: 'app' | 'document' | 'chart' | 'tool' | 'game' | 'code',
    model = 'deepseek/deepseek-chat'
  ): Promise<string> {
    const system = `You are a premium software developer. You generate high-quality, self-contained HTML single-file interactive components, applications, dashboards, or charts based on the user request.
The file must include ALL CSS (vanilla CSS, Tailwind CSS, or component-specific styles) inside a <style> block, and ALL JavaScript logic inside a <script> block.
Include external scripts/libraries (e.g. Chart.js, Lucide Icons, FontAwesome, GSAP, Canvas-Confetti, Tailwind CSS CDN if needed) via official public CDNs if helpful.
The UI must look premium, modern, clean, responsive, and visually stunning (e.g., using modern sans-serif typography like Inter/Outfit from Google Fonts, elegant colors, smooth micro-animations, glassmorphism, or clean dark mode styling).
Do NOT include any markdown formatting, explanation, or code blocks in your response. Output ONLY the raw HTML content starting with <!DOCTYPE html> and ending with </html>.
Response must be clean, bug-free, and directly runnable in a sandboxed iframe.`;

    try {
      const responseText = await openrouterService.callModel(
        system,
        [{ role: 'user', content: `Request: Generate a ${type} for: ${prompt}` }],
        model
      );

      // Clean up response if the model wrapped it in markdown code blocks despite instructions
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```html')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      return cleaned.trim();
    } catch (err) {
      console.error('Failed to generate artifact:', err);
      throw err;
    }
  },

  generateArtifactStream(
    prompt: string,
    type: 'app' | 'document' | 'chart' | 'tool' | 'game' | 'code',
    model = 'deepseek/deepseek-chat'
  ): ReadableStream {
    const system = `You are a premium software developer. You generate high-quality, self-contained HTML single-file interactive components, applications, dashboards, or charts based on the user request.
The file must include ALL CSS (vanilla CSS, Tailwind CSS, or component-specific styles) inside a <style> block, and ALL JavaScript logic inside a <script> block.
Include external scripts/libraries (e.g. Chart.js, Lucide Icons, FontAwesome, GSAP, Canvas-Confetti, Tailwind CSS CDN if needed) via official public CDNs if helpful.
The UI must look premium, modern, clean, responsive, and visually stunning (e.g., using modern sans-serif typography like Inter/Outfit from Google Fonts, elegant colors, smooth micro-animations, glassmorphism, or clean dark mode styling).
Do NOT include any markdown formatting, explanation, or code blocks in your response. Output ONLY the raw HTML content starting with <!DOCTYPE html> and ending with </html>.
Response must be clean, bug-free, and directly runnable in a sandboxed iframe.`;

    return openrouterService.streamModel(
      system,
      [{ role: 'user', content: `Request: Generate a ${type} for: ${prompt}` }],
      model
    );
  },

  async updateArtifact(
    artifactId: string,
    changeRequest: string,
    currentCode: string,
    model = 'deepseek/deepseek-chat'
  ): Promise<string> {
    const system = `You are a premium software developer updating an existing interactive HTML component.
Here is the current HTML code:
---
${currentCode}
---

The user has requested the following change or addition:
---
${changeRequest}
---

Modify the code carefully. Maintain all existing functionality unless explicitly asked to change it. Ensure the resulting HTML is self-contained (all CSS/JS inline) and directly runnable in an iframe sandbox.
Output ONLY the raw modified HTML code starting with <!DOCTYPE html> and ending with </html>. Do not wrap in markdown or include any explanations.`;

    try {
      const responseText = await openrouterService.callModel(
        system,
        [{ role: 'user', content: 'Apply the requested change.' }],
        model
      );

      let cleaned = responseText.trim();
      if (cleaned.startsWith('```html')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      return cleaned.trim();
    } catch (err) {
      console.error('Failed to update artifact:', err);
      throw err;
    }
  },

  updateArtifactStream(
    artifactId: string,
    changeRequest: string,
    currentCode: string,
    model = 'deepseek/deepseek-chat'
  ): ReadableStream {
    const system = `You are a premium software developer updating an existing interactive HTML component.
Here is the current HTML code:
---
${currentCode}
---

The user has requested the following change or addition:
---
${changeRequest}
---

Modify the code carefully. Maintain all existing functionality unless explicitly asked to change it. Ensure the resulting HTML is self-contained (all CSS/JS inline) and directly runnable in an iframe sandbox.
Output ONLY the raw modified HTML code starting with <!DOCTYPE html> and ending with </html>. Do not wrap in markdown or include any explanations.`;

    return openrouterService.streamModel(
      system,
      [{ role: 'user', content: 'Apply the requested change.' }],
      model
    );
  },

  async saveArtifact(
    projectId: string,
    agentId: string | null,
    type: 'app' | 'document' | 'chart' | 'tool' | 'game' | 'code',
    title: string,
    code: string
  ): Promise<Artifact> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('artifacts')
      .insert({
        project_id: projectId,
        agent_id: agentId,
        type,
        title,
        code,
        version: 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save artifact: ${error.message}`);
    }
    return data as Artifact;
  },

  async saveUpdatedArtifact(
    artifactId: string,
    code: string,
    newVersion: number
  ): Promise<Artifact> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('artifacts')
      .update({
        code,
        version: newVersion,
      })
      .eq('id', artifactId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save updated artifact: ${error.message}`);
    }
    return data as Artifact;
  },

  async getProjectArtifacts(projectId: string): Promise<Artifact[]> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch project artifacts: ${error.message}`);
    }
    return data as Artifact[];
  },

  async getArtifact(artifactId: string): Promise<Artifact> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', artifactId)
      .single();

    if (error) {
      throw new Error(`Failed to get artifact: ${error.message}`);
    }
    return data as Artifact;
  }
};

export default artifactService;
