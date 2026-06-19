import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registrar el Service Worker de forma segura y controlada.
// En un entorno de desarrollo de iframe (como AI Studio Preview), intentar registrar un Service Worker
// genera excepciones de seguridad DOMException debido a restricciones de sandbox.
// Por ello, solo iniciamos el registro si el navegador lo soporta y NO estamos en un iframe (window.self === window.top)
if ('serviceWorker' in navigator) {
  try {
    if (window.self === window.top) {
      window.addEventListener('load', () => {
        // En desarrollo o producción, registramos el Service Worker principal
        const swUrl = '/sw.js';
        navigator.serviceWorker.register(swUrl)
          .then((registration) => {
            console.log('DolarFlow PWA ServiceWorker registrado con éxito: ', registration.scope);
          })
          .catch((err) => {
            console.debug('Error registrando el ServiceWorker (no crítico): ', err);
          });
      });
    } else {
      console.log('Aplicación ejecutada dentro de un iframe. Se omite el ServiceWorker para evitar restricciones de sandbox del navegador.');
    }
  } catch (e) {
    console.debug('La validación de ServiceWorker no está permitida en este contexto:', e);
  }
}
