import { IncomingMessage, ServerResponse } from 'node:http';
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
  console.group(`
=== Incoming Request ===`);
  console.log(`  ${req.method} ${url.pathname}${url.search}`);
  console.log(`  From: ${req.socket.remoteAddress}`);
  console.group("  Headers:");
  console.log(req.headers);
  console.groupEnd();

  if (body) {
    console.group("  Body:");
    try {
      // Attempt to parse and log the object directly
      console.log(JSON.parse(body)); // Log the parsed object
    } catch {
      console.log("(raw):", body); // Log raw body if not JSON
    }
    console.groupEnd();
  } else {
    console.log("  Body: (empty)");
  }
  console.groupEnd(); // End main request group
};

/**
 * Log response details
 * @param res The ServerResponse object.
 * @param body Optional response body (string or object). If object, assumes JSON.
 * @param logHeaderAndStatus Controls if the initial status/header block is logged.
 */
export const logResponse = (
  res: ServerResponse,
  body?: string | object,
  logHeaderAndStatus: boolean = true // New parameter
): void => {
  let mainGroupStarted = false;
  if (logHeaderAndStatus) {
    console.group(`\n--- Outgoing Response ---`);
    mainGroupStarted = true;
    console.log(`  Status: ${res.statusCode} ${res.statusMessage}`);
    console.group("  Headers:");
    console.dir(res.getHeaders(), { depth: null }); // Use console.dir for headers
    console.groupEnd();
  }

  if (body) {
    console.group("  Body:");
    if (typeof body === 'object') {
      // If body is already an object, log it directly using console.dir for full depth
      console.dir(body, { depth: null }); // Use console.dir with infinite depth
    } else if (typeof body === 'string') {
      try {
        // Attempt to parse and log the object directly using console.dir
        console.dir(JSON.parse(body), { depth: null }); // Use console.dir with infinite depth
      } catch {
        // Log raw string body if not JSON
        console.log("(raw):", body);
      }
    } else {
         console.log("(unknown format):", body);
    }
    console.groupEnd();
  } else if (logHeaderAndStatus) { // Only log empty body if logging header
       console.log("  Body: (empty or not provided)");
  }

  if (mainGroupStarted) { // Conditionally close the main group
    console.groupEnd();
  }
}; 