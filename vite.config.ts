import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages deployment base path
  base: '/it-workload-tracker/',
  server: {
    port: 5173,
    strictPort: true
  }
});


