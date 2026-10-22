process.env.DISABLE_HMR = 'true';

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const app = express();
app.use(express.json());

// CORS configuration for local or cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize SQLite database
const dbPath = path.resolve(process.cwd(), 'field_sales.db');
const db = new DatabaseSync(dbPath);

// Create visits table
db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_name TEXT NOT NULL,
    phone_number TEXT,
    sale_status TEXT NOT NULL CHECK(sale_status IN ('Sold', 'Sample', 'Rejected', 'Callback')),
    sale_amount REAL DEFAULT 0,
    units_sold INTEGER DEFAULT 0,
    notes TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe column migration for existing databases
try {
  db.exec(`ALTER TABLE visits ADD COLUMN units_sold INTEGER DEFAULT 0;`);
} catch (_) {
  // Column already exists
}

// REST Endpoints

// 1. GET /api/visits - Return all logged visits
app.get('/api/visits', (req, res) => {
  try {
    const visits = db.prepare('SELECT * FROM visits ORDER BY id DESC').all();
    res.json({ success: true, visits });
  } catch (err: any) {
    console.error('Error fetching visits:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/visits - Log a new visit
app.post('/api/visits', (req, res) => {
  try {
    const { shop_name, phone_number, sale_status, sale_amount, units_sold, notes, latitude, longitude, timestamp } = req.body;

    if (!shop_name || !shop_name.trim()) {
      return res.status(400).json({ success: false, error: 'Shop name is required.' });
    }

    if (!['Sold', 'Sample', 'Rejected', 'Callback'].includes(sale_status)) {
      return res.status(400).json({ success: false, error: 'Invalid sale status. Must be Sold, Sample, Rejected, or Callback.' });
    }

    if (latitude === undefined || longitude === undefined || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      return res.status(400).json({ success: false, error: 'Valid GPS latitude and longitude are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO visits (shop_name, phone_number, sale_status, sale_amount, units_sold, notes, latitude, longitude, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);

    const result = stmt.run(
      shop_name.trim(),
      phone_number ? phone_number.trim() : '',
      sale_status,
      Number(sale_amount) || 0,
      Number(units_sold) || 0,
      notes ? notes.trim() : '',
      Number(latitude),
      Number(longitude),
      timestamp || null
    );

    const insertedId = result.lastInsertRowid;
    const insertedVisit = db.prepare('SELECT * FROM visits WHERE id = ?').get(insertedId);

    res.status(201).json({ success: true, visit: insertedVisit });
  } catch (err: any) {
    console.error('Error creating visit:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/visits/sync - Batch sync offline logged visits
app.post('/api/visits/sync', (req, res) => {
  try {
    const { visits } = req.body;
    if (!Array.isArray(visits)) {
      return res.status(400).json({ success: false, error: 'Payload must include an array of visits.' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO visits (shop_name, phone_number, sale_status, sale_amount, units_sold, notes, latitude, longitude, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);

    let syncedCount = 0;
    for (const v of visits) {
      if (v.shop_name && ['Sold', 'Sample', 'Rejected', 'Callback'].includes(v.sale_status)) {
        insertStmt.run(
          v.shop_name.trim(),
          v.phone_number ? v.phone_number.trim() : '',
          v.sale_status,
          Number(v.sale_amount) || 0,
          Number(v.units_sold) || 0,
          v.notes ? v.notes.trim() : '',
          Number(v.latitude),
          Number(v.longitude),
          v.timestamp || null
        );
        syncedCount++;
      }
    }

    const allVisits = db.prepare('SELECT * FROM visits ORDER BY id DESC').all();
    res.json({ success: true, syncedCount, visits: allVisits });
  } catch (err: any) {
    console.error('Error syncing visits:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/export - Return database contents formatted as downloadable CSV
app.get('/api/export', (req, res) => {
  try {
    const visits = db.prepare('SELECT * FROM visits ORDER BY timestamp ASC').all() as any[];

    const escapeField = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const header = ['id', 'shop_name', 'phone_number', 'sale_status', 'sale_amount', 'units_sold', 'notes', 'latitude', 'longitude', 'timestamp'];
    const rows = visits.map((v) =>
      [
        escapeField(v.id),
        escapeField(v.shop_name),
        escapeField(v.phone_number),
        escapeField(v.sale_status),
        Number(v.sale_amount || 0).toFixed(2),
        Number(v.units_sold || 0),
        escapeField(v.notes),
        v.latitude,
        v.longitude,
        escapeField(v.timestamp),
      ].join(',')
    );

    const csvContent = [header.join(','), ...rows].join('\r\n');

    const filename = `visits_export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('Error exporting CSV:', err);
    res.status(500).send('Error generating CSV export');
  }
});

// 4b. GET /api/export-excel - Return database records as an RTL Persian Excel (.xlsx) file
app.get('/api/export-excel', async (req, res) => {
  try {
    const XLSX = await import('xlsx');
    const visits = db.prepare('SELECT * FROM visits ORDER BY id ASC').all() as any[];

    const rows = visits.map((v, index) => {
      let statusPersian = 'نامشخص';
      if (v.sale_status === 'Sold') statusPersian = 'موفق (فروش انجام شد)';
      else if (v.sale_status === 'Sample') statusPersian = 'نمونه (ارائه نمونه کالا)';
      else if (v.sale_status === 'Rejected') statusPersian = 'ناموفق (عدم تمایل)';
      else if (v.sale_status === 'Callback') statusPersian = 'پیگیری مجدد';

      return {
        'ردیف': index + 1,
        'نام فروشگاه / کسب‌وکار': v.shop_name,
        'شماره تماس': v.phone_number || '---',
        'وضعیت ویزیت': statusPersian,
        'مبلغ فروش (تومان)': Number(v.sale_amount) || 0,
        'تعداد اقلام فروخته شده (واحد)': Number(v.units_sold) || 0,
        'یادداشت و اقدامات': v.notes || '',
        'عرض جغرافیایی': v.latitude,
        'طول جغرافیایی': v.longitude,
        'تاریخ و زمان ثبت': v.timestamp,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{
      'ردیف': 1,
      'نام فروشگاه / کسب‌وکار': 'هیچ رکوردی یافت نشد',
      'شماره تماس': '---',
      'وضعیت ویزیت': '---',
      'مبلغ فروش (تومان)': 0,
      'تعداد اقلام فروخته شده (واحد)': 0,
      'یادداشت و اقدامات': '',
      'عرض جغرافیایی': 35.6892,
      'طول جغرافیایی': 51.3890,
      'تاریخ و زمان ثبت': new Date().toISOString(),
    }]);

    worksheet['!views'] = [{ RTL: true }];
    worksheet['!cols'] = [
      { wch: 8 },  // ردیف
      { wch: 28 }, // نام فروشگاه
      { wch: 18 }, // شماره تماس
      { wch: 24 }, // وضعیت
      { wch: 18 }, // مبلغ
      { wch: 22 }, // تعداد اقلام
      { wch: 38 }, // یادداشت
      { wch: 16 }, // عرض
      { wch: 16 }, // طول
      { wch: 22 }, // تاریخ
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش ویزیت فروشگاه‌ها');
    (workbook as any).Workbook = { Views: [{ RTL: true }] };

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `field_sales_report_tehran_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('Error generating Excel export:', err);
    res.status(500).send('Error generating Excel export');
  }
});

// 5. PUT /api/visits/:id - Update existing visit details
app.put('/api/visits/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { shop_name, phone_number, sale_status, sale_amount, units_sold, notes, latitude, longitude } = req.body;

    if (!shop_name || !shop_name.trim()) {
      return res.status(400).json({ success: false, error: 'Shop name is required.' });
    }

    if (sale_status && !['Sold', 'Sample', 'Rejected', 'Callback'].includes(sale_status)) {
      return res.status(400).json({ success: false, error: 'Invalid sale status.' });
    }

    const stmt = db.prepare(`
      UPDATE visits
      SET shop_name = ?,
          phone_number = ?,
          sale_status = ?,
          sale_amount = ?,
          units_sold = ?,
          notes = ?,
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude)
      WHERE id = ?
    `);

    stmt.run(
      shop_name.trim(),
      phone_number ? phone_number.trim() : '',
      sale_status,
      Number(sale_amount) || 0,
      Number(units_sold) || 0,
      notes ? notes.trim() : '',
      latitude !== undefined ? Number(latitude) : null,
      longitude !== undefined ? Number(longitude) : null,
      id
    );

    const updatedVisit = db.prepare('SELECT * FROM visits WHERE id = ?').get(id);
    if (!updatedVisit) {
      return res.status(404).json({ success: false, error: 'Visit record not found' });
    }

    res.json({ success: true, visit: updatedVisit });
  } catch (err: any) {
    console.error('Error updating visit:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. DELETE /api/visits/:id - Delete visit record
app.delete('/api/visits/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM visits WHERE id = ?').run(id);
    res.json({ success: true, message: 'Visit deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount Vite or serve static assets
const isProd = process.env.NODE_ENV === 'production';
if (!isProd) {
  const vite = await createViteServer({
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
    server: {
      middlewareMode: true,
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Field Sales Tracker] Server running on http://0.0.0.0:${PORT}`);
});
