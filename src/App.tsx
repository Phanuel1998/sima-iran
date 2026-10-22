import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapTracker } from './components/MapTracker.tsx';
import { LogVisitModal } from './components/LogVisitModal.tsx';
import { DashboardDrawer } from './components/DashboardDrawer.tsx';
import { fetchVisits, submitVisit, updateVisit, deleteVisit, syncOfflineQueue } from './services/api.ts';
import { getOfflineQueue } from './services/offlineStorage.ts';
import { calculateMetrics } from './utils/metrics.ts';
import { downloadPersianExcel } from './utils/excel.ts';
import type { Visit, VisitFormData } from './types.ts';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.tsx';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [visitToEdit, setVisitToEdit] = useState<Visit | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<Visit | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedMapCoords, setSelectedMapCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentGpsCoords, setCurrentGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Show transient toast notification
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  // Update offline queue count
  const updatePendingCount = useCallback(() => {
    const queue = getOfflineQueue();
    setPendingSyncCount(queue.length);
  }, []);

  // Load visits
  const loadVisits = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchVisits();
      setVisits(res.visits);
      setIsOffline(res.isOffline);
      updatePendingCount();
    } catch (err) {
      console.error('Failed to load visits:', err);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, [updatePendingCount]);

  // Initial load
  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  // Sync offline queue when coming online
  const handleSync = useCallback(async () => {
    try {
      const res = await syncOfflineQueue();
      if (res.syncedCount > 0) {
        setVisits(res.visits);
        showToast(`${res.syncedCount.toLocaleString('fa-IR')} ویزیت آفلاین با سرور همگام‌سازی شد!`, 'success');
      }
      updatePendingCount();
    } catch (err: any) {
      console.warn('Sync failed:', err);
    }
  }, [showToast, updatePendingCount]);

  // Listen to browser online/offline events
  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      showToast('اتصال اینترنت برقرار شد. در حال همگام‌سازی...', 'info');
      handleSync();
    };

    const onOffline = () => {
      setIsOffline(true);
      showToast('دستگاه در حالت آفلاین است. ویزیت‌ها در حافظه ذخیره می‌شوند.', 'error');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Periodically check if there are pending offline items to sync
    const interval = setInterval(() => {
      if (navigator.onLine && getOfflineQueue().length > 0) {
        handleSync();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, [handleSync, showToast]);

  // Compute metrics
  const metrics = useMemo(() => calculateMetrics(visits), [visits]);

  // Handle Open Log Modal (new visit)
  const handleOpenLogModal = useCallback((coords?: { latitude: number; longitude: number }) => {
    setVisitToEdit(null);
    if (coords) {
      setSelectedMapCoords(coords);
    } else {
      setSelectedMapCoords(null);
    }
    setIsLogModalOpen(true);
  }, []);

  // Handle Open Edit Modal (change existing shop information)
  const handleOpenEditModal = useCallback((visit: Visit) => {
    setVisitToEdit(visit);
    setIsLogModalOpen(true);
  }, []);

  // Handle Prompt Delete (tap-and-hold on pin or delete action)
  const handlePromptDelete = useCallback((visit: Visit) => {
    setVisitToDelete(visit);
  }, []);

  // Handle Visit Submission (new)
  const handleSubmitVisit = async (formData: VisitFormData) => {
    try {
      const result = await submitVisit(formData);
      setVisits((prev) => [result.visit, ...prev.filter((v) => v.id !== result.visit.id)]);
      updatePendingCount();

      if (result.offline) {
        showToast(`در صف آفلاین ذخیره شد. با اتصال اینترنت ارسال می‌شود.`, 'info');
      } else {
        showToast(`ویزیت با موفقیت ثبت شد: ${formData.shop_name}`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'خطا در ثبت ویزیت', 'error');
      throw err;
    }
  };

  // Handle Visit Update (edit information)
  const handleUpdateVisit = async (id: number | string, formData: VisitFormData) => {
    try {
      const result = await updateVisit(id, formData);
      setVisits((prev) =>
        prev.map((v) => (String(v.id) === String(id) ? result.visit : v))
      );
      updatePendingCount();

      if (result.offline) {
        showToast(`تغییرات "${formData.shop_name}" در حافظه آفلاین ذخیره شد`, 'info');
      } else {
        showToast(`اطلاعات "${formData.shop_name}" با موفقیت بروزرسانی شد!`, 'success');
      }
      setVisitToEdit(null);
    } catch (err: any) {
      showToast(err.message || 'خطا در بروزرسانی اطلاعات', 'error');
      throw err;
    }
  };

  // Handle Permanent Delete confirmation
  const handleConfirmDelete = async () => {
    if (!visitToDelete) return;
    setIsDeleting(true);
    try {
      await deleteVisit(visitToDelete.id);
      setVisits((prev) => prev.filter((v) => String(v.id) !== String(visitToDelete.id)));
      if (selectedVisit && String(selectedVisit.id) === String(visitToDelete.id)) {
        setSelectedVisit(null);
      }
      showToast(`فروشگاه "${visitToDelete.shop_name}" حذف گردید`, 'success');
      setVisitToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'خطا در حذف رکورد', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Persian RTL Excel Download
  const handleDownloadExcel = useCallback(() => {
    setIsDownloadingExcel(true);
    try {
      downloadPersianExcel(visits);
      showToast('فایل اکسل راست‌به‌چپ با موفقیت آماده و دانلود شد!', 'success');
    } catch (err: any) {
      console.error('Failed to export Excel:', err);
      showToast('خطا در تولید فایل اکسل', 'error');
    } finally {
      setIsDownloadingExcel(false);
    }
  }, [visits, showToast]);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden bg-slate-900 text-slate-100 font-sans select-none" dir="rtl">
      {/* Offline Status Bar (Top banner when disconnected) */}
      {(isOffline || pendingSyncCount > 0) && (
        <div className="bg-amber-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between z-30 shrink-0 shadow-md">
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isOffline ? 'در حال کار در حالت آفلاین' : 'اتصال آنلاین برقرار است'}
              {pendingSyncCount > 0 ? ` (${pendingSyncCount.toLocaleString('fa-IR')} رکورد در صف ذخیره)` : ''}
            </span>
          </div>
          {pendingSyncCount > 0 && !isOffline && (
            <button
              onClick={handleSync}
              className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>همگام‌سازی</span>
            </button>
          )}
        </div>
      )}

      {/* Main Map View */}
      <main className="flex-1 relative w-full min-h-0 overflow-hidden">
        <MapTracker
          visits={visits}
          onOpenLogModal={handleOpenLogModal}
          onOpenDashboard={() => setIsDashboardOpen(true)}
          selectedVisit={selectedVisit}
          onSelectVisit={(v) => setSelectedVisit(v)}
          onEditVisit={handleOpenEditModal}
          onPromptDelete={handlePromptDelete}
          onDownloadExcel={handleDownloadExcel}
        />
      </main>

      {/* Slide-out Dashboard Drawer */}
      <DashboardDrawer
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        visits={visits}
        metrics={metrics}
        onSelectVisit={(v) => {
          setSelectedVisit(v);
          setIsDashboardOpen(false);
        }}
        onEditVisit={(v) => {
          setIsDashboardOpen(false);
          handleOpenEditModal(v);
        }}
        onDeleteVisit={(v) => {
          handlePromptDelete(v);
        }}
        onDownloadExcel={handleDownloadExcel}
        isDownloadingExcel={isDownloadingExcel}
        onManualSync={handleSync}
        pendingSyncCount={pendingSyncCount}
      />

      {/* Log Visit Modal (also acts as Edit Information Box) */}
      <LogVisitModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false);
          setVisitToEdit(null);
        }}
        onSubmit={handleSubmitVisit}
        onUpdate={handleUpdateVisit}
        onDelete={async (id) => {
          const v = visits.find((item) => String(item.id) === String(id));
          if (v) {
            setIsLogModalOpen(false);
            setVisitToEdit(null);
            handlePromptDelete(v);
          }
        }}
        visitToEdit={visitToEdit}
        currentLocation={currentGpsCoords}
        selectedMapCoords={selectedMapCoords}
        onRefreshLocation={() => {
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setCurrentGpsCoords({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
                showToast('مختصات GPS با موفقیت دریافت شد', 'info');
              },
              () => {
                setCurrentGpsCoords({
                  latitude: 35.6892,
                  longitude: 51.3890,
                });
                showToast('سیگنال GPS خاموش است: موقعیت پیش‌فرض تهران تنظیم شد', 'info');
              }
            );
          } else {
            setCurrentGpsCoords({
              latitude: 35.6892,
              longitude: 51.3890,
            });
            showToast('موقعیت پیش‌فرض تهران تنظیم شد', 'info');
          }
        }}
        isOffline={isOffline}
      />

      {/* Permanent Delete Confirmation Dialog (triggered by tap-and-hold on pin) */}
      <DeleteConfirmModal
        visit={visitToDelete}
        onCancel={() => setVisitToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-22 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div
            className={`px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 max-w-sm backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/80 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-700/80 shadow-rose-950/50'
                : 'bg-slate-900/95 text-slate-100 border-slate-700 shadow-black/60'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <RefreshCw className="w-4 h-4 text-sky-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
