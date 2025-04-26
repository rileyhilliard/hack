import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Configuration interface
 */
export interface Config {
  targetDomain: string;
  targetPort: number;
  proxyDomain: string;
  proxyPort: number; // Port the proxy server will listen on
  targetApiKey?: string; // Optional API key for the target service
}

/**
 * Ollama response interface
 */
export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: "assistant";
    content: string;
  };
  done_reason: string;
  done: boolean;
  total_duration?: number; // Make optional
  load_duration?: number; // Make optional
  prompt_eval_count?: number; // Make optional
  prompt_eval_duration?: number; // Make optional
  eval_count?: number; // Make optional
  eval_duration?: number; // Make optional
}

/**
 * WebAI request body interface
 */
export interface WebAIBody {
  message: {
    role: string;
    content: string | null; // Content can be null
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

// OpenAI Non-Streaming Chat Completion Response
export interface OpenAICompletionResponse {
  id: string; // Example: "chatcmpl-123"
  object: "chat.completion";
  created: number; // Unix timestamp
  model: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string | null;
    };
    finish_reason: string | null; // e.g., "stop", "length"
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// OpenAI Streaming Chat Completion Chunk
export interface OpenAICompletionChunk {
  id: string; // Example: "chatcmpl-123"
  object: "chat.completion.chunk";
  created: number; // Unix timestamp
  model: string;
  choices: {
    index: number;
    delta: {
      role?: "assistant";
      content?: string | null;
    };
    finish_reason: string | null; // e.g., "stop", "length"
  }[];
} 