import * as XLSX from 'xlsx';
import type { Visit } from '../types.ts';

/**
 * Generates an Excel (.xlsx) workbook with Right-To-Left (RTL) worksheet formatting
 * specifically tailored for Persian (Farsi) accounting & field sales records.
 */
export function generatePersianExcelBlob(visits: Visit[]): Blob {
  // Format rows in Persian
  const data = visits.map((v, index) => {
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
      'عرض جغرافیایی (Latitude)': v.latitude,
      'طول جغرافیایی (Longitude)': v.longitude,
      'تاریخ و زمان ثبت': v.timestamp,
      'وضعیت سرور': v.synced ? 'همگام‌شده با سرور' : 'ذخیره در حافظه دستگاه',
    };
  });

  // If visits list is empty, create an empty template row
  const rows = data.length > 0 ? data : [
    {
      'ردیف': 1,
      'نام فروشگاه / کسب‌وکار': 'هیچ فروشگاهی ثبت نشده است',
      'شماره تماس': '---',
      'وضعیت ویزیت': '---',
      'مبلغ فروش (تومان)': 0,
      'تعداد اقلام فروخته شده (واحد)': 0,
      'یادداشت و اقدامات': '',
      'عرض جغرافیایی (Latitude)': 35.6892,
      'طول جغرافیایی (Longitude)': 51.3890,
      'تاریخ و زمان ثبت': new Date().toISOString(),
      'وضعیت سرور': '---',
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set Right-to-Left (RTL) mode for the worksheet
  if (!worksheet['!views']) {
    worksheet['!views'] = [];
  }
  worksheet['!views'].push({ RTL: true });

  // Column width configuration in characters
  worksheet['!cols'] = [
    { wch: 8 },  // ردیف
    { wch: 28 }, // نام فروشگاه
    { wch: 18 }, // شماره تماس
    { wch: 24 }, // وضعیت ویزیت
    { wch: 18 }, // مبلغ فروش (تومان)
    { wch: 22 }, // تعداد اقلام فروخته شده (واحد)
    { wch: 38 }, // یادداشت و اقدامات
    { wch: 16 }, // عرض جغرافیایی
    { wch: 16 }, // طول جغرافیایی
    { wch: 22 }, // تاریخ و زمان ثبت
    { wch: 22 }, // وضعیت سرور
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش ویزیت فروشگاه‌ها');

  // Set Right-to-Left on workbook level
  (workbook as any).Workbook = {
    Views: [{ RTL: true }]
  };

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });

  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Initiates download of the generated RTL Persian Excel file in the browser.
 */
export function downloadPersianExcel(visits: Visit[], baseFilename = 'گزارش_ویزیت_های_فروشگاه'): void {
  const blob = generatePersianExcelBlob(visits);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `${baseFilename}_${dateStr}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
