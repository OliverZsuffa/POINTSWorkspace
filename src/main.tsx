import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles/main.scss';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then((registration) => {
        const announceUpdate = () => window.dispatchEvent(new Event('points-update-ready'));
        if (registration.waiting && navigator.serviceWorker.controller) announceUpdate();
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', (event) => {
            const worker = event.target as ServiceWorker;
            if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
          });
        });
      })
      .catch(() => undefined);
  });
}
