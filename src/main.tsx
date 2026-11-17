import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// La WebApp se instala y funciona sin conexión. En la app de escritorio no hace falta.
// La versión de un solo archivo tampoco lo usa: no tiene archivos que guardar en caché.
if (import.meta.env.PROD && import.meta.env.MODE !== 'unico' && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* sin service worker la app sigue funcionando con conexión */
  });
}
