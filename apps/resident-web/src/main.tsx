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

registerSW({
  onNeedRefresh() {
    // Never force-reload a page that may contain an unsent draft.
    window.dispatchEvent(new Event('tandara:update-available'));
  },
  onRegisterError() {
    console.error('Offline app shell registration failed.');
  },
});
