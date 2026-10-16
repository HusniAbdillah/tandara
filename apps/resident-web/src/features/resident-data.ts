import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@tandara/api-client';
import {
  publicDataSchema,
  regionSchema,
  planSchema,
  residentSessionSchema,
  residentNotificationsSchema,
} from '@tandara/contracts';
import type { Plan, PublicData } from '@tandara/contracts';
import { z } from 'zod';
import { residentDb } from '../offline/database.js';
import { synchronize } from '../offline/sync.js';
import { useOnlineStatus } from '../offline/use-online-status.js';

export function useDesktop() {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia('(min-width: 1024px)');
      media.addEventListener('change', callback);
      return () => media.removeEventListener('change', callback);
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => false,
  );
}
export function useResidentData() {
  const online = useOnlineStatus();
  const [regionId, setRegionId] = useState(() => localStorage.getItem('tandara:region') ?? '');
  const regions = useQuery({
    queryKey: ['regions', online],
    networkMode: 'always',
    queryFn: async () => {
      try {
        const result = await request('/regions', z.array(regionSchema));
        localStorage.setItem('tandara:regions', JSON.stringify(result));
        return result;
      } catch (error) {
        const saved = localStorage.getItem('tandara:regions');
        if (saved) return z.array(regionSchema).parse(JSON.parse(saved));
        throw error;
      }
    },
  });
  const activeRegion = regionId || regions.data?.[0]?.id || '';
  const data = useQuery({
    queryKey: ['public', activeRegion, online],
    networkMode: 'always',
    enabled: !!activeRegion,
    queryFn: async (): Promise<PublicData> => {
      try {
        if (!navigator.onLine) throw new Error('Offline');
        return await request('/regions/' + activeRegion + '/public', publicDataSchema);
      } catch (error) {
        const saved = (
          await residentDb.plans.where('regionId').equals(activeRegion).toArray()
        ).sort((a, b) => b.cachedAt.localeCompare(a.cachedAt))[0];
        const region = regions.data?.find((r) => r.id === activeRegion);
        if (saved && region)
          return {
            region,
            plans: [planSchema.parse(saved.content)],
            information: [],
            reports: [],
            sources: [],
            fetchedAt: saved.cachedAt,
          };
        throw error;
      }
    },
    refetchInterval: online ? 60000 : false,
  });
  const session = useQuery({
    queryKey: ['resident-session'],
    networkMode: 'always',
    queryFn: () => request('/resident/auth/me', residentSessionSchema),
    retry: false,
    refetchInterval: online ? 30000 : false,
    refetchOnWindowFocus: 'always',
  });
  const notifications = useQuery({
    queryKey: ['resident-personal-notifications', session.data?.user?.id],
    enabled: !!session.data?.user && online,
    queryFn: () => request('/resident/notifications', residentNotificationsSchema),
    refetchInterval: online ? 15000 : false,
    retry: false,
  });
  useEffect(() => {
    const sync = () => {
      void synchronize().catch(() => {});
    };
    sync();
    window.addEventListener('online', sync);
    const timer = setInterval(sync, 30000);
    return () => {
      window.removeEventListener('online', sync);
      clearInterval(timer);
    };
  }, [session.data?.user?.id]);
  function choose(id: string) {
    localStorage.setItem('tandara:region', id);
    setRegionId(id);
  }
  return {
    online,
    regions,
    activeRegion,
    choose,
    data,
    session,
    notifications,
    region: data.data?.region ?? regions.data?.find((r) => r.id === activeRegion),
    plan: data.data?.plans[0],
  };
}
export type ResidentData = ReturnType<typeof useResidentData>;
export function useChecklist(plan: Plan | undefined) {
  const client = useQueryClient();
  const key = 'tandara:checklist:' + (plan?.regionId ?? '');
  const query = useQuery({
    queryKey: ['checklist', key],
    networkMode: 'always',
    queryFn: () => {
      try {
        return z.array(z.string()).parse(JSON.parse(localStorage.getItem(key) ?? '[]'));
      } catch {
        return [];
      }
    },
    initialData: () => {
      try {
        return z.array(z.string()).parse(JSON.parse(localStorage.getItem(key) ?? '[]'));
      } catch {
        return [];
      }
    },
  });
  function toggle(item: string) {
    const next = query.data.includes(item)
      ? query.data.filter((x) => x !== item)
      : [...query.data, item];
    localStorage.setItem(key, JSON.stringify(next));
    client.setQueryData(['checklist', key], next);
    window.dispatchEvent(new Event('tandara:checklist'));
  }
  return {
    checks: query.data,
    count: plan?.content.checklist.filter((x) => query.data.includes(x)).length ?? 0,
    total: plan?.content.checklist.length ?? 0,
    toggle,
  };
}
export { residentCsrf } from '../account/session.js';
