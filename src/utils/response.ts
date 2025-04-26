import { ServerResponse } from 'node:http';
import { OllamaResponse, OpenAICompletionChunk, OpenAICompletionResponse } from '../types/index.js';
import { randomUUID } from 'crypto'; // For generating unique IDs

/**
 * Create an Ollama-compatible response (non-streaming)
 * Uses stats from the backend if provided.
 */
export const createOllamaResponse = (
    content: string,
    model: string, // This is the intended model name (e.g., modelRequested)
    stats?: Partial<OllamaResponse>, // Optional stats from backend
    calculatedDurationNs?: bigint // Calculated duration from proxy
): OllamaResponse => {
    const response: OllamaResponse = {
        model: model, // ALWAYS use the model argument passed to the function
        created_at: stats?.created_at || new Date().toISOString(),
        message: {
            role: "assistant",
            content,
        },
        done_reason: stats?.done_reason || "stop",
        done: true,
    };

    // Conditionally add stats fields only if they exist in the stats object OR calculated
    // Prioritize calculated duration if available
    response.total_duration = calculatedDurationNs !== undefined ? Number(calculatedDurationNs) : stats?.total_duration;
    if (stats?.load_duration !== undefined) response.load_duration = stats.load_duration;
    if (stats?.prompt_eval_count !== undefined) response.prompt_eval_count = stats.prompt_eval_count;
    if (stats?.prompt_eval_duration !== undefined) response.prompt_eval_duration = stats.prompt_eval_duration;
    if (stats?.eval_count !== undefined) response.eval_count = stats.eval_count;
    if (stats?.eval_duration !== undefined) response.eval_duration = stats.eval_duration;

    return response;
};

// Helper function for word count based token approximation
const approximateTokens = (text: string | null | undefined): number => {
    if (!text) return 0;
    // Simple word count based on spaces, multiplied by a heuristic factor (e.g., 1.3)
    const wordCount = text.trim().split(/\s+/).length;
    return Math.ceil(wordCount * 1.3);
};

/**
 * Create an OpenAI-compatible Chat Completion response (non-streaming)
 * Uses stats from the backend if provided, mapping them to OpenAI format.
 * Approximates token counts.
 */
export const createOpenAIResponse = (
    content: string,
    model: string, // This is the intended model name (e.g., modelRequested)
    promptMessages: { role: string; content: string | null }[], // More specific type
    stats?: Partial<OllamaResponse> // Optional stats from backend (assuming Ollama format)
): OpenAICompletionResponse => {

  // Approximate token counts
  let prompt_tokens = 0;
  try {
      promptMessages.forEach(msg => {
          prompt_tokens += approximateTokens(msg.content);
      });
  } catch (e) {
      console.warn("Error approximating prompt tokens:", e);
      prompt_tokens = 0; // Fallback
  }

  let completion_tokens = 0;
  try {
      completion_tokens = approximateTokens(content);
  } catch (e) {
      console.warn("Error approximating completion tokens:", e);
      completion_tokens = 0; // Fallback
  }

  const total_tokens = prompt_tokens + completion_tokens;

  // Construct the response
  return {
      id: `chatcmpl-${randomUUID()}`,
      object: "chat.completion",
      created: stats?.created_at ? Math.floor(new Date(stats.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content,
          },
          finish_reason: stats?.done_reason || "stop",
        },
      ],
      // Use approximated token counts
      usage: {
        prompt_tokens,
        completion_tokens,
        total_tokens,
      },
  };
};

/**
 * Format an Ollama stream chunk
 */
export const formatOllamaStreamChunk = (contentDelta: string, model: string): string => {
  const chunk = {
    model,
    created_at: new Date().toISOString(),
    message: {
      role: "assistant",
      content: contentDelta,
    },
    done: false, // In-progress chunk
  };
  return JSON.stringify(chunk) + '\n'; // Ollama streams use newline-delimited JSON
};

/**
 * Format an OpenAI stream chunk (Server-Sent Event)
 */
export const formatOpenAIStreamChunk = (contentDelta: string, model: string, chunkId?: string): string => {
  const chunk: OpenAICompletionChunk = {
    id: chunkId || `chatcmpl-${randomUUID()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: model || "webai-llm",
    choices: [
      {
        index: 0,
        delta: {
          content: contentDelta,
        },
        finish_reason: null,
      },
    ],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`; // SSE format
};

/**
 * Format the final OpenAI stream chunk ([DONE] message)
 */
export const formatFinalOpenAIChunk = (): string => {
  return `data: [DONE]\n\n`;
};

/**
 * Format the final Ollama stream chunk (with done: true)
 */
export const formatFinalOllamaChunk = (
    model: string,
    stats?: Partial<OllamaResponse>,
    calculatedDurationNs?: bigint // Calculated duration from proxy
): string => {
  const chunk = {
    model: stats?.model || model,
    created_at: stats?.created_at || new Date().toISOString(),
    message: {
      role: "assistant",
      content: "", // Final chunk has empty content
    },
    done_reason: stats?.done_reason || "stop",
    done: true,
    // Include stats if available, otherwise undefined. Prioritize calculated.
    total_duration: calculatedDurationNs !== undefined ? Number(calculatedDurationNs) : stats?.total_duration,
    load_duration: stats?.load_duration,
    prompt_eval_count: stats?.prompt_eval_count,
    prompt_eval_duration: stats?.prompt_eval_duration,
    eval_count: stats?.eval_count,
    eval_duration: stats?.eval_duration,
  };
  return JSON.stringify(chunk) + '\n';
};

/**
 * Send error response
 */
export const sendErrorResponse = (
  res: ServerResponse,
  statusCode: number,
  message: string,
  details: string | null = null
): void => {
  if (res.writableEnded) return; // Don't send if already ended
  if (!res.headersSent) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
  }
  const errorResponse = details
    ? { error: message, details }
    : { error: message };
  res.end(JSON.stringify(errorResponse));
}; 