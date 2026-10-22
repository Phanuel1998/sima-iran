import type { Visit, VisitFormData } from '../types.ts';
import {
  addToOfflineQueue,
  getOfflineQueue,
  clearOfflineQueue,
  getCachedVisits,
  cacheVisits,
} from './offlineStorage.ts';

const API_BASE = '/api';

export async function fetchVisits(): Promise<{ visits: Visit[]; isOffline: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/visits`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.success && Array.isArray(data.visits)) {
      const serverVisits: Visit[] = data.visits.map((v: any) => ({ ...v, synced: true }));
      // Check if there are local unsynced offline items to merge
      const offlineQueue = getOfflineQueue();
      const offlineIds = new Set(offlineQueue.map((item) => item.client_id));
      const localCached = getCachedVisits().filter((v) => !v.synced && offlineIds.has(String(v.id)));

      const merged = [...localCached, ...serverVisits];
      cacheVisits(merged);
      return { visits: merged, isOffline: false };
    }
    throw new Error('Invalid server response');
  } catch (err) {
    console.warn('Network request failed, falling back to local cached visits:', err);
    const cached = getCachedVisits();
    return { visits: cached, isOffline: true };
  }
}

export async function submitVisit(
  formData: VisitFormData
): Promise<{ visit: Visit; offline: boolean }> {
  // If the browser reports navigator.onLine === false, bypass directly to offline storage
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const queuedVisit = addToOfflineQueue(formData);
    return { visit: queuedVisit, offline: true };
  }

  try {
    const res = await fetch(`${API_BASE}/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      throw new Error(`Server returned error: ${res.status}`);
    }

    const data = await res.json();
    if (data.success && data.visit) {
      const newVisit: Visit = { ...data.visit, synced: true };
      const current = getCachedVisits();
      cacheVisits([newVisit, ...current]);
      return { visit: newVisit, offline: false };
    }
    throw new Error(data.error || 'Failed to save visit');
  } catch (err) {
    console.warn('POST visit failed, queuing locally to offline storage:', err);
    const queuedVisit = addToOfflineQueue(formData);
    return { visit: queuedVisit, offline: true };
  }
}

export async function syncOfflineQueue(): Promise<{ syncedCount: number; visits: Visit[] }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    const cached = getCachedVisits();
    return { syncedCount: 0, visits: cached };
  }

  try {
    const res = await fetch(`${API_BASE}/visits/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ visits: queue }),
    });

    if (!res.ok) {
      throw new Error(`Sync failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.visits)) {
      clearOfflineQueue();
      const updatedVisits: Visit[] = data.visits.map((v: any) => ({ ...v, synced: true }));
      cacheVisits(updatedVisits);
      return { syncedCount: data.syncedCount || queue.length, visits: updatedVisits };
    }
    throw new Error('Sync response invalid');
  } catch (err) {
    console.error('Failed to sync offline visits with backend:', err);
    throw err;
  }
}

export async function updateVisit(
  id: number | string,
  formData: VisitFormData
): Promise<{ visit: Visit; offline: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/visits/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      throw new Error(`Server returned error: ${res.status}`);
    }

    const data = await res.json();
    if (data.success && data.visit) {
      const updated: Visit = { ...data.visit, synced: true };
      const current = getCachedVisits();
      cacheVisits(current.map((v) => (String(v.id) === String(id) ? updated : v)));
      return { visit: updated, offline: false };
    }
    throw new Error(data.error || 'Failed to update visit');
  } catch (err) {
    console.warn('PUT visit failed, updating locally in cached visits:', err);
    const current = getCachedVisits();
    const existing = current.find((v) => String(v.id) === String(id));
    const updated: Visit = {
      id,
      shop_name: formData.shop_name,
      phone_number: formData.phone_number,
      sale_status: formData.sale_status,
      sale_amount: formData.sale_amount,
      units_sold: formData.units_sold,
      notes: formData.notes,
      latitude: formData.latitude,
      longitude: formData.longitude,
      timestamp: existing?.timestamp || new Date().toISOString(),
      synced: false,
    };
    cacheVisits(current.map((v) => (String(v.id) === String(id) ? updated : v)));
    return { visit: updated, offline: true };
  }
}

export async function deleteVisit(id: number | string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/visits/${id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });

    // Remove from local cached visits
    const current = getCachedVisits();
    cacheVisits(current.filter((v) => String(v.id) !== String(id)));

    if (!res.ok) {
      console.warn(`Server returned error on DELETE: ${res.status}`);
    }
    return { success: true };
  } catch (err) {
    console.warn('DELETE visit network request failed, removing locally from cached visits:', err);
    const current = getCachedVisits();
    cacheVisits(current.filter((v) => String(v.id) !== String(id)));
    return { success: true };
  }
}

export function getExportUrl(): string {
  return `${API_BASE}/export`;
}
