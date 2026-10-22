import type { Visit, DayMetrics, SaleStatus, DailySalesPoint } from '../types.ts';

/**
 * Calculates summary metrics from a list of visits.
 */
export function calculateMetrics(visits: Visit[]): DayMetrics {
  const totalVisited = visits.length;
  if (totalVisited === 0) {
    return {
      totalVisited: 0,
      totalSalesAmount: 0,
      totalUnitsSold: 0,
      conversionRate: 0,
      soldCount: 0,
      sampleCount: 0,
      rejectedCount: 0,
      callbackCount: 0,
      averageSaleAmount: 0,
    };
  }

  let totalSalesAmount = 0;
  let totalUnitsSold = 0;
  let soldCount = 0;
  let sampleCount = 0;
  let rejectedCount = 0;
  let callbackCount = 0;

  for (const v of visits) {
    const amt = Number(v.sale_amount) || 0;
    const units = Number(v.units_sold) || 0;
    if (v.sale_status === 'Sold') {
      soldCount++;
      totalSalesAmount += amt;
      totalUnitsSold += units;
    } else if (v.sale_status === 'Sample') {
      sampleCount++;
      totalUnitsSold += units;
    } else if (v.sale_status === 'Rejected') {
      rejectedCount++;
    } else if (v.sale_status === 'Callback') {
      callbackCount++;
    }
  }

  const conversionRate = totalVisited > 0 ? (soldCount / totalVisited) * 100 : 0;
  const averageSaleAmount = soldCount > 0 ? totalSalesAmount / soldCount : 0;

  return {
    totalVisited,
    totalSalesAmount: Math.round(totalSalesAmount * 100) / 100,
    totalUnitsSold,
    conversionRate: Math.round(conversionRate * 10) / 10,
    soldCount,
    sampleCount,
    rejectedCount,
    callbackCount,
    averageSaleAmount: Math.round(averageSaleAmount * 100) / 100,
  };
}

/**
 * Generates RFC 4180 compliant CSV string from visits.
 */
export function generateCsvContent(visits: Visit[]): string {
  const headers = ['id', 'shop_name', 'phone_number', 'sale_status', 'sale_amount', 'units_sold', 'notes', 'latitude', 'longitude', 'timestamp'];
  const rows = visits.map((v) => {
    return [
      escapeCsvField(v.id),
      escapeCsvField(v.shop_name),
      escapeCsvField(v.phone_number),
      escapeCsvField(v.sale_status),
      Number(v.sale_amount || 0).toFixed(2),
      Number(v.units_sold || 0),
      escapeCsvField(v.notes),
      v.latitude,
      v.longitude,
      escapeCsvField(v.timestamp),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Haversine formula to compute distance between two GPS coordinates in kilometers.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000) / 1000;
}

/**
 * Calculates total route distance along a sequence of coordinates.
 */
export function calculateTotalRouteDistanceKm(coords: Array<[number, number]>): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += calculateDistanceKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Filters visits by search term and optional status.
 */
export function filterVisits(
  visits: Visit[],
  filters: { query?: string; status?: SaleStatus | 'ALL' }
): Visit[] {
  return visits.filter((v) => {
    if (filters.status && filters.status !== 'ALL' && v.sale_status !== filters.status) {
      return false;
    }
    if (filters.query && filters.query.trim()) {
      const q = filters.query.toLowerCase().trim();
      const matchName = v.shop_name.toLowerCase().includes(q);
      const matchPhone = v.phone_number ? v.phone_number.toLowerCase().includes(q) : false;
      const matchNotes = v.notes ? v.notes.toLowerCase().includes(q) : false;
      if (!matchName && !matchPhone && !matchNotes) return false;
    }
    return true;
  });
}

/**
 * Extracts YYYY-MM-DD from visit timestamp.
 */
export function extractDateKey(ts?: string | null): string {
  if (!ts) return '';
  const match = String(ts).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

/**
 * Calculates daily sales performance for the last 7 days ending at referenceDate.
 */
export function calculateDailySalesLast7Days(
  visits: Visit[],
  referenceDate: Date = new Date()
): DailySalesPoint[] {
  const result: DailySalesPoint[] = [];
  const ref = new Date(referenceDate);
  ref.setHours(12, 0, 0, 0); // avoid DST / midnight issues

  const persianDayFormatter = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' });
  const persianJalaliFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'short',
    day: 'numeric',
  });

  // Pre-group visits by YYYY-MM-DD
  const visitsByDate = new Map<string, Visit[]>();
  for (const v of visits) {
    const key = extractDateKey(v.timestamp);
    if (!key) continue;
    if (!visitsByDate.has(key)) {
      visitsByDate.set(key, []);
    }
    visitsByDate.get(key)!.push(v);
  }

  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(ref.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    const rawDayName = persianDayFormatter.format(d);
    let dayLabel = rawDayName;
    if (i === 0) dayLabel = 'امروز';
    else if (i === 1) dayLabel = 'دیروز';

    const shortDate = persianJalaliFormatter.format(d);

    const dayVisits = visitsByDate.get(dateKey) || [];
    let salesAmount = 0;
    let unitsSold = 0;
    let soldCount = 0;
    let sampleCount = 0;

    for (const v of dayVisits) {
      const amt = Number(v.sale_amount) || 0;
      const units = Number(v.units_sold) || 0;
      if (v.sale_status === 'Sold') {
        salesAmount += amt;
        soldCount++;
        unitsSold += units;
      } else if (v.sale_status === 'Sample') {
        sampleCount++;
        unitsSold += units;
      }
    }

    result.push({
      date: dateKey,
      dayLabel,
      rawDayName,
      shortDate,
      salesAmount: Math.round(salesAmount),
      unitsSold,
      soldCount,
      sampleCount,
      totalVisits: dayVisits.length,
    });
  }

  return result;
}
