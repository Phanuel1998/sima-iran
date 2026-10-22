import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Trash2,
  Edit3,
  Package,
  Gift,
} from 'lucide-react';
import type { SaleStatus, Visit, VisitFormData } from '../types.ts';

interface LogVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VisitFormData) => Promise<void>;
  onUpdate?: (id: number | string, data: VisitFormData) => Promise<void>;
  onDelete?: (id: number | string) => Promise<void>;
  visitToEdit?: Visit | null;
  currentLocation: { latitude: number; longitude: number } | null;
  selectedMapCoords: { latitude: number; longitude: number } | null;
  onRefreshLocation: () => void;
  isOffline: boolean;
}

export const LogVisitModal: React.FC<LogVisitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
  visitToEdit,
  currentLocation,
  selectedMapCoords,
  onRefreshLocation,
  isOffline,
}) => {
  const [shopName, setShopName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saleStatus, setSaleStatus] = useState<SaleStatus>('Sold');
  const [saleAmount, setSaleAmount] = useState<string>('0');
  const [unitsSold, setUnitsSold] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState<number>(0);
  const [lng, setLng] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync coords and fields when modal opens or coordinates change (defaulting to Tehran if location is off)
  useEffect(() => {
    if (isOpen) {
      if (visitToEdit) {
        setShopName(visitToEdit.shop_name);
        setPhoneNumber(visitToEdit.phone_number || '');
        setSaleStatus(visitToEdit.sale_status);
        setSaleAmount(String(visitToEdit.sale_amount || 0));
        setUnitsSold(String(visitToEdit.units_sold || 0));
        setNotes(visitToEdit.notes || '');
        setLat(Number(visitToEdit.latitude.toFixed(6)));
        setLng(Number(visitToEdit.longitude.toFixed(6)));
      } else {
        setShopName('');
        setPhoneNumber('');
        setSaleStatus('Sold');
        setSaleAmount('0');
        setUnitsSold('0');
        setNotes('');
        const targetCoords = selectedMapCoords || currentLocation || { latitude: 35.6892, longitude: 51.3890 };
        setLat(Number(targetCoords.latitude.toFixed(6)));
        setLng(Number(targetCoords.longitude.toFixed(6)));
      }
      setError(null);
    }
  }, [isOpen, visitToEdit, selectedMapCoords, currentLocation]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('لطفاً نام فروشگاه یا کسب‌وکار را وارد نمایید.');
      return;
    }

    if (lat === 0 && lng === 0) {
      setError('مختصات GPS آماده نیست. لطفاً روی نقشه نقطه‌ای را انتخاب کنید یا موقعیت را بازنشانی نمایید.');
      return;
    }

    const amountNum = saleStatus === 'Sold' ? Math.max(0, parseFloat(saleAmount) || 0) : 0;
    const unitsNum = (saleStatus === 'Sold' || saleStatus === 'Sample') ? Math.max(0, parseInt(unitsSold, 10) || 0) : 0;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: VisitFormData = {
        shop_name: shopName.trim(),
        phone_number: phoneNumber.trim(),
        sale_status: saleStatus,
        sale_amount: amountNum,
        units_sold: unitsNum,
        notes: notes.trim(),
        latitude: lat,
        longitude: lng,
      };

      if (visitToEdit && onUpdate) {
        await onUpdate(visitToEdit.id, payload);
      } else {
        await onSubmit(payload);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در ذخیره اطلاعات ویزیت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!visitToEdit || !onDelete) return;
    await onDelete(visitToEdit.id);
  };

  const quickAmounts = [50000, 100000, 250000, 500000];

  const handleQuickAmount = (val: number) => {
    const current = parseFloat(saleAmount) || 0;
    setSaleAmount(String(current + val));
  };

  const quickNoteChips = [
    'سفارش عمده اولیه ثبت شد',
    'کاتالوگ و نمونه محصول تحویل گردید',
    'پیگیری مجدد در ابتدای هفته آینده',
    'مدیر حضور نداشت، هماهنگی با مسئول شیفت',
    'استند و چیدمان محصولات در قفسه انجام شد',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      dir="rtl"
    >
      <div className="w-full max-w-lg bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${visitToEdit ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {visitToEdit ? <Edit3 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold text-slate-100">
                {visitToEdit ? 'ویرایش اطلاعات ویزیت' : 'ثبت ویزیت جدید فروشگاه'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {visitToEdit ? 'ویرایش نام، وضعیت، مبلغ یا یادداشت‌ها' : (selectedMapCoords ? 'موقعیت انتخاب‌شده روی نقشه' : 'موقعیت زنده GPS دستگاه')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offline notice if applicable */}
        {isOffline && (
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 flex items-center gap-2 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>حالت آفلاین: اطلاعات به طور خودکار در حافظه ذخیره شده و پس از اتصال اینترنت همگام می‌شود.</span>
          </div>
        )}

        {/* Form Body */}
        <form id="visit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm overscroll-contain">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Shop Name */}
          <div>
            <label htmlFor="shop-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
              نام فروشگاه / کسب‌وکار <span className="text-emerald-400">*</span>
            </label>
            <input
              id="shop-name"
              type="text"
              required
              autoFocus
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="مثلاً کتابفروشی انقلاب، سوپرمارکت ولیعصر، بازار بزرگ..."
              className="w-full px-3.5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone-number" className="block text-xs font-semibold text-slate-300 mb-1.5">
              شماره تماس فروشگاه
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="۰۲۱-۸۸۸۸۱۲۳۴ یا ۰۹۱۲..."
                className="w-full pr-10 pl-3.5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base direction-ltr text-right"
              />
            </div>
          </div>

          {/* Sale Status Toggle */}
          <div>
            <span className="block text-xs font-semibold text-slate-300 mb-2">
              وضعیت ویزیت <span className="text-emerald-400">*</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="وضعیت ویزیت">
              {/* Sold */}
              <button
                type="button"
                role="radio"
                aria-checked={saleStatus === 'Sold'}
                onClick={() => setSaleStatus('Sold')}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1.5 border font-semibold transition-all touch-manipulation cursor-pointer ${
                  saleStatus === 'Sold'
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950/40'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span className="text-xs">موفق (فروش)</span>
              </button>

              {/* Sample (New blue option requested by user) */}
              <button
                type="button"
                role="radio"
                aria-checked={saleStatus === 'Sample'}
                onClick={() => {
                  setSaleStatus('Sample');
                  setSaleAmount('0');
                }}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1.5 border font-semibold transition-all touch-manipulation cursor-pointer ${
                  saleStatus === 'Sample'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-950/40'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Gift className="w-5 h-5 text-blue-300" />
                <span className="text-xs">نمونه (آبی)</span>
              </button>

              {/* Rejected */}
              <button
                type="button"
                role="radio"
                aria-checked={saleStatus === 'Rejected'}
                onClick={() => setSaleStatus('Rejected')}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1.5 border font-semibold transition-all touch-manipulation cursor-pointer ${
                  saleStatus === 'Rejected'
                    ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-950/40'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <XCircle className="w-5 h-5 text-rose-300" />
                <span className="text-xs">ناموفق</span>
              </button>

              {/* Callback */}
              <button
                type="button"
                role="radio"
                aria-checked={saleStatus === 'Callback'}
                onClick={() => setSaleStatus('Callback')}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1.5 border font-semibold transition-all touch-manipulation cursor-pointer ${
                  saleStatus === 'Callback'
                    ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-950/40'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Clock className="w-5 h-5 text-amber-300" />
                <span className="text-xs">پیگیری مجدد</span>
              </button>
            </div>
          </div>

          {/* Sample Details & Units Box (if Sample) */}
          {saleStatus === 'Sample' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/50 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                  <Gift className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>ارائه نمونه محصول به فروشگاه (نشانگر آبی روی نقشه)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  این ویزیت با نشانگر آبی ثبت می‌شود که نشان‌دهنده تحویل نمونه کالا است.
                </p>
              </div>

              {/* Units of Sample given */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="units-sold-sample" className="block text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span>تعداد اقلام نمونه تحویل‌شده (تعداد کالا)</span>
                  </label>
                  <span className="text-[11px] text-blue-300 font-mono">
                    {Number(unitsSold || 0).toLocaleString('fa-IR')} عدد
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="units-sold-sample"
                    name="units_sold"
                    type="number"
                    min="0"
                    step="1"
                    value={unitsSold}
                    onChange={(e) => setUnitsSold(e.target.value)}
                    placeholder="تعداد اقلام نمونه تحویل داده شده..."
                    className="w-full px-3.5 py-3 rounded-lg bg-slate-900 border border-blue-700/60 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 direction-ltr text-right"
                  />
                </div>

                {/* Quick increment buttons for sample units */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-blue-400/80 ml-1 font-medium">تعداد سریع:</span>
                  {[1, 2, 3, 5, 10, 20].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => {
                        const cur = parseInt(unitsSold, 10) || 0;
                        setUnitsSold(String(cur + qty));
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-900/60 text-blue-200 border border-blue-700/50 hover:bg-blue-800 touch-manipulation cursor-pointer"
                    >
                      +{qty.toLocaleString('fa-IR')} عدد
                    </button>
                  ))}
                  {unitsSold && parseInt(unitsSold, 10) > 0 && (
                    <button
                      type="button"
                      onClick={() => setUnitsSold('0')}
                      className="px-2 py-1 text-xs font-medium rounded-md bg-slate-800 text-slate-400 hover:text-white border border-slate-700 touch-manipulation cursor-pointer"
                    >
                      صفر
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sale Amount & Units Sold (emphasized if Sold) */}
          {saleStatus === 'Sold' && (
            <div className="space-y-3">
              {/* Sale Amount (Toman) */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2.5">
                <label htmlFor="sale-amount" className="block text-xs font-semibold text-emerald-300">
                  مبلغ فروش (تومان)
                </label>
                <div className="relative">
                  <input
                    id="sale-amount"
                    type="number"
                    min="0"
                    step="1000"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-lg bg-slate-900 border border-emerald-700/60 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 direction-ltr text-right"
                  />
                </div>

                {/* Quick increment buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-emerald-400/80 ml-1 font-medium">افزودن سریع:</span>
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAmount(amt)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 hover:bg-emerald-800 touch-manipulation cursor-pointer"
                    >
                      +{amt.toLocaleString('fa-IR')} تومان
                    </button>
                  ))}
                </div>
              </div>

              {/* Units Sold Box - Positioned under the price */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="units-sold" className="block text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>تعداد کالا (Unit Sold)</span>
                  </label>
                  <span className="text-[11px] text-emerald-400/80 font-mono">
                    {Number(unitsSold || 0).toLocaleString('fa-IR')} عدد
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="units-sold"
                    name="units_sold"
                    type="number"
                    min="0"
                    step="1"
                    value={unitsSold}
                    onChange={(e) => setUnitsSold(e.target.value)}
                    placeholder="تعداد کالاهای خریداری‌شده توسط فروشگاه..."
                    className="w-full px-3.5 py-3 rounded-lg bg-slate-900 border border-emerald-700/60 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 direction-ltr text-right"
                  />
                </div>

                {/* Quick increment buttons for units */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-emerald-400/80 ml-1 font-medium">تعداد سریع:</span>
                  {[1, 5, 10, 20, 50].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => {
                        const cur = parseInt(unitsSold, 10) || 0;
                        setUnitsSold(String(cur + qty));
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-900/60 text-emerald-200 border border-emerald-700/50 hover:bg-emerald-800 touch-manipulation cursor-pointer"
                    >
                      +{qty.toLocaleString('fa-IR')} عدد
                    </button>
                  ))}
                  {unitsSold && parseInt(unitsSold, 10) > 0 && (
                    <button
                      type="button"
                      onClick={() => setUnitsSold('0')}
                      className="px-2 py-1 text-xs font-medium rounded-md bg-slate-800 text-slate-400 hover:text-white border border-slate-700 touch-manipulation cursor-pointer"
                    >
                      صفر
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-xs font-semibold text-slate-300 mb-1.5">
              یادداشت ویزیت و اقدامات بعدی
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً با مدیر فروشگاه صحبت شد و کاتالوگ محصولات تحویل داده شد..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickNoteChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNotes((prev) => (prev ? `${prev} - ${chip}` : chip))}
                  className="text-[11px] px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 touch-manipulation cursor-pointer"
                >
                  +{chip}
                </button>
              ))}
            </div>
          </div>

          {/* GPS Coordinates Display */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-300 block font-mono direction-ltr text-right">
                  مختصات: {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {visitToEdit ? 'موقعیت ثبت‌شده فروشگاه' : (selectedMapCoords ? 'نقطه انتخابی شما روی نقشه' : 'موقعیت زنده GPS دستگاه')}
                </span>
              </div>
            </div>
            {!visitToEdit && (
              <button
                type="button"
                onClick={onRefreshLocation}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium touch-manipulation cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بروزرسانی GPS</span>
              </button>
            )}
          </div>

          {/* Hidden fields */}
          <input type="hidden" name="latitude" value={lat} />
          <input type="hidden" name="longitude" value={lng} />
        </form>

        {/* Sticky Actions Footer */}
        <div
          className="p-3.5 sm:p-4 bg-slate-950/95 border-t border-slate-800 flex items-center gap-2.5 shrink-0"
          style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}
        >
          {visitToEdit && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-3.5 py-3 rounded-xl border border-rose-800/80 bg-rose-950/40 hover:bg-rose-900/60 active:scale-95 text-rose-300 font-bold text-sm transition-all flex items-center gap-1.5 touch-manipulation cursor-pointer disabled:opacity-50"
              title="حذف این ویزیت"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>حذف</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-sm transition-colors touch-manipulation cursor-pointer"
          >
            انصراف
          </button>

          <button
            form="visit-form"
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60 touch-manipulation cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال ذخیره...</span>
              </>
            ) : (
              <span>{visitToEdit ? 'ذخیره تغییرات' : 'ثبت اطلاعات ویزیت'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
