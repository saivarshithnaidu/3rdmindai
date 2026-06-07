import supabaseService from './supabase.service';
import { OPENROUTER_BASE_URL } from '../lib/constants';

export const embeddingService = {
  async embedText(text: string): Promise<number[]> {
    const keysStr = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY;
    if (!keysStr) {
      throw new Error('Neither OPENROUTER_API_KEYS nor OPENROUTER_API_KEY environment variable is defined.');
    }
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      throw new Error('No valid OpenRouter API keys found.');
    }

    const payload = {
      model: 'openai/text-embedding-3-small',
      input: text.replace(/\n/g, ' ')
    };

    let lastError: Error | null = null;
    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

    for (const apiKey of shuffledKeys) {
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://3rdmind.ai',
            'X-Title': '3RDMIND',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenRouter Embeddings API error: ${response.status} ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;
        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Invalid embeddings format returned by OpenRouter');
        }

        return embedding;
      } catch (err) {
        console.warn(`embedText request failed with API key: ${apiKey.slice(0, 15)}... Error: ${err instanceof Error ? err.message : String(err)}.`);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(`All configured OpenRouter API keys failed for embeddings. Last error: ${lastError?.message}`);
  },

  async embedAndSave(memoryId: string, content: string): Promise<void> {
    try {
      const embedding = await this.embedText(content);
      const supabase = supabaseService.getServiceClient();
      const { error } = await supabase
        .from('agent_memory')
        .update({ embedding })
        .eq('id', memoryId);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error(`Failed to generate and save embedding for memory ${memoryId}:`, err);
    }
  },

  async semanticRecall(
    agentId: string,
    projectId: string,
    query: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{ id: string; content: string; memory_type: string; similarity: number }>> {
    try {
      const queryEmbedding = await this.embedText(query);
      const supabase = supabaseService.getServiceClient();

      const { data, error } = await supabase.rpc('match_agent_memories', {
        query_embedding: queryEmbedding,
        match_agent_id: agentId,
        match_project_id: projectId,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (err) {
      console.error(`Semantic recall failed for agent ${agentId} with query "${query}":`, err);
      return [];
    }
  }
};

export default embeddingService;
