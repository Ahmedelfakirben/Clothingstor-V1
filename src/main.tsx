/// <reference types="vite-plugin-pwa/client" />
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Force SW registration
registerSW({
  onNeedRefresh() {
    console.log('UsePWA: New content available, click on reload button to update.');
  },
  onOfflineReady() {
    console.log('UsePWA: App ready to work offline');
  },
  onRegistered(r: ServiceWorkerRegistration | undefined) {
    console.log('UsePWA: Service Worker registered successfully:', r);
  },
  onRegisterError(error: Error | any) {
    console.error('UsePWA: Service Worker registration failed:', error);
  },
  immediate: true
});

createRoot(document.getElementById('root')!).render(
  <App />
);
