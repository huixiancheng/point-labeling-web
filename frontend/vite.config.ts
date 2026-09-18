import { defineConfig } from 'vite';

// The UI uses the full-resolution frame-window API exposed by the open backend.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8090', changeOrigin: true },
    },
  },
});
