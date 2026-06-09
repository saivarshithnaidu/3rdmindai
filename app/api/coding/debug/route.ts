import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import codingAgentService from '../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, code, error: errorMessage, language, projectId } = body;

    if (!code || !errorMessage || !language) {
      return NextResponse.json({ error: 'Missing required parameters: code, error, language' }, { status: 400 });
    }

    const fixResult = await codingAgentService.debugCode(sessionId || null, code, errorMessage, language);

    // If session exists, update the code file with the fix
    if (sessionId) {
      const supabase = supabaseService.getServiceClient();
      const { data: firstFile } = await supabase
        .from('code_files')
        .select('*')
        .eq('session_id', sessionId)
        .limit(1)
        .maybeSingle();

      if (firstFile && fixResult.fixed_code) {
        await supabase
          .from('code_files')
          .update({
            content: fixResult.fixed_code,
            version: firstFile.version + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', firstFile.id);
      } else if (fixResult.fixed_code) {
        // Create a new code file if none exists yet
        await supabase
          .from('code_files')
          .insert({
            session_id: sessionId,
            file_path: `main.${language === 'python' ? 'py' : 'ts'}`,
            language,
            content: fixResult.fixed_code,
            version: 1
          });
      }
    }

    return NextResponse.json({ success: true, ...fixResult });
  } catch (err: any) {
    console.error('Debug API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
