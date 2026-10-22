import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { Visit } from '../types.ts';

interface DeleteConfirmModalProps {
  visit: Visit | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  visit,
  onCancel,
  onConfirm,
  isDeleting,
}) => {
  if (!visit) return null;

  const getStatusLabel = () => {
    if (visit.sale_status === 'Sold') return 'فروش موفق';
    if (visit.sale_status === 'Sample') return 'ارائه نمونه به فروشگاه (آبی)';
    if (visit.sale_status === 'Rejected') return 'عدم تمایل (ناموفق)';
    return 'پیگیری مجدد';
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="w-full max-w-sm bg-slate-900 border border-rose-900/60 rounded-2xl shadow-2xl p-5 space-y-4 font-sans">
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
            <Trash2 className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex-1">
            <h3 id="delete-dialog-title" className="text-base font-bold text-white">
              حذف ویزیت فروشگاه؟
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              باز شده با نگه‌داشتن آیکون روی نقشه
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="انصراف از حذف"
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white text-sm">{visit.shop_name}</div>
          <div className="text-[11px] text-slate-400">
            وضعیت: <span className="font-semibold text-slate-200">{getStatusLabel()}</span>
            {visit.sale_status === 'Sold' && Number(visit.sale_amount) > 0 ? ` (${Number(visit.sale_amount).toLocaleString('fa-IR')} تومان)` : ''}
            {visit.sale_status === 'Sold' && visit.units_sold && Number(visit.units_sold) > 0 ? ` • ${Number(visit.units_sold).toLocaleString('fa-IR')} قلم کالا` : ''}
            {visit.sale_status === 'Sample' && visit.units_sold && Number(visit.units_sold) > 0 ? ` • ${Number(visit.units_sold).toLocaleString('fa-IR')} عدد نمونه` : ''}
          </div>
          {visit.phone_number && (
            <div className="text-[11px] text-slate-400 direction-ltr text-right">تلفن: {visit.phone_number}</div>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          آیا از حذف دائمی این رکورد اطمینان دارید؟ این عمل نشانگر فروشگاه را از روی نقشه حذف کرده و آمارهای مسیر را بروزرسانی می‌کند.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition-colors touch-manipulation cursor-pointer disabled:opacity-50"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-rose-950/60 border border-rose-400/50 transition-all flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <span>در حال حذف...</span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف دائمی رکورد</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
