import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { request } from '@tandara/api-client';
import { operationsSchema, organizationSchema, regionSchema, userSchema } from '@tandara/contracts';
import type { Region, User } from '@tandara/contracts';
import { Badge, Field, Notice, PageHeader, formatTime, useClock } from '@tandara/ui';
import type { ManagementProps } from './posko-app.js';
import { categories, ok } from './reports-ui.js';

export function AdminPage({
  user,
  region,
  run,
}: Omit<ManagementProps, 'region'> & { region?: Region | undefined; regions: Region[] }) {
  const now = useClock();
  const [tab, setTab] = useState('operations');
  const [error, setError] = useState('');
  const [orgEdit, setOrgEdit] = useState<z.infer<typeof organizationSchema> | null | undefined>();
  const [userEdit, setUserEdit] = useState<User | null | undefined>();
  const [regionEdit, setRegionEdit] = useState<Region | null | undefined>();
  const orgs = useQuery({
    queryKey: ['organizations', user.id],
    queryFn: () => request('/admin/organizations', z.array(organizationSchema)),
  });
  const users = useQuery({
    queryKey: ['users', user.id],
    queryFn: () => request('/admin/users', z.array(userSchema)),
  });
  const regions = useQuery({
    queryKey: ['admin-regions', user.id],
    queryFn: () => request('/admin/regions', z.array(regionSchema)),
  });
  const ops = useQuery({
    queryKey: ['operations', user.id],
    queryFn: () => request('/admin/operations', operationsSchema),
    refetchInterval: 10000,
  });
  async function action(path: string) {
    try {
      await run(() => request(path, ok, { method: 'POST' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perubahan gagal.');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Administrasi / tata kelola"
        title="Konfigurasi yang dapat dipertanggungjawabkan."
        description="Kelola akses, wilayah, sumber, dan retensi. Semua perubahan penting masuk jejak audit."
      />
      <div className="actions" role="group" aria-label="Bagian administrasi">
        {[
          ['operations', 'Operasional'],
          ['organizations', 'Organisasi'],
          ['users', 'Akses pengguna'],
          ['regions', 'Wilayah'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? 'primary' : ''}
            onClick={() => {
              setTab(id!);
              setError('');
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <hr />
      {error && <Notice tone="error">{error}</Notice>}
      {tab === 'operations' &&
        (ops.isPending ? (
          <div className="loading">Memeriksa layanan…</div>
        ) : ops.isError ? (
          <Notice tone="error">Diagnostik tidak tersedia.</Notice>
        ) : (
          ops.data && (
            <>
              <div className="metrics">
                <div className="metric">
                  <h2>Database</h2>
                  <span className="number">{ops.data.database ? 'Terhubung' : 'Gagal'}</span>
                  <p>Hasil pemeriksaan koneksi saat ini</p>
                </div>
                <div className="metric">
                  <h2>Worker</h2>
                  <span className="number">
                    {ops.data.workerLastSeen && now - Date.parse(ops.data.workerLastSeen) < 30000
                      ? 'Aktif'
                      : 'Tidak terbaru'}
                  </span>
                  <p>Heartbeat {formatTime(ops.data.workerLastSeen)}</p>
                </div>
                <div className="metric">
                  <h2>Asisten triase</h2>
                  <span className="number">{ops.data.aiMode}</span>
                  <p>
                    {ops.data.aiMode === 'heuristic'
                      ? 'Aturan deterministik, bukan model live'
                      : 'Mode adapter yang dikonfigurasi'}
                  </p>
                </div>
              </div>
              <section className="panel">
                <h2>Permintaan penghapusan</h2>
                {ops.data.deletions.length ? (
                  ops.data.deletions.map((d) => (
                    <div className="source-details" key={d.id}>
                      <div>
                        <h3>Laporan {d.reportId.slice(0, 8)}</h3>
                        <Badge>{d.state}</Badge>
                        <p className="meta">
                          Diajukan {formatTime(d.createdAt)} · lokasi wilayah {d.regionId}
                        </p>
                      </div>
                      {d.state === 'requested' && (
                        <button
                          className="danger"
                          onClick={() => void action('/admin/deletions/' + d.id + '/complete')}
                        >
                          Hapus isi & data privat laporan
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="hint">Tidak ada permintaan penghapusan.</p>
                )}
              </section>
              <section className="panel">
                <h2>Antrean pekerjaan</h2>
                <p className="hint">
                  Maksimal 100 pekerjaan terbaru. Kegagalan memiliki retry terbatas dan backoff;
                  pekerjaan gagal dapat dijadwalkan ulang.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pekerjaan</th>
                        <th>Status</th>
                        <th>Percobaan</th>
                        <th>Waktu / tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ops.data.jobs.map((j) => (
                        <tr key={j.id}>
                          <td>
                            {j.kind}
                            <div className="code">{j.id.slice(0, 8)}</div>
                          </td>
                          <td>
                            <Badge
                              tone={
                                j.state === 'failed'
                                  ? 'red'
                                  : j.state === 'completed'
                                    ? 'teal'
                                    : 'amber'
                              }
                            >
                              {j.state}
                            </Badge>
                            {j.error && <p className="hint">{j.error}</p>}
                          </td>
                          <td>{j.attempts}</td>
                          <td>
                            {formatTime(j.createdAt)}
                            {j.state === 'failed' && (
                              <button
                                className="small"
                                onClick={() => void action('/admin/jobs/' + j.id + '/retry')}
                              >
                                Coba lagi
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )
        ))}
      {tab === 'organizations' && (
        <>
          {orgEdit !== undefined ? (
            <OrganizationEditor
              org={orgEdit ?? undefined}
              run={run}
              close={() => setOrgEdit(undefined)}
            />
          ) : (
            <section className="panel">
              <div className="panel-heading">
                <h2>Organisasi pengelola</h2>
                <button className="primary" onClick={() => setOrgEdit(null)}>
                  Tambah organisasi
                </button>
              </div>
              {orgs.isError && <Notice tone="error">Organisasi tidak dapat dimuat.</Notice>}
              {orgs.data?.map((o) => (
                <div className="source-details" key={o.id}>
                  <div>
                    <h3>{o.name}</h3>
                    <p>{o.description}</p>
                  </div>
                  <button onClick={() => setOrgEdit(o)}>Edit profil</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
      {tab === 'users' && (
        <>
          {userEdit !== undefined ? (
            <UserEditor
              user={userEdit ?? undefined}
              regions={regions.data ?? []}
              run={run}
              close={() => setUserEdit(undefined)}
            />
          ) : (
            <section className="panel">
              <div className="panel-heading">
                <h2>Keanggotaan & peran</h2>
                <button className="primary" onClick={() => setUserEdit(null)}>
                  Tambah pengguna
                </button>
              </div>
              {users.isError && <Notice tone="error">Pengguna tidak dapat dimuat.</Notice>}
              {users.data?.map((u) => (
                <div className="source-details" key={u.id}>
                  <div>
                    <h3>{u.name}</h3>
                    <p>{u.email}</p>
                    <Badge tone={u.suspended ? 'red' : 'teal'}>
                      {u.suspended ? 'Ditangguhkan' : u.role}
                    </Badge>
                    <p className="hint">
                      Wilayah:{' '}
                      {u.regionIds
                        .map((id) => regions.data?.find((r) => r.id === id)?.name ?? id)
                        .join(', ') || 'Semua wilayah (admin) / tanpa penugasan'}
                    </p>
                  </div>
                  <button onClick={() => setUserEdit(u)}>Tinjau akses</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
      {tab === 'regions' && (
        <>
          {regionEdit !== undefined ? (
            <RegionEditor
              region={regionEdit ?? undefined}
              orgs={orgs.data ?? []}
              run={run}
              close={() => setRegionEdit(undefined)}
            />
          ) : (
            <section className="panel">
              <div className="panel-heading">
                <h2>Konfigurasi per wilayah</h2>
                <button className="primary" onClick={() => setRegionEdit(null)}>
                  Tambah wilayah
                </button>
              </div>
              {regions.isError && <Notice tone="error">Wilayah tidak dapat dimuat.</Notice>}
              {regions.data?.map((r) => (
                <div className="source-details" key={r.id}>
                  <div>
                    <h3>{r.name}</h3>
                    <p>{r.organization}</p>
                    <Badge tone={r.suspended ? 'red' : 'teal'}>
                      {r.suspended ? 'Dinonaktifkan' : 'Aktif'}
                    </Badge>
                    <p className="hint">
                      Cakupan {r.config.coverageHours} jam · retensi kontak {r.config.retentionDays}{' '}
                      hari · {r.config.categories.length} jenis laporan
                    </p>
                  </div>
                  <button onClick={() => setRegionEdit(r)}>Konfigurasi</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
      <p className="meta">
        Wilayah konteks saat ini: {region?.name ?? 'Belum ada wilayah'}. Backup dan pemulihan
        dijalankan melalui runbook, tidak dilabeli berhasil tanpa hasil pengujian.
      </p>
    </>
  );
}
function OrganizationEditor({
  org,
  run,
  close,
}: {
  org: z.infer<typeof organizationSchema> | undefined;
  run: ManagementProps['run'];
  close: () => void;
}) {
  const [name, setName] = useState(org?.name ?? '');
  const [description, setDescription] = useState(org?.description ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(() =>
            request('/admin/organizations', z.object({ id: z.uuid() }), {
              method: 'POST',
              body: { ...(org ? { id: org.id } : {}), name, description },
            }),
          );
          close();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Profil organisasi</h2>
      <Field label="Nama organisasi">
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} />
      </Field>
      <Field label="Profil & tanggung jawab">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <button className="primary" disabled={busy}>
          Simpan organisasi
        </button>
        <button type="button" onClick={close}>
          Batalkan
        </button>
      </div>
    </form>
  );
}
function UserEditor({
  user,
  regions,
  run,
  close,
}: {
  user: User | undefined;
  regions: Region[];
  run: ManagementProps['run'];
  close: () => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role ?? 'coordinator');
  const [ids, setIds] = useState(user?.regionIds ?? []);
  const [suspended, setSuspended] = useState(user?.suspended ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(() =>
            request('/admin/users', z.object({ id: z.uuid() }), {
              method: 'POST',
              body: {
                ...(user ? { id: user.id } : {}),
                name,
                email,
                ...(password ? { password } : {}),
                role,
                regionIds: ids,
                suspended,
              },
            }),
          );
          close();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Perubahan akses gagal.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{user ? 'Tinjau akses pengguna' : 'Pengguna baru'}</h2>
      <div className="form-grid">
        <Field label="Nama">
          <input required minLength={3} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field
          label="Kata sandi baru"
          hint={
            user
              ? 'Kosongkan untuk mempertahankan. Min. 12 karakter.'
              : 'Min. 12 karakter; bagikan melalui kanal aman.'
          }
        >
          <input
            type="password"
            required={!user}
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Peran">
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="coordinator">Koordinator wilayah</option>
            <option value="admin">Administrator platform</option>
          </select>
        </Field>
      </div>
      <fieldset>
        <legend>Penugasan wilayah</legend>
        {regions.map((r) => (
          <label className="checklist-item" key={r.id}>
            <input
              type="checkbox"
              checked={ids.includes(r.id)}
              onChange={(e) =>
                setIds(e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id))
              }
            />
            {r.name} · {r.organization}
          </label>
        ))}
      </fieldset>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={suspended}
          onChange={(e) => setSuspended(e.target.checked)}
        />
        Tangguhkan akun
      </label>
      <Notice>
        Perubahan peran, kata sandi, atau penugasan akan mengakhiri seluruh sesi pengguna.
        Administrator dapat mengakses semua wilayah.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <button className="primary" disabled={busy}>
          Simpan akses
        </button>
        <button type="button" onClick={close}>
          Batalkan
        </button>
      </div>
    </form>
  );
}
function RegionEditor({
  region,
  orgs,
  run,
  close,
}: {
  region: Region | undefined;
  orgs: z.infer<typeof organizationSchema>[];
  run: ManagementProps['run'];
  close: () => void;
}) {
  const [name, setName] = useState(region?.name ?? '');
  const [org, setOrg] = useState(region?.organizationId ?? orgs[0]?.id ?? '');
  const [selected, setSelected] = useState<string[]>(
    region?.config.categories ?? ['road_flooding', 'other'],
  );
  const [hours, setHours] = useState(region?.config.coverageHours ?? 6);
  const [days, setDays] = useState(region?.config.retentionDays ?? 30);
  const [boundary, setBoundary] = useState(
    JSON.stringify(region?.boundary ?? { type: 'Polygon', coordinates: [] }, null, 2),
  );
  const [contacts, setContacts] = useState(JSON.stringify(region?.config.contacts ?? [], null, 2));
  const [suspended, setSuspended] = useState(region?.suspended ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(() =>
            request('/admin/regions', z.object({ id: z.uuid() }), {
              method: 'POST',
              body: {
                ...(region ? { id: region.id } : {}),
                name,
                organizationId: org,
                config: {
                  categories: selected,
                  coverageHours: hours,
                  retentionDays: days,
                  contacts: JSON.parse(contacts),
                  languages: ['id'],
                },
                boundary: JSON.parse(boundary),
                suspended,
              },
            }),
          );
          close();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Konfigurasi wilayah gagal.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Konfigurasi wilayah</h2>
      <div className="form-grid">
        <Field label="Nama wilayah">
          <input required minLength={3} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Organisasi pemilik">
          <select required value={org} onChange={(e) => setOrg(e.target.value)}>
            {orgs.map((o) => (
              <option value={o.id} key={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Jendela cakupan (jam)">
          <input
            type="number"
            required
            min={1}
            max={168}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </Field>
        <Field label="Retensi kontak privat (hari)">
          <input
            type="number"
            required
            min={7}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </Field>
      </div>
      <fieldset>
        <legend>Jenis laporan yang didukung</legend>
        {Object.entries(categories).map(([id, label]) => (
          <label className="checklist-item" key={id}>
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={(e) =>
                setSelected(e.target.checked ? [...selected, id] : selected.filter((c) => c !== id))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Field
        label="Batas wilayah (GeoJSON Polygon)"
        hint="Urutan koordinat longitude, latitude; ring tertutup dan valid. Wilayah baru memerlukan batas yang disepakati pengelola."
      >
        <textarea
          className="json-editor"
          value={boundary}
          onChange={(e) => setBoundary(e.target.value)}
        />
      </Field>
      <Field
        label="Kontak yang ditinjau (JSON array)"
        hint="Setiap kontak berisi name, channel, sourceUrl (HTTPS), reviewedAt (ISO). Jangan membuat nomor untuk demo."
      >
        <textarea
          className="json-editor"
          value={contacts}
          onChange={(e) => setContacts(e.target.value)}
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={suspended}
          onChange={(e) => setSuspended(e.target.checked)}
        />
        Nonaktifkan wilayah untuk pembacaan publik dan laporan baru
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <button className="primary" disabled={busy}>
          Simpan wilayah
        </button>
        <button type="button" onClick={close}>
          Batalkan
        </button>
      </div>
    </form>
  );
}
