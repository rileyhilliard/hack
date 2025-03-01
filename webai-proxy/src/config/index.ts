import { Config } from '../types/index.js';

export const DEFAULT_CONFIG: Config = {
  targetDomain: "localhost",
  targetPort: 10501,
  proxyDomain: "localhost",
  proxyPort: 8080,
};

export const getConfig = (): Config => ({
  targetDomain: process.argv[2] || DEFAULT_CONFIG.targetDomain,
  targetPort: parseInt(process.argv[3]) || DEFAULT_CONFIG.targetPort,
  proxyDomain: process.argv[4] || DEFAULT_CONFIG.proxyDomain,
  proxyPort: parseInt(process.argv[5]) || DEFAULT_CONFIG.proxyPort,
});
