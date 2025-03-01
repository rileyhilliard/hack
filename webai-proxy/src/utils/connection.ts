import http from 'http';
import { Config } from '../types';

/**
 * Test connection to target server
 */
export async function testTargetConnection(config: Config): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: config.targetDomain,
        port: config.targetPort,
        path: '/',
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      }
    );

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
} 