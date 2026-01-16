import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 3300,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3301',
        changeOrigin: true
      }
    }
  }
});

