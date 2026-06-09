import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import codingAgentService from '../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId: reqSessionId, code, language, type: reviewType = 'full', projectId } = body;

    if (!code || !language) {
      return NextResponse.json({ error: 'Missing required parameters: code, language' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    let sessionId = reqSessionId;

    // Create a dummy session if none is provided to ensure referential integrity
    if (!sessionId) {
      if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
      }

      const { data: session, error: sessErr } = await supabase
        .from('coding_sessions')
        .insert({
          project_id: projectId,
          user_id: '00000000-0000-0000-0000-000000000000',
          mode: 'review',
          language,
          description: `Single file review (${language})`,
          status: 'complete'
        })
        .select()
        .single();

      if (sessErr || !session) {
        throw new Error(`Failed to create review session: ${sessErr?.message}`);
      }

      sessionId = session.id;
    }

    const review = await codingAgentService.reviewCode(sessionId, code, language, reviewType);

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    console.error('Review API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
