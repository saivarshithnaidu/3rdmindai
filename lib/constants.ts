import { ModelOption } from '../types';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
  },
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    provider: 'Mistral',
  },
  {
    id: 'moonshot/moonshot-v1-8k',
    name: 'Kimi (Moonshot)',
    provider: 'Moonshot',
  },
  {
    id: 'meta-llama/llama-3-70b-instruct',
    name: 'Llama 3 70B (Groq)',
    provider: 'Meta',
  },
];

export const DEFAULT_ORCHESTRATOR_MODEL = 'deepseek/deepseek-chat';
export const DEFAULT_SUB_AGENT_MODEL = 'meta-llama/llama-3-70b-instruct';
