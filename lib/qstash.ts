import { Client } from '@upstash/qstash';

const qstashToken = process.env.QSTASH_TOKEN || '';

// Singleton Client Instance
export const qstashClient = new Client({
  token: qstashToken,
});

export interface QueueTaskPayload {
  agentId: string;
  projectId: string;
  taskDescription: string;
  triggeredBy: 'user' | 'agent' | 'schedule';
}

/**
 * Publishes an agent task to Upstash QStash for asynchronous execution with 3 retries.
 */
export async function queueAgentTask(
  agentId: string,
  projectId: string,
  taskDescription: string,
  triggeredBy: 'user' | 'agent' | 'schedule'
) {
  const appUrl = process.env.APP_URL || 'https://3rdmind.ai';
  const executeUrl = `${appUrl}/api/agent/execute`;

  // Fallback simulator for local developer testing when token is missing/mocked
  if (!qstashToken || qstashToken.startsWith('mock_')) {
    console.warn('[QStash offline simulator] Triggering background task locally.');
    
    // Asynchronously call the execute route locally
    setTimeout(async () => {
      try {
        const localExecuteUrl = `${appUrl.startsWith('https://3rdmind.ai') ? 'http://localhost:3000' : appUrl}/api/agent/execute`;
        
        await fetch(localExecuteUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-local-dev-bypass': 'true'
          },
          body: JSON.stringify({
            agentId,
            projectId,
            taskDescription,
            triggeredBy
          })
        });
      } catch (err) {
        console.error('[QStash offline simulator] Failed to invoke execute route:', err);
      }
    }, 100);

    return { messageId: 'mock_msg_' + Math.random().toString(36).substring(2, 11) };
  }

  // Production publish to QStash
  const response = await qstashClient.publishJSON({
    url: executeUrl,
    body: {
      agentId,
      projectId,
      taskDescription,
      triggeredBy,
    },
    retries: 3,
  });

  return response;
}
