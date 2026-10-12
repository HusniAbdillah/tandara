import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@tandara/ui/styles.css';
import { Providers } from './app/providers.js';
import { router } from './app/router.js';
import { PwaUpdateNotice } from './app/pwa-update-notice.js';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(
  <StrictMode>
    <Providers>
      <PwaUpdateNotice />
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
