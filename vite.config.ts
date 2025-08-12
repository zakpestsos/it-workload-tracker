import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use repo subpath for GitHub Pages so built assets resolve correctly
  base: '/it-workload-tracker/',
  server: {
    port: 5173,
    strictPort: true
  }
});


