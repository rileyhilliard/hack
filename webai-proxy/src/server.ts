import http, { IncomingMessage, ServerResponse } from 'http';
import { getConfig } from './config/index.js';
import { handleRequest } from './handlers/index.js';
import { testTargetConnection } from './utils/connection.js';

/**
 * Start the proxy server
 */
async function startProxy(): Promise<void> {
  const config = getConfig();
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => handleRequest(req, res, config));

  // Test target connection before starting
  const isTargetReachable = await testTargetConnection(config);

  if (!isTargetReachable) {
    console.warn('\n⚠️  WARNING: Target server appears to be unreachable!');
    console.warn(`   Could not connect to http://${config.targetDomain}:${config.targetPort}`);
    console.warn('   Please ensure the target server is running or check your configuration.');
    console.warn('   The proxy will start anyway, but requests may fail until the target is available.\n');
  }

  // Server setup
  server.listen(config.proxyPort, () => {
    console.log(
      `Proxy BETWEEN:   'http://${config.targetDomain}:${config.targetPort}'`
    );
    console.log(
      `Proxy INTERFACE: 'http://${config.proxyDomain}:${config.proxyPort}'`
    );

    if (isTargetReachable) {
      console.log('✅ Target server is reachable and responding');
    }
  });

  interface ErrnoException extends Error {
    code?: string;
  }

  server.on("error", (error: ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${config.proxyPort} is already in use`);
    } else {
      console.error("Server error:", error);
    }
    process.exit(1);
  });
}

// Start the proxy
startProxy();
