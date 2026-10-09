import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Em desenvolvimento o Vite repassa /api e /socket.io para a API (porta 3000).
// Assim o front sempre usa caminhos relativos, e em produção o Nginx faz o mesmo papel.
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
