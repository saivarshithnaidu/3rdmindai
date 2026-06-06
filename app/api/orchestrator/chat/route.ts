import { NextRequest } from 'next/server';
import messageService from '../../../../services/message.service';
import openrouterService from '../../../../services/openrouter.service';
import toolsService from '../../../../services/tools.service';
import { orchestratorService, extractWebSearchQuery, extractSearchQuery } from '../../../../services/orchestrator.service';
import { DEFAULT_ORCHESTRATOR_MODEL } from '../../../../lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { projectId, agentId, model, options } = await req.json();

    if (!projectId || !agentId) {
      return new Response(JSON.stringify({ error: 'Missing projectId or agentId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Retrieve previous messages to maintain context
    const rawMessages = await messageService.getAgentMessages(agentId);
    
    // Map history for OpenRouter (filtering user and assistant messages)
    const chatHistory = rawMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // Check if the latest user message requires tool context retrieval
    let toolContext = "";
    if (chatHistory.length > 0) {
      const lastUserMsg = chatHistory[chatHistory.length - 1];
      if (lastUserMsg.role === 'user') {
        const text = lastUserMsg.content.toLowerCase();
        try {
          const useWebSearch = options ? !!options.webSearch : (text.includes("web") || text.includes("search") || text.includes("tavily") || text.includes("internet"));
          const useExaSearch = options ? !!options.exaSearch : text.includes("exa");
          const useKaggle = options ? !!options.kaggle : (text.includes("kaggle") || text.includes("dataset") || text.includes("download data"));
          const useDatabase = options ? !!options.database : (text.includes("database") || text.includes("postgres") || text.includes("sql") || text.includes("query"));
          const useRag = options ? !!options.rag : (text.includes("rag") || text.includes("qdrant") || text.includes("vector") || text.includes("document"));

          const webQuery = extractWebSearchQuery(lastUserMsg.content);

          if (useWebSearch) {
            toolContext += "\n\n" + await orchestratorService.executeToolAndLog(
              agentId,
              projectId,
              "Tavily Web Search",
              webQuery,
              () => toolsService.searchWeb(webQuery)
            );
          }
          if (useExaSearch) {
            toolContext += "\n\n" + await orchestratorService.executeToolAndLog(
              agentId,
              projectId,
              "Exa Neural Search",
              webQuery,
              () => toolsService.searchExa(webQuery)
            );
          }
          if (text.includes("serper") || text.includes("google")) {
            toolContext += "\n\n" + await orchestratorService.executeToolAndLog(
              agentId,
              projectId,
              "Serper Google Search",
              webQuery,
              () => toolsService.searchSerper(webQuery)
            );
          }
          if (text.includes("pdf") || text.includes("parse file") || text.includes("llamaparse") || text.includes("llamaindex")) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const match = lastUserMsg.content.match(urlRegex);
            const pdfUrl = match ? match[0] : "https://dummy.pdf";
            toolContext += "\n\n" + await orchestratorService.executeToolAndLog(
              agentId,
              projectId,
              "LlamaParse PDF Reader",
              pdfUrl,
              () => toolsService.parsePdf(pdfUrl)
            );
          }
          if (useRag) {
            toolContext += "\n\n" + await orchestratorService.executeToolAndLog(
              agentId,
              projectId,
              "Qdrant Vector RAG",
              webQuery,
              () => toolsService.searchRag(webQuery)
            );
          }
          if (useDatabase) {
            toolContext += "\n\n" + await orchestratorService.executeToolAndLog(
              agentId,
              projectId,
              "Supabase PostgreSQL Query",
              webQuery,
              () => toolsService.queryDatabase(webQuery)
            );
          }
          if (useKaggle) {
            toolContext += "\n\n" + await orchestratorService.executeToolAndLog(
              agentId,
              projectId,
              "Kaggle Dataset Search",
              webQuery,
              () => toolsService.searchKaggle(webQuery)
            );
          }
        } catch (err) {
          console.error("Error retrieving tool context in orchestrator chat:", err);
        }
      }
    }

    let systemPrompt = `You are 3RDMIND, the lead orchestrator agent. The user is collaborating with you on a project.
Help coordinate, answer questions, structure suggestions, and guide them in achieving their goal.
Maintain a calm, editorial, highly intelligent, and premium tone. Use markdown formatting where appropriate.`;

    if (toolContext) {
      systemPrompt += `\n\nHere is the live search/tool context retrieved for the user's latest query. Make sure to use this data to answer their request directly:\n${toolContext}`;
    }

    const modelName = model || DEFAULT_ORCHESTRATOR_MODEL;

    // Call OpenRouter to stream responses
    const stream = openrouterService.streamModel(systemPrompt, chatHistory, modelName);

    // Tee the stream for parallel delivery to database and frontend
    const [streamForClient, streamForDb] = stream.tee();

    // Async persist stream into database
    messageService.streamAndSave(agentId, projectId, streamForDb).catch((err) => {
      console.error(`Error streaming and saving orchestrator ${agentId} chat:`, err);
    });

    return new Response(streamForClient, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (e) {
    console.error('Error in orchestrator chat API:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
