import { randomUUID } from 'crypto';
import http, { IncomingMessage, ServerResponse, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Config, OllamaResponse, WebAIBody } from '../types/index.js';
import { sendErrorResponse, createOllamaResponse, createOpenAIResponse, formatOllamaStreamChunk, formatOpenAIStreamChunk, formatFinalOpenAIChunk, formatFinalOllamaChunk } from './response.js';

/**
 * Create proxy request configuration
 */
export const createProxyConfig = (
  req: IncomingMessage,
  proxyRequestBody: string,
  config: Config
): http.RequestOptions => {

  // Construct minimal headers
  const headers: http.OutgoingHttpHeaders = {
    // 'Host': `${config.targetDomain}:${config.targetPort}`, // Host is set automatically by http.request based on options
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(proxyRequestBody),
    'Connection': 'keep-alive'
  };

  // Determine the API key to send to the backend
  let backendApiKey: string | undefined = undefined;

  // Prioritize incoming Authorization header
  if (req.headers.authorization) {
    // Extract token, assuming format "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        backendApiKey = authHeader.substring(7).trim();
    }
  }

  // Otherwise, use the targetApiKey from config if available
  if (!backendApiKey && config.targetApiKey) {
    backendApiKey = config.targetApiKey;
  }

  // Always send the determined key as X-API-Key to the backend
  if (backendApiKey) {
      headers['x-api-key'] = backendApiKey;
  }

  return {
      host: config.targetDomain,
      port: config.targetPort,
      // Map both chat paths to /prompt
      path: (req.url === "/api/chat" || req.url === "/v1/chat/completions") ? "/prompt" : req.url,
      method: req.method,
      headers: headers, // Use the constructed headers object
      timeout: 30000,
  };
};

// Define a type for the structure returned by accumulateResponse
interface AccumulatedResponse {
    content: string;
    stats: Partial<OllamaResponse>; // Use Partial as not all stats might be present
}

// Function to accumulate and parse potentially concatenated JSON responses from the backend
const accumulateAndParseBackendResponse = async (proxyRes: IncomingMessage, modelRequested: string): Promise<AccumulatedResponse> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
    proxyRes.on("error", reject); // Reject promise on connection error

    proxyRes.on("end", () => {
      try {
        const fullBackendResponse = Buffer.concat(chunks).toString('utf8').trim();
        let accumulatedContent = '';
        let finalStats: Partial<OllamaResponse> = {};
        let remainingResponse = fullBackendResponse;
        let jsonObjectCount = 0;

        // Attempt to parse the response as potentially concatenated JSON objects
        while (remainingResponse.length > 0) {
          let braceCount = 0;
          let endIndex = -1;
          let startIndex = remainingResponse.indexOf('{');

          if (startIndex === -1) {
            if (jsonObjectCount === 0 && remainingResponse.length > 0) {
              console.warn("Backend response content was not valid JSON, treating as raw text:", remainingResponse);
              accumulatedContent = remainingResponse; // Treat non-JSON as raw content if nothing parsed yet
            }
            break; // No more JSON objects found
          }

          // Ensure we start parsing from the first opening brace
          remainingResponse = remainingResponse.substring(startIndex);

          // Find the matching closing brace for a complete JSON object
          for (let i = 0; i < remainingResponse.length; i++) {
            if (remainingResponse[i] === '{') braceCount++;
            else if (remainingResponse[i] === '}') braceCount--;

            if (braceCount === 0) {
              endIndex = i;
              break;
            }
          }

          if (endIndex === -1) {
            console.warn("Malformed JSON detected (unbalanced braces) in backend response, processing stopped:", remainingResponse);
            if (jsonObjectCount === 0) accumulatedContent = fullBackendResponse; // Use original if first parse failed
            break;
          }

          const jsonString = remainingResponse.substring(0, endIndex + 1);
          remainingResponse = remainingResponse.substring(endIndex + 1).trim();
          jsonObjectCount++;

          try {
            const parsedChunk = JSON.parse(jsonString);

            // Extract content, assuming OpenAI-like structure from backend
            if (parsedChunk.choices?.[0]?.message?.content) {
              accumulatedContent += parsedChunk.choices[0].message.content;
            }

            // Extract final stats from either OpenAI `usage` or Ollama `done: true` chunks
            if (parsedChunk.usage) {
              finalStats = {
                ...finalStats,
                prompt_eval_count: parsedChunk.usage.prompt_tokens,
                eval_count: parsedChunk.usage.completion_tokens,
                done_reason: finalStats.done_reason || parsedChunk.choices?.[0]?.finish_reason || "stop",
                model: finalStats.model || parsedChunk.model || modelRequested,
                created_at: finalStats.created_at || (parsedChunk.created ? new Date(parsedChunk.created * 1000).toISOString() : undefined)
              };
            } else if (parsedChunk.done === true) {
              // Merge stats from Ollama-style final chunk, keeping existing fields prioritized
              finalStats = { ...parsedChunk, ...finalStats };
              finalStats.model = finalStats.model || modelRequested;
            }
          } catch (e) {
            console.warn("Could not parse JSON segment:", jsonString, e);
            if (jsonObjectCount === 1) accumulatedContent = fullBackendResponse; // Use original if first parse failed
            break; // Stop processing if a segment fails
          }
        }

        // Provide default stats if none were properly extracted but content exists
        if (!finalStats.model && accumulatedContent.length > 0) {
            console.warn("Final stats chunk not found or parsed correctly, using defaults.");
            finalStats.model = modelRequested;
            finalStats.done_reason = finalStats.done_reason || "stop";
            finalStats.created_at = finalStats.created_at || new Date().toISOString();
        }

        resolve({ content: accumulatedContent, stats: finalStats });

      } catch (error) {
        console.error("Error processing accumulated backend response:", error);
        reject(new Error("Failed to process backend response"));
      }
    });
  });
};

/**
 * Handle proxy response (Streaming or Non-Streaming)
 */
export const handleProxyResponse = async (
  proxyRes: IncomingMessage,
  res: ServerResponse,
  isStreamingRequest: boolean,
  originalPath: string,
  modelRequested: string,
  requestStartTime: bigint,
  originalRequestBody: string
): Promise<void> => {
  try {
    const backendStatusCode = proxyRes.statusCode || 500;
    const backendHeaders = proxyRes.headers;

    // Handle backend errors (>= 400)
    if (backendStatusCode >= 400) {
        console.error(`Proxy received backend error: ${backendStatusCode}`);

        // Specific handling for 401 Unauthorized
        if (backendStatusCode === 401) {
            return sendErrorResponse(
                res,
                401,
                "Authentication error: Unauthorized access to the target server. " +
                "Ensure the correct authentication token is provided. This can be done via: " +
                "1) Setting the TARGET_API_KEY environment variable in the proxy's .env file, OR " +
                "2) Sending an 'Authorization: Bearer <your-token>' header with your request."
            );
        } else {
            // Generic handling for other 4xx/5xx errors
            const errorDetails = await accumulateAndParseBackendResponse(proxyRes, modelRequested)
                                       .catch(err => ({ content: `Backend error details unavailable: ${err.message}`, stats: {} }));
            let responseBody: string | object;
            try {
                responseBody = JSON.parse(errorDetails.content);
            } catch {
                // If backend error body isn't JSON, wrap it
                responseBody = { error: "Backend Error", statusCode: backendStatusCode, details: errorDetails.content };
            }
            // Use backend headers but ensure content type is json
            const responseHeaders = { ...backendHeaders, 'content-type': 'application/json' };
            // Remove transfer-encoding if present, as we are sending a single response body
            delete responseHeaders['transfer-encoding'];
            res.writeHead(backendStatusCode, responseHeaders);
            res.end(JSON.stringify(responseBody));
            return;
        }
    }

    // Handle Streaming Client Requests
    if (isStreamingRequest) {
      const headers = originalPath === "/v1/chat/completions" ? {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        } : {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        };
      res.writeHead(200, headers);

      let chunkId = `chatcmpl-${randomUUID()}`;

      proxyRes.on("data", (chunk: Buffer) => {
        const rawChunk = chunk.toString('utf8').trim();
        if (!rawChunk) return;

        try {
          const backendChunk = JSON.parse(rawChunk);
          const contentDelta = backendChunk.choices?.[0]?.message?.content || '';

          if (contentDelta) {
            if (originalPath === "/v1/chat/completions") {
              res.write(formatOpenAIStreamChunk(contentDelta, modelRequested, chunkId));
            } else if (originalPath === "/api/chat") {
              // --- DEBUG LOGGING for /api/chat stream ---
              // console.log("[PROXY DEBUG /api/chat stream] Received backend chunk:", JSON.stringify(backendChunk));
              // --- END DEBUG LOGGING ---
              res.write(formatOllamaStreamChunk(contentDelta, modelRequested));
            }
          }
          // Ignore chunks without content delta (e.g., final chunks with only stats)
        } catch (error: any) {
          // Log a warning but continue processing the stream if a chunk is malformed
          console.warn(`[PROXY STREAM ${originalPath}] Skipping backend chunk due to JSON parsing error. Chunk: "${rawChunk}", Error: ${error.message}`);
        }
      });

      proxyRes.on("end", () => {
        // Send appropriate final stream message to client
        if (originalPath === "/v1/chat/completions") {
          res.write(formatFinalOpenAIChunk());
        } else if (originalPath === "/api/chat") {
          const durationNs = process.hrtime.bigint() - requestStartTime;
          // Final Ollama chunk can include stats, but we don't reliably get them from the stream
          res.write(formatFinalOllamaChunk(modelRequested, undefined, durationNs));
        }
        res.end();
      });

      proxyRes.on("error", (error) => {
        console.error("[PROXY STREAM] Error during backend response stream:", error);
        if (!res.writableEnded) res.end();
      });

       res.on('error', (err) => {
         console.error('[PROXY STREAM] Error during client response write:', err);
      });

    // Handle Non-Streaming Client Requests
    } else {
      const { content: responseContent, stats: responseStats } = await accumulateAndParseBackendResponse(proxyRes, modelRequested);
      let finalResponse;
      const modelToUse = modelRequested;
      const durationNs = process.hrtime.bigint() - requestStartTime;

      if (originalPath === "/v1/chat/completions") {
        let promptMessages: any[] = [];
        try {
            const originalBodyParsed = JSON.parse(originalRequestBody);
            promptMessages = originalBodyParsed.messages || [];
        } catch (e) {
            console.error("Could not parse original request body for token counting:", e);
        }
        finalResponse = createOpenAIResponse(responseContent, modelToUse, promptMessages, responseStats);
      } else if (originalPath === "/api/chat") {
        finalResponse = createOllamaResponse(responseContent, modelToUse, responseStats, durationNs);
      } else {
        // Fallback for unknown paths: just return raw content + stats
        finalResponse = { content: responseContent, stats: responseStats };
      }

      const responseBody = JSON.stringify(finalResponse);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(responseBody),
        'Access-Control-Allow-Origin': '*'
      });
      res.end(responseBody);
    }
  } catch (error) {
    console.error("handleProxyResponse Error:", error);
    if (!res.headersSent) {
        sendErrorResponse(res, 500, "Internal Server Error handling proxy response");
    } else if (!res.writableEnded) {
        res.end();
    }
  }
};

/**
 * Setup proxy request with error handling
 */
export const setupProxyRequest = (
  proxyConfig: http.RequestOptions,
  proxyRequestBody: WebAIBody | string,
  res: ServerResponse,
  originalRequestBody: string,
  isStreamingRequest: boolean,
  originalPath: string,
  modelRequested: string,
  config: Config,
  requestStartTime: bigint
): void => {
  // Determine if target is HTTP or HTTPS
  const requestFn = proxyConfig.port === 443 || config.targetPort === 443 ? httpsRequest : httpRequest; // Use config.targetPort for protocol check

  // Add configured timeout to the proxy request options
  const finalProxyConfig = { ...proxyConfig, timeout: config.targetTimeoutMs };

  const proxyReq = requestFn(finalProxyConfig, (proxyRes) => {
    handleProxyResponse(proxyRes, res, isStreamingRequest, originalPath, modelRequested, requestStartTime, originalRequestBody);
  });

  // Error handling (keep existing handlers)
  proxyReq.on("socket", (socket) => {
    socket.on("error", (err) => {
      console.error("Proxy Socket Error:", err);
      sendErrorResponse(res, 502, "Socket Error");
    });
  });

  proxyReq.on("error", (error) => {
    console.error("Proxy Request Error:", error);
    sendErrorResponse(res, 502, "Proxy Error", error.message);
  });

  // Use the configured timeout for the setTimeout function as well
  proxyReq.setTimeout(finalProxyConfig.timeout || 120000, () => {
    console.error(`Proxy Request Timeout waiting for backend (${finalProxyConfig.timeout}ms)`);
    sendErrorResponse(res, 504, "Backend server response timed out.");
    proxyReq.destroy(); // Destroy the request to free up resources
  });

  if (typeof proxyRequestBody === 'string') {
      proxyReq.write(proxyRequestBody);
  } else {
      proxyReq.write(JSON.stringify(proxyRequestBody));
  }
  proxyReq.end();
};
