import { useState } from 'react';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { Field, Notice, PageHeader } from '@tandara/ui';
export function AccountSecurity() {
  const [password, setPassword] = useState('');
  const [oldCode, setOldCode] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="AKUN POSKO"
        title="Autentikator akun"
        description="Tambahkan autentikator untuk mengamankan akses. Aktivasi akan mengakhiri semua sesi akun."
      />
      <section className="panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              setEnrollment(
                await request(
                  '/auth/mfa/enroll',
                  z.object({ secret: z.string(), uri: z.string() }),
                  { method: 'POST', body: { password, ...(oldCode ? { code: oldCode } : {}) } },
                ),
              );
              setPassword('');
              setOldCode('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Aktivasi gagal.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Kata sandi saat ini">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={200}
            />
          </Field>
          <Field label="Kode autentikator lama (jika mengganti)">
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              value={oldCode}
              onChange={(e) => setOldCode(e.target.value)}
              pattern="[0-9]{6}"
              maxLength={6}
            />
          </Field>
          <button disabled={busy}>Siapkan autentikator</button>
        </form>
        {enrollment && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await request('/auth/mfa/confirm', z.object({ ok: z.boolean() }), {
                  method: 'POST',
                  body: { code },
                });
                setEnrollment(null);
                window.location.assign('/');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Kode tidak sesuai.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Notice>
              Simpan rahasia ini dalam aplikasi autentikator Anda. Jangan bagikan kepada orang lain.
            </Notice>
            <Field label="Rahasia untuk aplikasi autentikator">
              <input readOnly value={enrollment.secret} autoComplete="off" />
            </Field>
            <Field label="Kode dari autentikator baru">
              <input
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <button className="primary" disabled={busy}>
              Aktifkan dan masuk kembali
            </button>
          </form>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </section>
    </>
  );
}
