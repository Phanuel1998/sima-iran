import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Search,
  DollarSign,
  TrendingUp,
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Calendar,
  Footprints,
  Trash2,
  Edit3,
  RefreshCw,
  Gift,
} from 'lucide-react';
import type { Visit, DayMetrics, SaleStatus } from '../types.ts';
import { filterVisits, calculateTotalRouteDistanceKm } from '../utils/metrics.ts';
import { SalesBarChart } from './SalesBarChart.tsx';

interface DashboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  visits: Visit[];
  metrics: DayMetrics;
  onSelectVisit: (visit: Visit) => void;
  onEditVisit?: (visit: Visit) => void;
  onDeleteVisit?: (visit: Visit) => void;
  onDownloadExcel: () => void;
  isDownloadingExcel: boolean;
  onManualSync?: () => void;
  pendingSyncCount: number;
}

export const DashboardDrawer: React.FC<DashboardDrawerProps> = ({
  isOpen,
  onClose,
  visits,
  metrics,
  onSelectVisit,
  onEditVisit,
  onDeleteVisit,
  onDownloadExcel,
  isDownloadingExcel,
  onManualSync,
  pendingSyncCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<SaleStatus | 'ALL'>('ALL');

  if (!isOpen) return null;

  const filteredVisits = filterVisits(visits, {
    query: searchQuery,
    status: selectedStatus,
  });

  // Calculate route distance from coordinates
  const coords: Array<[number, number]> = visits
    .filter((v) => v.latitude && v.longitude)
    .map((v) => [v.latitude, v.longitude]);
  const walkingKm = calculateTotalRouteDistanceKm(coords);

  const getStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'Sold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>موفق (فروش)</span>
          </span>
        );
      case 'Sample':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Gift className="w-3 h-3" />
            <span>نمونه (آبی)</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            <span>ناموفق</span>
          </span>
        );
      case 'Callback':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>پیگیری مجدد</span>
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-title"
      className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      dir="rtl"
    >
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div
          className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0"
          style={{ paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))' }}
        >
          <div>
            <h2 id="dashboard-title" className="text-lg font-bold text-white flex items-center gap-2">
              <span>داشبورد و آمار فروش</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-normal">
                امروز
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">عملکرد فروش میدانی و ثبت ویزیت‌ها در تهران</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن داشبورد"
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync alert if pending */}
        {pendingSyncCount > 0 && (
          <div className="px-4 py-2.5 bg-amber-950/60 border-b border-amber-800/60 flex items-center justify-between text-xs text-amber-200 shrink-0">
            <span>{pendingSyncCount.toLocaleString('fa-IR')} رکورد در صف ذخیره آفلاین</span>
            {onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center gap-1 touch-manipulation cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>همگام‌سازی</span>
              </button>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 overscroll-contain"
          style={{ paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))' }}
        >
          {/* Daily Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Visited */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">تعداد کل ویزیت‌ها</span>
                <Store className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <div className="text-2xl font-black text-white">{metrics.totalVisited.toLocaleString('fa-IR')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">فروشگاه‌های امروز</div>
            </div>

            {/* Total Sales Amount & Units Sold */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">مجموع فروش و اقلام</span>
                <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <div className="text-xl font-black text-emerald-400 line-clamp-1">
                {metrics.totalSalesAmount.toLocaleString('fa-IR')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between">
                <span>مبلغ سفارشات (تومان)</span>
                {metrics.totalUnitsSold > 0 && (
                  <span className="text-emerald-300 font-bold">
                    {metrics.totalUnitsSold.toLocaleString('fa-IR')} قلم کالا
                  </span>
                )}
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">نرخ موفقیت</span>
                <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
              </div>
              <div className="text-2xl font-black text-white">
                {metrics.conversionRate.toFixed(1).replace('.', '٫')}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">درصد ویزیت‌های موفق</div>
            </div>

            {/* Route Distance */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium">مسافت تخمینی</span>
                <Footprints className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
              <div className="text-2xl font-black text-white">
                {walkingKm.toFixed(1).replace('.', '٫')} <span className="text-xs font-normal text-slate-400">کیلومتر</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">طول مسیر ویزیت‌ها</div>
            </div>
          </div>

          {/* 7-Day Sales Performance Bar Chart */}
          <SalesBarChart visits={visits} />

          {/* Excel Export Button */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-slate-900 border border-emerald-600/40 shadow-lg space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>دانلود فایل اکسل (Excel راست‌به‌چپ)</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  خروجی کامل فروشگاه‌ها، مبالغ فروش، تلفن‌ها و مختصات به صورت راست‌به‌چپ (RTL) مخصوص اکسل
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onDownloadExcel}
              disabled={isDownloadingExcel}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all touch-manipulation cursor-pointer disabled:opacity-60"
            >
              {isDownloadingExcel ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ایجاد فایل اکسل...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>دانلود فایل اکسل فروشگاه‌ها ({visits.length.toLocaleString('fa-IR')} رکورد)</span>
                </>
              )}
            </button>
          </div>

          {/* Status Breakdown Bar */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
            <div className="text-xs font-semibold text-slate-300">تفکیک وضعیت ویزیت‌ها:</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50">
                <div className="text-sm font-bold text-emerald-400">{metrics.soldCount.toLocaleString('fa-IR')}</div>
                <div className="text-[10px] text-emerald-300/80">موفق</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-800/50">
                <div className="text-sm font-bold text-blue-400">{metrics.sampleCount.toLocaleString('fa-IR')}</div>
                <div className="text-[10px] text-blue-300/80">نمونه</div>
              </div>
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/50">
                <div className="text-sm font-bold text-rose-400">{metrics.rejectedCount.toLocaleString('fa-IR')}</div>
                <div className="text-[10px] text-rose-300/80">ناموفق</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/50">
                <div className="text-sm font-bold text-amber-400">{metrics.callbackCount.toLocaleString('fa-IR')}</div>
                <div className="text-[10px] text-amber-300/80">پیگیری</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Visit Logs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">لیست فروشگاه‌های ثبت‌شده</span>
              <span className="text-[11px] text-slate-500 font-mono">
                {filteredVisits.length.toLocaleString('fa-IR')} از {visits.length.toLocaleString('fa-IR')}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام فروشگاه، یادداشت، تلفن..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(
                [
                  { id: 'ALL', label: 'همه' },
                  { id: 'Sold', label: 'فروش موفق' },
                  { id: 'Sample', label: 'نمونه (آبی)' },
                  { id: 'Rejected', label: 'ناموفق' },
                  { id: 'Callback', label: 'پیگیری' },
                ] as const
              ).map((chip) => {
                const isActive = selectedStatus === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setSelectedStatus(chip.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all touch-manipulation cursor-pointer shrink-0 ${
                      isActive
                        ? chip.id === 'Sample'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Visit Cards */}
            {filteredVisits.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-800/40 border border-dashed border-slate-700 text-slate-400 text-xs">
                هیچ ویزیت ثبت‌شده‌ای یافت نشد.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredVisits.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => onSelectVisit(v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectVisit(v);
                    }}
                    className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/70 hover:border-emerald-500/50 cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-white text-sm line-clamp-1">{v.shop_name}</div>
                      {getStatusBadge(v.sale_status)}
                    </div>

                    {v.sale_status === 'Sold' && (
                      <div className="text-emerald-400 font-bold text-xs flex items-center gap-2 flex-wrap">
                        {Number(v.sale_amount) > 0 && (
                          <span>مبلغ: {Number(v.sale_amount).toLocaleString('fa-IR')} تومان</span>
                        )}
                        {v.units_sold !== undefined && Number(v.units_sold) > 0 && (
                          <span className="text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/50">
                            تعداد: {Number(v.units_sold).toLocaleString('fa-IR')} عدد
                          </span>
                        )}
                      </div>
                    )}

                    {v.sale_status === 'Sample' && (
                      <div className="text-blue-400 font-bold text-xs flex items-center gap-2 flex-wrap">
                        <span className="text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/50 flex items-center gap-1">
                          <Gift className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>
                            {v.units_sold !== undefined && Number(v.units_sold) > 0
                              ? `تعداد نمونه ارائه‌شده: ${Number(v.units_sold).toLocaleString('fa-IR')} عدد`
                              : 'ارائه نمونه به فروشگاه'}
                          </span>
                        </span>
                      </div>
                    )}

                    {v.phone_number && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 direction-ltr text-right">
                        <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{v.phone_number}</span>
                      </div>
                    )}

                    {v.notes && (
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg italic line-clamp-2">
                        "{v.notes}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-700/40">
                      <span className="flex items-center gap-1 text-[11px] direction-ltr text-right font-mono">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        {v.timestamp ? v.timestamp.slice(0, 16) : ''}
                      </span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {onEditVisit && (
                          <button
                            type="button"
                            onClick={() => onEditVisit(v)}
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors touch-manipulation cursor-pointer"
                            title="ویرایش این ویزیت"
                          >
                            <Edit3 className="w-3 h-3 text-sky-400" />
                            <span>ویرایش</span>
                          </button>
                        )}
                        {onDeleteVisit && (
                          <button
                            type="button"
                            onClick={() => onDeleteVisit(v)}
                            className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-[11px] font-bold flex items-center gap-1 transition-colors touch-manipulation cursor-pointer"
                            title="حذف این ویزیت"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
