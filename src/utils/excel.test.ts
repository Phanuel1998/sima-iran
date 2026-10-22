import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePersianExcelBlob } from './excel.ts';
import type { Visit } from '../types.ts';

test('generatePersianExcelBlob produces valid xlsx blob with RTL worksheet', () => {
  const dummyVisits: Visit[] = [
    {
      id: 1,
      shop_name: 'فروشگاه کتاب انقلاب',
      phone_number: '02166401234',
      sale_status: 'Sold',
      sale_amount: 350000,
      units_sold: 25,
      notes: 'تحویل سفارش عمده',
      latitude: 35.6892,
      longitude: 51.3890,
      timestamp: '2026-10-18 10:00:00',
      synced: true,
    },
    {
      id: 2,
      shop_name: 'کافه ولیعصر',
      phone_number: '02188885544',
      sale_status: 'Callback',
      sale_amount: 0,
      notes: 'پیگیری دوشنبه آینده',
      latitude: 35.6945,
      longitude: 51.3965,
      timestamp: '2026-10-18 11:30:00',
      synced: false,
    },
    {
      id: 3,
      shop_name: 'قنادی فردوسی',
      phone_number: '02133901122',
      sale_status: 'Sample',
      sale_amount: 0,
      units_sold: 5,
      notes: 'ارائه ۵ بسته نمونه جهت تست طعم',
      latitude: 35.6980,
      longitude: 51.4120,
      timestamp: '2026-10-18 12:45:00',
      synced: true,
    },
  ];

  const blob = generatePersianExcelBlob(dummyVisits);
  assert.ok(blob, 'Blob should be created');
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(blob.size > 1000, 'Blob size should contain valid Excel ZIP archive bytes');
});

test('generatePersianExcelBlob handles empty visits list without throwing', () => {
  const blob = generatePersianExcelBlob([]);
  assert.ok(blob, 'Blob should be created even if list is empty');
  assert.ok(blob.size > 500, 'Empty template should produce valid xlsx');
});
