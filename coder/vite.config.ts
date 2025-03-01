import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';
import nodeAdapter from '@hono/vite-dev-server/node';
import path from 'path';

export default defineConfig({
  server: {
    port: 4000,
    strictPort: false,
  },
  plugins: [
    devServer({
      entry: './src/server.ts',
      adapter: nodeAdapter,
      injectClientScript: true
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
  },
  optimizeDeps: {
    exclude: ['simple-git', '@hono/node-server']
  },
  build: {
    sourcemap: 'inline',
    lib: {
      entry: path.resolve(__dirname, 'src/server.ts'),
      formats: ['es'],
      fileName: 'server'
    },
    rollupOptions: {
      external: [
        /^node.*/,
        'node:buffer',
        'process',
        'os',
        'url',
        'fs',
        'path',
        'http',
        'http2',
        'https',
        'zlib',
        'stream',
        'buffer',
        'events',
        'crypto',
        'timers/promises',
        'child_process',
        'readline',
        'fs/promises'
      ],
      output: {
        format: 'es',
        entryFileNames: '[name].js'
      }
    },
    target: 'node22',
  }
});
