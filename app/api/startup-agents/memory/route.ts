import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import agentMemoryService from '../../../../services/agent-memory.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const projectId = searchParams.get('projectId') || '';
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    const supabase = supabaseService.getClient();

    if (query.trim() && projectId) {
      try {
        const { default: embeddingService } = await import('../../../../services/embedding.service');
        const matches = await embeddingService.semanticRecall(agentId, projectId, query, limit, 0.7);
        // Map to format consistent with memories
        const mappedMatches = matches.map(m => ({
          id: m.id,
          agent_id: agentId,
          project_id: projectId,
          memory_type: m.memory_type,
          content: m.content,
          similarity: m.similarity
        }));
        return NextResponse.json({ memory: mappedMatches });
      } catch (err) {
        console.error('Semantic search failed in route, falling back to database text match:', err);
      }
    }

    let dbQuery = supabase
      .from('agent_memory')
      .select('*')
      .eq('agent_id', agentId);

    if (projectId) {
      dbQuery = dbQuery.eq('project_id', projectId);
    }
    if (query.trim()) {
      dbQuery = dbQuery.ilike('content', `%${query}%`);
    }

    const { data: memory, error } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ memory });
  } catch (err: any) {
    console.error('Error in startup-agents memory GET route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, projectId, memoryType, content } = await req.json();

    if (!agentId || !projectId || !memoryType || !content) {
      return NextResponse.json(
        { error: 'Missing agentId, projectId, memoryType, or content' },
        { status: 400 }
      );
    }

    const memory = await agentMemoryService.saveMemory(
      agentId,
      projectId,
      memoryType,
      content
    );

    return NextResponse.json({ memory });
  } catch (err: any) {
    console.error('Error in startup-agents memory POST route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
