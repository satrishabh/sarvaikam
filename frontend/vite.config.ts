import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API calls to locally running services (same paths nginx routes in prod).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/content': 'http://localhost:8081',
      '/api/auth': 'http://localhost:8082',
      '/api/progress': 'http://localhost:8083',
    },
  },
});
