import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/socket': {
        target: 'http://localhost:8080',
        ws: true
      }
    }
  }
});
