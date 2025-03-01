#!/usr/bin/env node

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function build() {
  try {
    // Build the TypeScript code
    const result = await esbuild.build({
      entryPoints: [resolve(__dirname, 'src/server.ts')],
      bundle: true,
      platform: 'node',
      target: 'node22',
      outfile: resolve(__dirname, 'dist/server.js'),
      format: 'esm',
      sourcemap: true,
      external: ['http', 'util', 'child_process', 'url', 'path', 'fs', 'os', 'net'],
      // Ignore TypeScript errors
      logLevel: 'info',
      logLimit: 0,
      // Skip type checking
      tsconfigRaw: JSON.stringify({
        compilerOptions: {
          skipLibCheck: true,
          skipDefaultLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      }),
    });

    console.log('Build completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
