import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

console.log('Main.tsx loading...');

try {
  const container = document.getElementById('root');
  console.log('Root container:', container);
  
  if (!container) {
    throw new Error('Root container not found');
  }
  
  const root = createRoot(container);
  console.log('React root created, rendering app...');
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('App rendered successfully');
} catch (error) {
  console.error('Error starting app:', error);
  
  // Fallback display
  const container = document.getElementById('root');
  if (container) {
    container.innerHTML = `
      <div style="padding: 20px; color: white; font-family: Arial;">
        <h1>IT Workload Tracker</h1>
        <p>Loading error: ${error}</p>
        <p>Please check the console for more details.</p>
      </div>
    `;
  }
}



