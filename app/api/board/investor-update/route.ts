import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import { openrouterService } from '../../../../services/openrouter.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    // Fetch memories
    const { data: memories } = await supabase
      .from('agent_memory')
      .select('content')
      .eq('project_id', projectId);

    const memoriesText = (memories || []).map(m => m.content).join('\n');

    // Fetch project details
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    const companyName = project?.name || 'Startup';

    const system = `You are a professional venture capitalist relations manager. Generate a high-quality, monthly investor update email for ${companyName} based on the memories and activities log provided.
    Format as:
    SUBJECT: ${companyName} - [Month/Year] Update
    TL;DR: 1-paragraph summary
    HIGHLIGHTS: Bullet points of wins/achievements
    METRICS: User/revenue growth (estimate/synthesize based on context)
    TEAM UPDATE: Key activities of Chairman, CTO, CMO, CFO, CSO, CRO
    NEXT MONTH FOCUS: Core priorities
    ASKS: 2 bullet points of startup support requests
    Just return the final update text in clean markdown.`;

    const updateText = await openrouterService.callModel(system, [{ role: 'user', content: memoriesText }], 'deepseek/deepseek-chat');

    return NextResponse.json({ success: true, update: updateText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
