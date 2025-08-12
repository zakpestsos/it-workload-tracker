import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use relative paths for GitHub Pages deployment
  base: './',
  server: {
    port: 5173,
    strictPort: true
  }
});


