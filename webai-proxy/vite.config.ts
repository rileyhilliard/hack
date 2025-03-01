import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';
import nodeAdapter from '@hono/vite-dev-server/node';
import path from 'path';

export default defineConfig(() => {
  return {
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
    build: {
      sourcemap: 'inline',
      lib: {
        entry: path.resolve(__dirname, 'src/server.ts'),
        formats: ['es'],
        fileName: 'server'
      },
      rollupOptions: {
        external: [],
        output: {
          format: 'es',
          entryFileNames: '[name].js'
        }
      },
      target: 'node22',
    }
  };
});
