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

    // 1. Fetch project details
    const { data: project } = await supabase
      .from('projects')
      .select('name, goal')
      .eq('id', projectId)
      .single();

    const projectName = project?.name || 'My Startup';
    const projectGoal = project?.goal || 'Scale customer acquisition and optimize product delivery.';

    // 2. Fetch active agents to name the speakers correctly
    const { data: agents } = await supabase
      .from('startup_agents')
      .select('name, role')
      .eq('project_id', projectId);

    const agentNames = (agents || []).reduce((acc, a) => {
      acc[a.role.toLowerCase()] = a.name;
      return acc;
    }, {} as Record<string, string>);

    const ceoName = agentNames['ceo'] || 'Arthur Pendragon';
    const ctoName = agentNames['cto'] || 'Elena Rostova';
    const cmoName = agentNames['cmo'] || 'Marcus Vance';
    const cfoName = agentNames['cfo'] || 'Sarah Jenkins';
    const csoName = agentNames['cso'] || 'Diana Prince';
    const croName = agentNames['cro'] || 'Victor Stone';

    const system = `You are a corporate board secretary. You need to simulate a professional Board of Directors meeting for the startup "${projectName}" (Goal: "${projectGoal}").
    
    The board consists of:
    - CEO/Chairman: ${ceoName}
    - CTO (Technical Advisor): ${ctoName}
    - CMO (Brand Director): ${cmoName}
    - CFO (Finance Director): ${cfoName}
    - CSO (Strategy Director): ${csoName}
    - CRO (Growth Director): ${croName}

    You must output a single JSON block. Do not include markdown code block characters like \`\`\`json. The output must parse exactly as this JSON structure:
    {
      "transcript": [
        { "speaker": "CEO", "name": "${ceoName}", "text": "speech text here" },
        { "speaker": "CTO", "name": "${ctoName}", "text": "speech text here" },
        { "speaker": "CMO", "name": "${cmoName}", "text": "speech text here" },
        { "speaker": "CFO", "name": "${cfoName}", "text": "speech text here" },
        { "speaker": "CSO", "name": "${csoName}", "text": "speech text here" },
        { "speaker": "CRO", "name": "${croName}", "text": "speech text here" },
        { "speaker": "CEO", "name": "${ceoName}", "text": "concluding speech proposing the resolution" }
      ],
      "minutes": "Meeting minutes in clean markdown",
      "proposedResolution": {
        "title": "Proposed strategic change title",
        "resolution": "Full proposed resolution text"
      }
    }

    The discussion should focus on hitting the core goal, addressing runway/market challenges, and formulating a specific strategic pivot or budget reallocation that triggers the proposed resolution. Make each speaker's statement 2-3 sentences.`;

    const userPrompt = `Simulate the meeting for ${projectName}. Ensure the proposed resolution matches the discussion points.`;

    const rawResponse = await openrouterService.callModel(
      system,
      [{ role: 'user', content: userPrompt }],
      'deepseek/deepseek-chat'
    );

    let parsed;
    try {
      const cleaned = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse board convenement JSON, raw response:', rawResponse);
      throw new Error('LLM response was not valid JSON');
    }

    // 3. Insert the proposed board resolution into the database
    if (parsed.proposedResolution) {
      const { error: insErr } = await supabase
        .from('board_resolutions')
        .insert({
          project_id: projectId,
          title: parsed.proposedResolution.title,
          resolution: parsed.proposedResolution.resolution,
          proposed_by: ceoName,
          status: 'proposed'
        });
      
      if (insErr) {
        console.error('Failed to auto-insert resolution from meeting:', insErr);
      }
    }

    return NextResponse.json({ success: true, ...parsed });
  } catch (err: any) {
    console.error('Convene meeting error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
