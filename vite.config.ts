import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    watch: {
      ignored: ['**/tools/api-recon/**', '**/server/data/**', '**/server/node_modules/**']
    },
    // Forward /api/* to the sync-server backend (server/) so the frontend
    // client (src/api/cloudlabs.ts) works in dev without hardcoding a host.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
