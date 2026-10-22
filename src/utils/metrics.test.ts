import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMetrics,
  generateCsvContent,
  calculateDistanceKm,
  calculateTotalRouteDistanceKm,
  filterVisits,
  extractDateKey,
  calculateDailySalesLast7Days,
} from './metrics.ts';
import type { Visit } from '../types.ts';

const mockVisits: Visit[] = [
  {
    id: 1,
    shop_name: 'Metro Bakery & Cafe',
    phone_number: '555-0101',
    sale_status: 'Sold',
    sale_amount: 350.5,
    units_sold: 5,
    notes: 'Bought 5 wholesale packs of coffee',
    latitude: 37.7749,
    longitude: -122.4194,
    timestamp: '2026-10-17 09:30:00',
  },
  {
    id: 2,
    shop_name: 'Corner Electronics',
    phone_number: '555-0102',
    sale_status: 'Rejected',
    sale_amount: 0,
    units_sold: 0,
    notes: 'Already has alternative supplier',
    latitude: 37.7755,
    longitude: -122.4185,
    timestamp: '2026-10-17 10:15:00',
  },
  {
    id: 3,
    shop_name: 'Sunset Bodega',
    phone_number: '555-0103',
    sale_status: 'Sold',
    sale_amount: 150.0,
    units_sold: 10,
    notes: 'Trial order placed',
    latitude: 37.7762,
    longitude: -122.4172,
    timestamp: '2026-10-17 11:00:00',
  },
  {
    id: 4,
    shop_name: 'Urban Florist',
    phone_number: '555-0104',
    sale_status: 'Callback',
    sale_amount: 0,
    units_sold: 0,
    notes: 'Owner returns Tuesday afternoon',
    latitude: 37.7770,
    longitude: -122.4160,
    timestamp: '2026-10-17 11:45:00',
  },
  {
    id: 5,
    shop_name: 'Persian Cafe & Roasters',
    phone_number: '555-0105',
    sale_status: 'Sample',
    sale_amount: 0,
    units_sold: 3,
    notes: 'Provided 3 sample coffee packs',
    latitude: 37.7780,
    longitude: -122.4150,
    timestamp: '2026-10-17 12:30:00',
  },
];

test('calculateMetrics computes correct totals, breakdown, and conversion rate', () => {
  const metrics = calculateMetrics(mockVisits);

  assert.equal(metrics.totalVisited, 5);
  assert.equal(metrics.soldCount, 2);
  assert.equal(metrics.sampleCount, 1);
  assert.equal(metrics.rejectedCount, 1);
  assert.equal(metrics.callbackCount, 1);
  assert.equal(metrics.totalSalesAmount, 500.5);
  assert.equal(metrics.totalUnitsSold, 18);
  // Conversion rate = 2 / 5 = 40.0%
  assert.equal(metrics.conversionRate, 40.0);
  assert.equal(metrics.averageSaleAmount, 250.25);
});

test('calculateMetrics handles empty visits safely', () => {
  const metrics = calculateMetrics([]);
  assert.equal(metrics.totalVisited, 0);
  assert.equal(metrics.totalSalesAmount, 0);
  assert.equal(metrics.totalUnitsSold, 0);
  assert.equal(metrics.conversionRate, 0);
  assert.equal(metrics.soldCount, 0);
  assert.equal(metrics.sampleCount, 0);
});

test('generateCsvContent formats fields and headers cleanly with proper quoting', () => {
  const csv = generateCsvContent(mockVisits.slice(0, 2));
  assert.ok(csv.startsWith('id,shop_name,phone_number,sale_status,sale_amount,units_sold,notes,latitude,longitude,timestamp'));
  assert.ok(csv.includes('"Metro Bakery & Cafe"'));
  assert.ok(csv.includes('350.50'));
  assert.ok(csv.includes('"Corner Electronics"'));
});

test('calculateDistanceKm calculates approximate distance between GPS coordinates', () => {
  // Distance between SF points should be ~0.1 to 0.2 km
  const dist = calculateDistanceKm(37.7749, -122.4194, 37.7755, -122.4185);
  assert.ok(dist > 0.05 && dist < 0.3, `Expected distance between ~0.05 and 0.3km, got ${dist}`);
});

test('calculateTotalRouteDistanceKm aggregates waypoints', () => {
  const coords: Array<[number, number]> = [
    [37.7749, -122.4194],
    [37.7755, -122.4185],
    [37.7762, -122.4172],
  ];
  const total = calculateTotalRouteDistanceKm(coords);
  assert.ok(total > 0.1 && total < 1.0, `Expected total route distance ~0.2km, got ${total}`);
});

test('filterVisits matches query and status properly', () => {
  const soldOnly = filterVisits(mockVisits, { status: 'Sold' });
  assert.equal(soldOnly.length, 2);

  const queryBodega = filterVisits(mockVisits, { query: 'bodega' });
  assert.equal(queryBodega.length, 1);
  assert.equal(queryBodega[0].shop_name, 'Sunset Bodega');

  const notesMatch = filterVisits(mockVisits, { query: 'supplier' });
  assert.equal(notesMatch.length, 1);
  assert.equal(notesMatch[0].shop_name, 'Corner Electronics');
});

test('extractDateKey extracts standard YYYY-MM-DD from various timestamp formats', () => {
  assert.equal(extractDateKey('2026-10-21 14:30:00'), '2026-10-21');
  assert.equal(extractDateKey('2026-10-18T10:00:00.000Z'), '2026-10-18');
  assert.equal(extractDateKey(''), '');
  assert.equal(extractDateKey(null), '');
});

test('calculateDailySalesLast7Days groups visits and aggregates sales amounts across 7 days', () => {
  // Reference date: 2026-10-17
  const refDate = new Date('2026-10-17T15:00:00Z');
  const daily = calculateDailySalesLast7Days(mockVisits, refDate);

  // Must always return exactly 7 days
  assert.equal(daily.length, 7);

  // The last entry (i=0) is today (2026-10-17)
  const todayEntry = daily[6];
  assert.equal(todayEntry.date, '2026-10-17');
  assert.equal(todayEntry.dayLabel, 'امروز');
  // Visits on 2026-10-17: Metro Bakery (350.5), Corner Elec (0, Rejected), Sunset Bodega (150, Sold), Urban Florist (0, Callback), Persian Cafe (0, Sample)
  // Total Sold = 350.5 + 150 = 500.5 -> rounded to 501
  assert.equal(todayEntry.salesAmount, 501);
  assert.equal(todayEntry.soldCount, 2);
  assert.equal(todayEntry.sampleCount, 1);
  assert.equal(todayEntry.totalVisits, 5);

  // The day before (2026-10-16) is yesterday with 0 visits in mockVisits
  const yesterdayEntry = daily[5];
  assert.equal(yesterdayEntry.date, '2026-10-16');
  assert.equal(yesterdayEntry.dayLabel, 'دیروز');
  assert.equal(yesterdayEntry.salesAmount, 0);
  assert.equal(yesterdayEntry.totalVisits, 0);

  // The oldest day (2026-10-11)
  const oldestEntry = daily[0];
  assert.equal(oldestEntry.date, '2026-10-11');
  assert.equal(oldestEntry.salesAmount, 0);
});
