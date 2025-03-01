import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Configuration interface
 */
export interface Config {
  targetDomain: string;
  targetPort: number;
  proxyDomain: string;
  proxyPort: number;
}

/**
 * Ollama response interface
 */
export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done_reason: string;
  done: boolean;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}

/**
 * WebAI request body interface
 */
export interface WebAIBody {
  message: {
    role: string;
    content: string;
  }[];
}

/**
 * HTTP request handler type
 */
export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * Error response interface
 */
export interface ErrorResponse {
  error: string;
  details?: string;
} 