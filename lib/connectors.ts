export interface RegisteredConnector {
  id: string;
  name: string;
  category: string;
  description: string;
  authType: 'api_key' | 'oauth' | 'none';
  serverUrl: string;
  docsUrl: string;
  icon: string;
}

export const AVAILABLE_CONNECTORS: RegisteredConnector[] = [
  // Productivity
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: 'Access pages, databases, and workspaces in Notion to read and write notes.',
    authType: 'api_key',
    serverUrl: 'https://mcp.notion.com',
    docsUrl: 'https://developers.notion.com',
    icon: 'Notebook'
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Productivity',
    description: 'Track issues, cycles, and projects inside Linear, allowing agents to file tickets.',
    authType: 'api_key',
    serverUrl: 'https://mcp.linear.app/sse',
    docsUrl: 'https://linear.app/docs',
    icon: 'CheckSquare'
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'Productivity',
    description: 'Search code repositories, view pull requests, read issues, and commit changes.',
    authType: 'oauth',
    serverUrl: 'https://api.githubcopilot.com/mcp',
    docsUrl: 'https://github.com/features/copilot',
    icon: 'Github'
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'Productivity',
    description: 'Convene tickets and update task progress inside Atlassian Jira projects.',
    authType: 'oauth',
    serverUrl: 'https://mcp.atlassian.com/jira',
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform',
    icon: 'Trello'
  },
  // Search & Data
  {
    id: 'tavily',
    name: 'Tavily Search',
    category: 'Search',
    description: 'Execute advanced web search queries optimization for LLM agent context.',
    authType: 'api_key',
    serverUrl: 'https://mcp.tavily.com/mcp',
    docsUrl: 'https://tavily.com',
    icon: 'Search'
  },
  {
    id: 'exa',
    name: 'Exa AI',
    category: 'Search',
    description: 'Execute neural semantic searches matching documents and conceptual queries.',
    authType: 'api_key',
    serverUrl: 'https://mcp.exa.ai/sse',
    docsUrl: 'https://exa.ai',
    icon: 'Globe'
  },
  {
    id: 'brave',
    name: 'Brave Search',
    category: 'Search',
    description: 'Query Brave Web Search index for fresh information and links.',
    authType: 'api_key',
    serverUrl: 'https://api.search.brave.com/mcp',
    docsUrl: 'https://brave.com/search/api',
    icon: 'Compass'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    category: 'Search',
    description: 'Query Perplexity LLM search engines for structured factual summaries.',
    authType: 'api_key',
    serverUrl: 'https://mcp.perplexity.ai',
    docsUrl: 'https://docs.perplexity.ai',
    icon: 'Cpu'
  },
  // Communication
  {
    id: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: 'Post messages to channels, read active workspace threads, and send alerts.',
    authType: 'oauth',
    serverUrl: 'https://mcp.slack.com/sse',
    docsUrl: 'https://api.slack.com',
    icon: 'MessageSquare'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Communication',
    description: 'Search user mailboxes, read emails, draft replies, and send messages.',
    authType: 'oauth',
    serverUrl: 'https://gmail.mcp.goog/mcp',
    docsUrl: 'https://developers.google.com/gmail/api',
    icon: 'Mail'
  },
  // Storage
  {
    id: 'gdrive',
    name: 'Google Drive',
    category: 'Storage',
    description: 'Browse folders, download files, and write documents directly in Google Drive.',
    authType: 'oauth',
    serverUrl: 'https://gdrive.mcp.goog/mcp',
    docsUrl: 'https://developers.google.com/drive',
    icon: 'HardDrive'
  },
  // Developer
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'Developer',
    description: 'Manage backend databases, query table schemas, and execute functions.',
    authType: 'api_key',
    serverUrl: 'https://mcp.supabase.com/sse',
    docsUrl: 'https://supabase.com/docs',
    icon: 'Database'
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Developer',
    description: 'Inspect deployment builds, deploy domains, and manage cloud hosting states.',
    authType: 'api_key',
    serverUrl: 'https://mcp.vercel.com/sse',
    docsUrl: 'https://vercel.com/docs',
    icon: 'Server'
  },
  // Finance
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Finance',
    description: 'Check subscription statuses, pull customer payments, and track transactions.',
    authType: 'api_key',
    serverUrl: 'https://mcp.stripe.com/sse',
    docsUrl: 'https://stripe.com/docs/api',
    icon: 'CreditCard'
  }
];
