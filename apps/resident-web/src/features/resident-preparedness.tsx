import { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Plan } from '@tandara/contracts';
import { formatTime } from '@tandara/ui';
import { residentDb } from '../offline/database.js';
import { WButton, WEmpty, WError, WLink, WProgress, WRow } from './chalk-ui.js';
import { useChecklist, useDesktop } from './resident-data.js';
import type { ResidentData } from './resident-data.js';
import { StreetMap, planPoints } from './resident-map.js';

export function useSavedPlans() {
  return useQuery({
    queryKey: ['saved-plans'],
    networkMode: 'always',
    queryFn: () =>
      residentDb.plans
        .toArray()
        .then((plans) => plans.sort((a, b) => b.cachedAt.localeCompare(a.cachedAt))),
  });
}
export function ChecklistCard({ plan, standalone = false }: { plan: Plan; standalone?: boolean }) {
  const { checks, count, total, toggle } = useChecklist(plan);
  const [saved, setSaved] = useState(false);
  return (
    <section className={'w-checklist ' + (standalone ? 'w-checklist-standalone' : 'w-card')}>
      <h2>Daftar kebutuhan keluarga</h2>
      <p className="w-muted">
        {count} dari {total} dicentang
      </p>
      <WProgress value={count} total={total} label="Daftar kebutuhan keluarga" />
      <div className="w-checklist-items">
        {plan.content.checklist.map((item) => (
          <label
            key={item}
            className={'w-check-item ' + (checks.includes(item) ? 'is-checked' : '')}
          >
            <input
              type="checkbox"
              checked={checks.includes(item)}
              onChange={() => {
                toggle(item);
                setSaved(false);
              }}
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      <WButton
        onClick={() => {
          localStorage.setItem(
            'tandara:checklist-saved:' + plan.regionId,
            new Date().toISOString(),
          );
          setSaved(true);
        }}
      >
        {saved ? 'Daftar disimpan' : 'Simpan daftar'}
      </WButton>
      {saved && (
        <p className="w-saved-message" role="status">
          Daftar kebutuhan diperbarui.
        </p>
      )}
    </section>
  );
}
export function PlanCard({
  plan,
  app,
  downloaded = false,
}: {
  plan: Plan;
  app: ResidentData;
  downloaded?: boolean;
}) {
  const navigate = useNavigate();
  const client = useQueryClient(),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const points = useMemo(() => planPoints(plan), [plan]);
  async function save() {
    setBusy(true);
    try {
      await residentDb.transaction('rw', residentDb.plans, async () => {
        await residentDb.plans.where('regionId').equals(plan.regionId).delete();
        await residentDb.plans.put({
          versionId: plan.id,
          regionId: plan.regionId,
          cachedAt: new Date().toISOString(),
          content: plan,
        });
      });
      await client.invalidateQueries({ queryKey: ['saved-plans'] });
      setMessage('Rencana diunduh. Bisa dibuka tanpa internet.');
    } catch {
      setMessage('Rencana belum dapat diunduh. Periksa ruang penyimpanan.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="w-card w-plan-card">
      <span className="w-pill">
        {app.region?.name} · Versi {plan.version}
      </span>
      <h2>{plan.content.title}</h2>
      <p className="w-plan-meta">
        {plan.owner}
        {plan.reviewedAt ? ' · ' + formatTime(plan.reviewedAt) : ''}
      </p>
      <ol className="w-plan-instructions">
        {plan.content.instructions.map((instruction, i) => (
          <li key={i}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <p>{instruction}</p>
          </li>
        ))}
      </ol>
      {points.length > 0 && (
        <>
          <div className="w-plan-map">
            <StreetMap
              compact
              region={app.region}
              points={points}
              onSelect={(id) => navigate('/map?panel=place&id=' + id)}
            />
          </div>
          {points.map((point) => (
            <WRow
              key={point.id}
              title={point.name}
              subtitle="Lihat titik kumpul di peta"
              icon="building"
              to={'/map?panel=place&id=' + point.id}
            />
          ))}
        </>
      )}
      {plan.content.routes.length > 0 && (
        <details className="w-plan-routes">
          <summary>Informasi akses</summary>
          {plan.content.routes.map((route, i) => (
            <div key={i}>
              <h3>{route.name}</h3>
              <p>{route.description}</p>
              <small>{route.reviewNote}</small>
            </div>
          ))}
        </details>
      )}
      {downloaded ? (
        <WLink secondary to="/plan">
          Buka rencana
        </WLink>
      ) : (
        <WButton secondary disabled={busy} onClick={() => void save()}>
          {busy ? 'Mengunduh…' : 'Unduh rencana'}
        </WButton>
      )}
      {message && (
        <p className="w-saved-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
export function PreparednessPage({ app, view }: { app: ResidentData; view: string }) {
  const desktop = useDesktop();
  const checklist = useChecklist(app.plan);
  const saved = useSavedPlans();
  const [params, setParams] = useSearchParams();
  if (view === '/downloads') {
    const plans = saved.data?.filter((p) => p.regionId === app.activeRegion) ?? [];
    const selected = plans[0];
    const checklistSelected = params.get('item') === 'checklist';
    return (
      <div>
        <h1>Unduhan</h1>
        {saved.isError && <WError>Unduhan belum dapat dibaca.</WError>}
        {selected ? (
          <div className="w-downloads-layout">
            <div className="w-stack">
              <WRow
                title={selected.content.content.title}
                subtitle={`Versi ${selected.content.version} · ${formatTime(selected.cachedAt)}`}
                icon="report"
                selected={!checklistSelected}
                onClick={() => setParams({})}
              />
              <WRow
                title="Daftar kebutuhan keluarga"
                subtitle={`${checklist.count} dari ${checklist.total} dicentang`}
                icon="shield"
                selected={checklistSelected}
                onClick={() => setParams({ item: 'checklist' })}
              />
            </div>
            {checklistSelected ? (
              <ChecklistCard plan={selected.content} />
            ) : (
              <PlanCard plan={selected.content} app={app} downloaded />
            )}
          </div>
        ) : (
          <WEmpty title="Belum ada unduhan">
            <p>Unduh rencana untuk membacanya tanpa internet.</p>
            <WLink to="/plan">Lihat rencana</WLink>
          </WEmpty>
        )}
      </div>
    );
  }
  if (!app.plan)
    return (
      <WEmpty title="Rencana belum tersedia">
        <p>Rencana akan muncul setelah diterbitkan Posko.</p>
      </WEmpty>
    );
  if (view === '/checklist')
    return (
      <div className="w-narrow">
        <h1>Daftar kebutuhan keluarga</h1>
        <ChecklistCard plan={app.plan} standalone />
      </div>
    );
  if (view === '/plan')
    return (
      <div className="w-plan-page">
        <h1>{app.plan.content.title}</h1>
        <PlanCard plan={app.plan} app={app} />
      </div>
    );
  return (
    <div className="w-guide">
      <h1>
        {desktop ? (
          'Panduan'
        ) : (
          <>
            Rencana dan
            <br />
            kebutuhan keluarga
          </>
        )}
      </h1>
      {desktop ? (
        <div className="w-guide-grid">
          <PlanCard plan={app.plan} app={app} />
          <ChecklistCard plan={app.plan} />
        </div>
      ) : (
        <Link to="/checklist" className="w-readiness-card">
          <small>DAFTAR KEBUTUHAN KELUARGA</small>
          <p>
            <strong>{checklist.count}</strong>
            <span>/ {checklist.total} dicentang</span>
          </p>
          <WProgress
            value={checklist.count}
            total={checklist.total}
            label="Daftar kebutuhan keluarga"
          />
          <b>Buka daftar kebutuhan →</b>
        </Link>
      )}
      <div className="w-guide-links">
        {!desktop && (
          <WRow
            to="/plan"
            title={app.plan.content.title}
            subtitle="Langkah evakuasi dan titik kumpul"
            icon="file"
          />
        )}
        <WRow
          to="/training"
          title="Kuis sumber informasi"
          subtitle={desktop ? undefined : 'Pelajari sumber informasi'}
          icon="book"
        />
        <WRow
          to="/downloads"
          title="Unduhan"
          subtitle={desktop ? undefined : 'Buka rencana tanpa internet'}
          icon="download"
        />
      </div>
    </div>
  );
}
