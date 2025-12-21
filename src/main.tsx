import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Force SW registration
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('UsePWA: New content available, click on reload button to update.');
  },
  onOfflineReady() {
    console.log('UsePWA: App ready to work offline');
  },
  immediate: true
});

createRoot(document.getElementById('root')!).render(
  <App />
);
