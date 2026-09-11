import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import 'leaflet/dist/leaflet.css';

// Service Worker Auto-Update Registration & Controller Change Auto-Reload
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  // Check for new app deployments whenever user returns/focuses the tab or app
  window.addEventListener('focus', () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) reg.update();
    });
  });
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element #root not found in DOM');
  }

  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} catch (error: any) {
  console.error('CRITICAL STARTUP ERROR:', error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 24px; background: #1e293b; color: #f87171; font-family: monospace; border: 2px solid #ef4444; border-radius: 12px; margin: 20px;">
        <h2 style="color: #ef4444; margin-top: 0;">⚠️ Initialisierungsfehler</h2>
        <p>${error?.message || String(error)}</p>
        <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 12px;">Neu laden</button>
      </div>
    `;
  }
}

