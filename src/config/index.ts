import { Config } from '../types/index.js';

// Default values - will be overridden by .env file if present
export const DEFAULT_CONFIG: Config = {
  targetDomain: "localhost",
  targetPort: 10501,
  proxyDomain: "localhost",
  proxyPort: 8080,
  targetApiKey: undefined,
  targetTimeoutMs: 120000 // Default 2 minutes
};

// Reads config primarily from environment variables (.env file), with defaults as fallback.
export const getConfig = (): Config => ({
  targetDomain: process.env.TARGET_DOMAIN || DEFAULT_CONFIG.targetDomain,
  targetPort: parseInt(process.env.TARGET_PORT || String(DEFAULT_CONFIG.targetPort)),
  proxyDomain: process.env.PROXY_DOMAIN || DEFAULT_CONFIG.proxyDomain,
  proxyPort: parseInt(process.env.PROXY_PORT || String(DEFAULT_CONFIG.proxyPort)),
  targetApiKey: process.env.TARGET_API_KEY || DEFAULT_CONFIG.targetApiKey,
  targetTimeoutMs: parseInt(process.env.TARGET_TIMEOUT_MS || String(DEFAULT_CONFIG.targetTimeoutMs || 120000))
});
