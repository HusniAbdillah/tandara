import { createBrowserRouter } from 'react-router';
import { FoundationPage } from '../features/foundation/foundation-page.js';

export const router = createBrowserRouter([
  { path: '/', element: <FoundationPage /> },
  {
    path: '*',
    element: (
      <main>
        <h1>Halaman belum tersedia</h1>
        <a href="/">Kembali ke beranda</a>
      </main>
    ),
  },
]);
