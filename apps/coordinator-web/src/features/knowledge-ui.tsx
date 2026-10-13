import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { Field, Notice, formatTime } from '@tandara/ui';
import type { ManagementProps } from './posko-app.js';
const ok = z.object({ ok: z.boolean() });
export function KnowledgeManagement({ region, user, run }: ManagementProps) {
  const schema = z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      text: z.string(),
      state: z.string(),
      sourceUrl: z.string(),
      expiresAt: z.string(),
      authorId: z.uuid(),
    }),
  );
  const query = useQuery({
    queryKey: ['knowledge-references', user.id, region.id],
    queryFn: () => request('/regions/' + region.id + '/knowledge/references', schema),
  });
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [licenseNote, setLicenseNote] = useState('');
  const [expiry, setExpiry] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  async function act(fn: () => Promise<unknown>) {
    setError('');
    try {
      await run(fn);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sumber tidak dapat disimpan.');
    }
  }
  return (
    <section className="panel">
      <h2>Referensi kesiapsiagaan wilayah</h2>
      <p>
        Teks referensi masuk pencarian setelah disetujui peninjau lain. Dokumen yang ditarik atau
        kedaluwarsa tidak digunakan.
      </p>
      <details>
        <summary>Tambahkan referensi untuk ditinjau</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await request(
                '/regions/' + region.id + '/knowledge/references',
                z.object({ id: z.uuid() }),
                {
                  method: 'POST',
                  body: {
                    title,
                    text,
                    sourceUrl,
                    licenseNote,
                    expiresAt: new Date(expiry).toISOString(),
                  },
                },
              );
              setTitle('');
              setText('');
            });
          }}
        >
          <Field label="Judul sumber">
            <input
              required
              minLength={5}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Teks referensi">
            <textarea
              required
              minLength={20}
              maxLength={12000}
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <Field label="Alamat sumber (HTTPS)">
            <input
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </Field>
          <Field label="Izin penggunaan dan pemilik sumber">
            <textarea
              required
              minLength={10}
              maxLength={1000}
              value={licenseNote}
              onChange={(e) => setLicenseNote(e.target.value)}
            />
          </Field>
          <Field label="Berlaku sampai">
            <input
              required
              type="datetime-local"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </Field>
          <button className="primary">Simpan untuk tinjauan</button>
        </form>
      </details>
      <Field label="Catatan peninjauan atau penarikan">
        <textarea
          minLength={10}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {query.isError ? (
        <Notice tone="error">Referensi tidak dapat dimuat.</Notice>
      ) : (
        query.data?.map((r) => (
          <details key={r.id}>
            <summary>
              {r.title} · {r.state}
            </summary>
            <p>{r.text}</p>
            <p className="meta">
              Berlaku sampai {formatTime(r.expiresAt)} ·{' '}
              <a href={r.sourceUrl} rel="noreferrer" target="_blank">
                Sumber asli
              </a>
            </p>
            <div className="actions">
              <button
                disabled={r.state !== 'draft' || r.authorId === user.id || note.trim().length < 10}
                onClick={() =>
                  void act(() =>
                    request(
                      '/regions/' + region.id + '/knowledge/references/' + r.id + '/review',
                      ok,
                      { method: 'POST', body: { action: 'approved', note } },
                    ),
                  )
                }
              >
                Setujui referensi
              </button>
              <button
                disabled={r.state === 'withdrawn' || note.trim().length < 10}
                onClick={() =>
                  void act(() =>
                    request(
                      '/regions/' + region.id + '/knowledge/references/' + r.id + '/review',
                      ok,
                      { method: 'POST', body: { action: 'withdrawn', note } },
                    ),
                  )
                }
              >
                Tarik referensi
              </button>
            </div>
          </details>
        ))
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
