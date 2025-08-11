import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // Hardcoded credentials for production deployment
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('304831967056-kvdtr66m0ta8lm6gin3gf4f5q0naf47n.apps.googleusercontent.com'),
    'import.meta.env.VITE_GOOGLE_API_KEY': JSON.stringify('AIzaSyARpNQLLER7nub09yNmcn4ROZMYG2ZEo48')
  }
});


