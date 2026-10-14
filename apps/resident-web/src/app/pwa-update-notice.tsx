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
    <aside
      className="my-4 border-l-[3px] border-brand bg-[#eaf2ec] px-4 py-3 text-sm text-[#2b5245]"
      aria-label="Pembaruan aplikasi"
    >
      <p className="mb-3">Pembaruan tersedia. Simpan draft sebelum memuat ulang aplikasi.</p>
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
