import { IncomingMessage } from 'node:http';
import { URL } from 'node:url';

/**
 * Collect request body from IncomingMessage
 */
export const collectRequestBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
};

/**
 * Log request details
 */
export const logRequest = (req: IncomingMessage, url: URL, body?: string): void => {
  console.log("\n=== Incoming Request ===");
  console.log("Method:", req.method);
  console.log("URL:", url.pathname);
  console.log("Query params:", Object.fromEntries([...url.searchParams.entries()]));
  console.log("Headers:", req.headers);

  if (body) {
    try {
      console.log("Body:", JSON.parse(body));
    } catch {
      console.log("Body (raw):", body);
    }
  }
}; 