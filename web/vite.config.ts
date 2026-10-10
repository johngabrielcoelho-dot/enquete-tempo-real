import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/socket.io': { target: apiTarget, ws: true },
    },
  },
  build: {
    rollupOptions: {
      input: {
        criar: resolve(import.meta.dirname, 'index.html'),
        votar: resolve(import.meta.dirname, 'vote.html'),
        resultado: resolve(import.meta.dirname, 'result.html'),
      },
    },
  },
});
