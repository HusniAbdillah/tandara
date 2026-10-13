import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { knowledgeResultSchema } from '@tandara/contracts';
import { Badge, Empty, Field, Notice, PageHeader, formatTime } from '@tandara/ui';
export function KnowledgeSearch({ regionId, online }: { regionId: string; online: boolean }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const results = useQuery({
    queryKey: ['approved-knowledge', regionId, query],
    queryFn: () =>
      request(
        '/regions/' + regionId + '/knowledge?q=' + encodeURIComponent(query),
        z.array(knowledgeResultSchema),
      ),
    enabled: online && query.length >= 2,
    retry: false,
  });
  return (
    <>
      <PageHeader
        eyebrow="SUMBER DISETUJUI"
        title="Cari petikan sumber"
        description="Baca bagian dari rencana lokal dan referensi yang ditinjau, diterbitkan, dan masih berlaku."
      />
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <Field label="Kata kunci rencana">
          <input
            required
            minLength={2}
            maxLength={1500}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Misalnya: dokumen, titik kumpul, air minum"
          />
        </Field>
        <button className="primary" disabled={!online}>
          Cari sumber
        </button>
      </form>
      {!online && (
        <Notice tone="warning">
          Pencarian memerlukan koneksi untuk memeriksa versi rencana terkini. Rencana yang telah
          disimpan tetap tersedia dari halaman rencana.
        </Notice>
      )}
      {results.isFetching ? (
        <p role="status">Mencari petikan…</p>
      ) : results.isError ? (
        <Notice tone="error">Pencarian tidak tersedia. Coba lagi nanti.</Notice>
      ) : query && results.data?.length === 0 ? (
        <Empty title="Belum ada sumber yang sesuai">
          Coba kata kunci lain atau hubungi pengelola wilayah. Ketiadaan petikan tidak berarti
          keadaan aman.
        </Empty>
      ) : (
        results.data?.map((r) => (
          <article className="panel" key={r.id}>
            <Badge tone={r.simulation ? 'amber' : 'teal'}>
              {r.simulation
                ? 'Simulasi'
                : r.kind === 'reference'
                  ? 'Referensi disetujui'
                  : 'Rencana disetujui'}
            </Badge>
            <h2>{r.title}</h2>
            <blockquote>{r.text}</blockquote>
            <p className="meta">
              Bagian {r.section} · Versi {r.version} · Berlaku sampai {formatTime(r.expiresAt)}
            </p>
            {r.kind === 'plan' ? (
              <a href="/plan">Baca rencana lengkap</a>
            ) : (
              r.sourceUrl && (
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  Buka sumber referensi
                </a>
              )
            )}
          </article>
        ))
      )}
      <p className="meta">
        Petikan sumber asli. Rencana tidak memastikan keadaan atau keamanan rute saat ini.
      </p>
    </>
  );
}
