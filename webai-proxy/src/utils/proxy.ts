import http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { Config, WebAIBody } from '../types';
import { sendErrorResponse } from './response';
import { createOllamaResponse } from './response';

/**
 * Create proxy request configuration
 */
export const createProxyConfig = (
  req: IncomingMessage,
  body: string,
  config: Config
): http.RequestOptions => ({
  host: config.targetDomain,
  port: config.targetPort,
  path: req.url === "/api/chat" ? "/prompt" : req.url,
  method: req.method,
  headers: {
    ...req.headers,
    host: `${config.targetDomain}:${config.targetPort}`,
    "content-length": Buffer.byteLength(body),
    "x-api-key": "1234",
  },
  timeout: 30000,
});

/**
 * Handle streaming response from proxy
 */
export const handleStreamResponse = async (proxyRes: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
    proxyRes.on("end", () => {
      try {
        const parsedChunks = chunks
          .map((chunk) => JSON.parse(chunk.toString()))
          .map((chunk) => chunk.choices.at(0).message.content)
          .filter((chunk) => typeof chunk === "string")
          .join("");
        resolve(parsedChunks);
      } catch (error) {
        reject(error);
      }
    });
    proxyRes.on("error", reject);
  });
};

/**
 * Handle proxy response
 */
export const handleProxyResponse = async (
  proxyRes: IncomingMessage,
  res: ServerResponse,
  body: string
): Promise<void> => {
  try {
    const isStream = proxyRes.headers["transfer-encoding"] === "chunked";
    const model = JSON.parse(body).model;

    if (isStream) {
      const response = await handleStreamResponse(proxyRes);
      const ollamaResponse = createOllamaResponse(response, model);

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(ollamaResponse)),
      });
      res.end(JSON.stringify(ollamaResponse));
    } else {
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const fullResponse = Buffer.concat(chunks).toString();
        const ollamaResponse = createOllamaResponse(fullResponse, model);
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        res.end(JSON.stringify(ollamaResponse));
      });
    }
  } catch (error) {
    console.error("Response Error:", error);
    sendErrorResponse(res, 502, "Response Error");
  }
};

/**
 * Setup proxy request with error handling
 */
export const setupProxyRequest = (
  proxyConfig: http.RequestOptions,
  webAiBody: WebAIBody | string,
  res: ServerResponse,
  body: string
): void => {
  const proxyReq = http.request(proxyConfig, async (proxyRes: IncomingMessage) => {
    await handleProxyResponse(proxyRes, res, body);
  });

  // Error handling
  proxyReq.on("socket", (socket) => {
    socket.on("error", () => {
      sendErrorResponse(res, 502, "Socket Error");
    });
  });

  proxyReq.on("error", (error) => {
    sendErrorResponse(res, 502, "Proxy Error", error.message);
  });

  proxyReq.setTimeout(30000, () => {
    sendErrorResponse(res, 504, "Gateway Timeout");
    proxyReq.destroy();
  });

  proxyReq.write(JSON.stringify(webAiBody));
  proxyReq.end();
};
