import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { collectRequestBody, logRequest, logResponse } from '../utils/request';
import { createProxyConfig, setupProxyRequest } from '../utils/proxy';
import { sendErrorResponse } from '../utils/response';
import { Config } from '../types';

// Handlers for specific endpoints that don't need proxying
export const directResponseHandlers = {
  handleRootPath: (res: ServerResponse): void => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    const body = "Ollama is running";
    logResponse(res, body); // Log before ending
    res.end(body);
    console.log("Health check request, responding OK");
  },

  handleOllamaTags: (res: ServerResponse): void => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS", // Only GET needed for tags
      "Access-Control-Allow-Headers": "content-type",
    });
    // Respond with Ollama-compatible model list
    const body = {
      models: [
        {
          name: "webai-llm", // Use the desired model ID
          modified_at: new Date().toISOString(),
          size: 0,
          digest: "webai-proxy", // Simplified digest
          details: {
            format: "gguf",
            family: "webai",
            families: null, // Can be null
            parameter_size: "N/A",
            quantization_level: "N/A"
          }
        }
      ]
    };
    logResponse(res, body); // Log before ending
    res.end(JSON.stringify(body));
  },

  handleOpenAIModels: (res: ServerResponse): void => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
    });
    // Respond with OpenAI-compatible model list
    const body = {
      object: "list",
      data: [
        {
          id: "webai-llm", // Model ID clients will use
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "webai-proxy",
        },
      ],
    };
    logResponse(res, body); // Log before ending
    res.end(JSON.stringify(body));
  },

  handleOptions: (res: ServerResponse): void => {
    res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", // Allow relevant methods
        "Access-Control-Allow-Headers": "authorization, content-type", // Allow relevant headers
        "Access-Control-Max-Age": 86400, // Cache preflight for 1 day
    });
    logResponse(res); // Log before ending (no body - body parameter is optional)
    res.end();
  }
};

// Main request handler: routes requests or proxies them
export const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  config: Config
): Promise<void> => {
  const requestStartTime = process.hrtime.bigint();
  try {
    // Use localhost as base if host is missing in request URL
    const base = `http://${req.headers.host || 'localhost'}`;
    const url = new URL(req.url || "/", base);

    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return directResponseHandlers.handleOptions(res);
    }

    // Direct handlers for specific paths
    switch (url.pathname) {
      case '/': return directResponseHandlers.handleRootPath(res);
      case '/api/tags': return directResponseHandlers.handleOllamaTags(res);
      case '/v1/models': return directResponseHandlers.handleOpenAIModels(res);
    }

    // --- Proxy Logic --- 

    // Ensure request body is collected only when needed (POST/PUT)
    let originalRequestBody = '';
    if (req.method === 'POST' || req.method === 'PUT') {
        originalRequestBody = await collectRequestBody(req);
    }
    logRequest(req, url, originalRequestBody); // Log before proxying

    let proxyRequestBody: string | undefined;
    let isStreamingRequest = false;
    let modelRequested = 'webai-llm'; // Default model

    // Parse body and determine proxy body structure
    if (originalRequestBody) {
        try {
            const parsedBody = JSON.parse(originalRequestBody);
            isStreamingRequest = !!parsedBody.stream;
            modelRequested = parsedBody.model || modelRequested;

            // Both Ollama (/api/chat) and OpenAI (/v1/chat/completions)
            // requests are transformed to the format expected by the target /prompt endpoint.
            if (url.pathname === "/api/chat" || url.pathname === "/v1/chat/completions") {
                 proxyRequestBody = JSON.stringify({ message: parsedBody.messages });
            } else {
                // For other paths, proxy the original body
                proxyRequestBody = originalRequestBody;
            }
        } catch (err: any) {
            console.error("Invalid JSON in request body:", err);
            return sendErrorResponse(
                res,
                400,
                "Invalid JSON in Request Body",
                err instanceof Error ? err.message : "Unknown parsing error"
            );
        }
    } else if (req.method === 'POST' || req.method === 'PUT') {
        // Handle POST/PUT requests that require a body but didn't provide one
        console.warn("Request requires body but none provided for:", url.pathname);
        return sendErrorResponse(res, 400, "Missing Request Body", "This endpoint requires a JSON request body, but none was provided.");
    }

    // Create config and execute proxy request
    const proxyConfig = createProxyConfig(req, proxyRequestBody || '', config);
    setupProxyRequest(
        proxyConfig,
        proxyRequestBody || '',
        res,
        originalRequestBody || '',
        isStreamingRequest,
        url.pathname,
        modelRequested,
        config,
        requestStartTime
    );

  } catch (error) {
    // General error handling
    console.error("handleRequest Error:", error);
    // Ensure response isn't already sent/ended before sending error
    if (!res.writableEnded) {
        // Improve generic 500 message
        sendErrorResponse(res, 500, "Proxy Internal Error", "The proxy encountered an unexpected error while processing your request.");
    }
  }
};
