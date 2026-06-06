import { AVAILABLE_MODELS, OPENROUTER_BASE_URL } from '../lib/constants';
import { ModelOption } from '../types';
import agentService from './agent.service';

export const openrouterService = {
  getAvailableModels(): ModelOption[] {
    return AVAILABLE_MODELS;
  },

  async callModel(
    system: string,
    messages: { role: string; content: string }[],
    model: string,
    agentId?: string
  ): Promise<string> {
    const keysStr = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY;
    if (!keysStr) {
      throw new Error('Neither OPENROUTER_API_KEYS nor OPENROUTER_API_KEY environment variable is defined.');
    }
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      throw new Error('No valid OpenRouter API keys found.');
    }

    // Token budget enforcement
    if (agentId) {
      try {
        const agent = await agentService.getAgent(agentId);
        if (agent && agent.tokens_used >= agent.token_budget) {
          return "[Token budget exceeded. Response truncated.]";
        }
      } catch (err) {
        console.warn(`Budget check failed for agent ${agentId}:`, err);
      }
    }

    const payload = {
      model,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    let lastError: Error | null = null;
    // Shuffle the keys to distribute load randomly
    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

    for (const apiKey of shuffledKeys) {
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://3rdmind.ai',
            'X-Title': '3RDMIND',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '';

        // Estimate and update token usage
        if (agentId && responseText) {
          const tokens = Math.ceil(responseText.length / 4);
          agentService.incrementTokensUsed(agentId, tokens).catch((err) => {
            console.error(`Failed to update tokens for agent ${agentId}:`, err);
          });
        }

        return responseText;
      } catch (err) {
        console.warn(`callModel request failed with API key: ${apiKey.slice(0, 15)}... Error: ${err instanceof Error ? err.message : String(err)}. Retrying next key...`);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(`All configured OpenRouter API keys failed. Last error: ${lastError?.message}`);
  },

  streamModelWithTools(
    system: string,
    messages: { role: string; content: string }[],
    model: string,
    availableTools: any[],
    agentId?: string
  ): ReadableStream {
    let toolsInstructions = "";
    if (availableTools && availableTools.length > 0) {
      toolsInstructions = `\n\nYou have access to the following tools. Call them using this exact syntax when needed:
<tool_call>
{"tool": "tool_name", "params": {"key": "value"}}
</tool_call>

Available tools:
${availableTools.map(t => `- **${t.name}**: ${t.description}\n  Schema: ${JSON.stringify(t.inputSchema)}`).join('\n')}

Always call tools when they would improve your output. Do not simulate tool results. If you call a tool, stop writing and wait for the results.`;
    }

    const systemPromptWithTools = `${system}${toolsInstructions}`;
    return this.streamModel(systemPromptWithTools, messages, model, agentId);
  },

  streamModel(
    system: string,
    messages: { role: string; content: string }[],
    model: string,
    agentId?: string
  ): ReadableStream {
    const keysStr = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY;
    if (!keysStr) {
      throw new Error('Neither OPENROUTER_API_KEYS nor OPENROUTER_API_KEY environment variable is defined.');
    }
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      throw new Error('No valid OpenRouter API keys found.');
    }

    const payload = {
      model,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    };

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        try {
          // Token budget enforcement
          if (agentId) {
            try {
              const agent = await agentService.getAgent(agentId);
              if (agent && agent.tokens_used >= agent.token_budget) {
                controller.enqueue(encoder.encode("[Token budget exceeded. Response truncated.]"));
                controller.close();
                return;
              }
            } catch (err) {
              console.warn(`Budget check failed for agent ${agentId}:`, err);
            }
          }

          let response: Response | null = null;
          let lastError: Error | null = null;
          const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

          for (const apiKey of shuffledKeys) {
            try {
              response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'HTTP-Referer': 'https://3rdmind.ai',
                  'X-Title': '3RDMIND',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });

              if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errText}`);
              }
              break; // Success! Break out of key retry loop.
            } catch (err) {
              console.warn(`streamModel initial request failed with API key: ${apiKey.slice(0, 15)}... Error: ${err instanceof Error ? err.message : String(err)}. Retrying next key...`);
              lastError = err instanceof Error ? err : new Error(String(err));
              response = null;
            }
          }

          if (!response || !response.ok) {
            throw new Error(`All configured OpenRouter API keys failed for streaming. Last error: ${lastError?.message}`);
          }

          if (!response.body) {
            throw new Error('Response body is empty');
          }

          const reader = response.body.getReader();
          let buffer = '';
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const cleanedLine = line.trim();
              if (!cleanedLine) continue;
              if (cleanedLine === 'data: [DONE]') {
                break;
              }
              if (cleanedLine.startsWith('data: ')) {
                const jsonStr = cleanedLine.slice(6);
                try {
                  const parsed = JSON.parse(jsonStr);
                  const chunk = parsed.choices?.[0]?.delta?.content || '';
                  if (chunk) {
                    fullContent += chunk;
                    controller.enqueue(encoder.encode(chunk));
                  }
                } catch (e) {
                  // ignore parse error on incomplete lines
                }
              }
            }
          }

          // Estimate and update token usage on stream complete
          if (agentId && fullContent) {
            const tokens = Math.ceil(fullContent.length / 4);
            agentService.incrementTokensUsed(agentId, tokens).catch((err) => {
              console.error(`Failed to update stream tokens for agent ${agentId}:`, err);
            });
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  },
};

export default openrouterService;
