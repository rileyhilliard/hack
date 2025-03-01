import { ServerResponse } from 'node:http';
import { OllamaResponse } from '../types/index.js';

/**
 * Create an Ollama-compatible response
 */
export const createOllamaResponse = (content: string, model: string): OllamaResponse => ({
  model,
  created_at: new Date().toISOString(),
  message: {
    role: "assistant",
    content,
  },
  done_reason: "stop",
  done: true,
  total_duration: 11113058963,
  load_duration: 35277250,
  prompt_eval_count: 33,
  prompt_eval_duration: 2938000000,
  eval_count: 25,
  eval_duration: 7554000000,
});

/**
 * Send error response
 */
export const sendErrorResponse = (
  res: ServerResponse,
  statusCode: number,
  message: string,
  details: string | null = null
): void => {
  if (!res.headersSent) {
    res.writeHead(statusCode);
    const errorResponse = details
      ? { error: message, details }
      : { error: message };
    res.end(JSON.stringify(errorResponse));
  }
}; 