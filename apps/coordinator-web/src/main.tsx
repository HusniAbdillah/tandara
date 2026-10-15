import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import '@tandara/ui/styles.css';
import { Providers } from './app/providers.js';
import { router } from './app/router.js';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);

const updateServiceWorker = registerSW({
  onNeedRefresh() {
    // Let the user choose when to reload, so an in-progress report is not interrupted.
    window.dispatchEvent(
      new CustomEvent('tandara:update-available', { detail: () => updateServiceWorker(true) }),
    );
  },
  onRegisterError() {
    console.error('Posko app shell could not be registered for offline use.');
  },
});
