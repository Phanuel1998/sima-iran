import type { Visit, VisitFormData } from '../types.ts';

const OFFLINE_QUEUE_KEY = 'field_sales_offline_queue_v2';
const CACHED_VISITS_KEY = 'field_sales_cached_visits_v2';

// Purge any old test shops from previous versions
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('field_sales_cached_visits_v1');
    localStorage.removeItem('field_sales_offline_queue_v1');
    localStorage.removeItem('cached_visits');
  } catch (e) {}
}

export function getOfflineQueue(): Array<VisitFormData & { client_id: string; timestamp: string }> {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read offline queue from localStorage:', err);
    return [];
  }
}

export function addToOfflineQueue(data: VisitFormData): Visit {
  try {
    const queue = getOfflineQueue();
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const client_id = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const queuedItem = {
      ...data,
      client_id,
      timestamp,
    };
    queue.push(queuedItem);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // Also update cached visits with this optimistic visit
    const optimisticVisit: Visit = {
      id: client_id,
      shop_name: data.shop_name,
      phone_number: data.phone_number,
      sale_status: data.sale_status,
      sale_amount: data.sale_amount,
      units_sold: data.units_sold,
      notes: data.notes,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp,
      synced: false,
    };

    const cached = getCachedVisits();
    cacheVisits([optimisticVisit, ...cached]);

    return optimisticVisit;
  } catch (err) {
    console.error('Failed to queue offline visit:', err);
    throw err;
  }
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (err) {
    console.error('Failed to clear offline queue:', err);
  }
}

export function getCachedVisits(): Visit[] {
  try {
    const raw = localStorage.getItem(CACHED_VISITS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read cached visits:', err);
    return [];
  }
}

export function cacheVisits(visits: Visit[]): void {
  try {
    localStorage.setItem(CACHED_VISITS_KEY, JSON.stringify(visits));
  } catch (err) {
    console.error('Failed to cache visits to localStorage:', err);
  }
}
