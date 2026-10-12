import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdateNotice() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      console.error('Offline app shell registration failed.');
    },
  });
  if (!needRefresh) return null;
  return (
    <aside className="notice" aria-label="Pembaruan aplikasi">
      <p>Pembaruan tersedia. Simpan draft sebelum memuat ulang aplikasi.</p>
      <button
        onClick={() => {
          void updateServiceWorker(true);
        }}
      >
        Muat pembaruan
      </button>
    </aside>
  );
}
