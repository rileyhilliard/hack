import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { WebAIBody } from '../types';
import { collectRequestBody, logRequest } from '../utils/request';
import { createProxyConfig, setupProxyRequest } from '../utils/proxy';
import { sendErrorResponse } from '../utils/response';
import { Config } from '../types';

/**
 * Response handlers for specific routes
 */
export const responseHandlers = {
  /**
   * Handle root path request (health check)
   */
  handleRootPath: (res: ServerResponse): void => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Ollama is running");
    console.log("n8n check, returning Ollama is running");
  },

  handleWebAiModelsCheck: (res: ServerResponse): void => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
    });
    res.end(
      JSON.stringify({
        models: [
          {
            name: "WebAI-LLM",
            modified_at: new Date().toISOString(),
            size: 0,
            digest: "sha256:o3mini",
            details: {
              format: "gguf",
              family: "ollama",
              families: ["ollama"],
              parameter_size: "3B",
              quantization_level: "Q4_0"
            }
          }
        ]
      })
    );
  },
};

/**
 * Main request handler
 */
export const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  config: Config
): Promise<void> => {
  try {
    const url = new URL(
      req.url || "/",
      `http://${config.targetDomain}:${config.targetPort}`
    );

    // Handle special routes
    if (url.pathname === "/") {
      return responseHandlers.handleRootPath(res);
    }

    if (url.pathname === "/api/tags") {
      return responseHandlers.handleWebAiModelsCheck(res);
    }

    // Process regular requests
    const body = await collectRequestBody(req);
    logRequest(req, url, body);

    const webAiBody = body ? { message: JSON.parse(body).messages } : "";
    const proxyConfig = createProxyConfig(req, JSON.stringify(webAiBody), config);

    setupProxyRequest(proxyConfig, webAiBody, res, body);
  } catch (error) {
    console.error("Server Error:", error);
    sendErrorResponse(res, 500, "Server Error");
  }
};
