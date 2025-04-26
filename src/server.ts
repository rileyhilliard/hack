import http, { IncomingMessage, ServerResponse } from 'http';
import { getConfig } from './config/index.js';
import { handleRequest } from './handlers/index.js';
import { testTargetConnection } from './utils/connection.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve the directory of the current module (dist/server.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct the absolute path to the .env file in the parent directory (project root)
const envPath = path.resolve(__dirname, '..', '.env');

// Explicitly configure dotenv with the path
dotenv.config({ path: envPath });

/**
 * Start the proxy server
 */
async function startProxy(): Promise<void> {
  const config = getConfig();
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => handleRequest(req, res, config));

  // Test target connection before starting
  const isTargetReachable = await testTargetConnection(config);

  if (!isTargetReachable) {
    console.warn(
        '\n⚠️  WARNING: Target server appears to be unreachable!\n' +
        `   Could not connect to http://${config.targetDomain}:${config.targetPort}\n` +
        '   Please ensure the target server is running or check your configuration.\n' +
        '   The proxy will start anyway, but requests may fail until the target is available.\n'
    );
  }

  // Server setup
  server.listen(config.proxyPort, () => {
    console.log(
      `Proxy Interface: http://${config.proxyDomain}:${config.proxyPort} -> Target: http://${config.targetDomain}:${config.targetPort}`
    );
    if (isTargetReachable) {
      console.log('✅ Target server connection verified.');
    }
  });

  interface ErrnoException extends Error {
    code?: string;
  }

  server.on("error", (error: ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Error: Port ${config.proxyPort} is already in use.`);
    } else {
      console.error("Server error:", error);
    }
    process.exit(1);
  });
}

// Start the proxy
startProxy();
