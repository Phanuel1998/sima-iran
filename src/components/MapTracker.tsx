import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Plus,
  Compass,
  MapPin,
  AlertCircle,
  LocateFixed,
  FileSpreadsheet,
} from 'lucide-react';
import type { Visit, SaleStatus, RepLocation } from '../types.ts';

interface MapTrackerProps {
  visits: Visit[];
  onOpenLogModal: (coords?: { latitude: number; longitude: number }) => void;
  onOpenDashboard: () => void;
  selectedVisit: Visit | null;
  onSelectVisit: (visit: Visit | null) => void;
  onEditVisit: (visit: Visit) => void;
  onPromptDelete: (visit: Visit) => void;
  onDownloadExcel: () => void;
}

export const MapTracker: React.FC<MapTrackerProps> = ({
  visits,
  onOpenLogModal,
  onOpenDashboard,
  selectedVisit,
  onSelectVisit,
  onEditVisit,
  onPromptDelete,
  onDownloadExcel,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);

  const [userLocation, setUserLocation] = useState<RepLocation | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'ALL'>('ALL');

  // Default coordinate: Tehran, Iran (Enghelab Square / Valiasr)
  const TEHRAN_CENTER: [number, number] = [35.6892, 51.3890];
  const defaultCenter: [number, number] = TEHRAN_CENTER;

  // Create custom colored HTML pins for Leaflet with inline SVG icons for crisp rendering
  const createPinIcon = (status: SaleStatus, amount: number, shopName: string) => {
    let bgColor = '#10b981'; // Sold (Green)
    let svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    let label = 'موفق';

    if (status === 'Sample') {
      bgColor = '#2563eb'; // Sample (Vibrant Blue)
      svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
      label = 'نمونه';
    } else if (status === 'Rejected') {
      bgColor = '#ef4444'; // Rejected (Red)
      svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      label = 'ناموفق';
    } else if (status === 'Callback') {
      bgColor = '#f59e0b'; // Callback (Yellow)
      svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      label = 'پیگیری مجدد';
    }

    const html = `
      <div class="custom-map-pin group cursor-pointer" title="${shopName} (${label})">
        <div class="pin-shadow"></div>
        <div class="pin-body" style="background-color: ${bgColor};">
          <span class="pin-icon flex items-center justify-center">${svgIcon}</span>
        </div>
        <div class="pin-tip" style="border-top-color: ${bgColor};"></div>
      </div>
    `;

    return L.divIcon({
      className: 'leaflet-pin-wrapper',
      html,
      iconSize: [36, 44],
      iconAnchor: [18, 42],
      popupAnchor: [0, -40],
    });
  };

  const createUserMarkerIcon = () => {
    const html = `
      <div class="user-live-pin">
        <div class="user-pulse"></div>
        <div class="user-inner"></div>
      </div>
    `;
    return L.divIcon({
      className: 'user-marker-container',
      html,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Leaflet map instance centered on Tehran
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 16,
      zoomControl: false,
    });

    // OpenStreetMap tile server
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Layer group for visit pins
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Map click handler: allows logging a visit at clicked position
    map.on('click', (e: L.LeafletMouseEvent) => {
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`
          <div style="padding: 6px; font-family: 'Vazirmatn', Tahoma, sans-serif; text-align: center; direction: rtl;">
            <p style="font-weight: 700; font-size: 13px; margin: 0 0 6px 0; color: #0f172a;">ثبت ویزیت فروشگاه در این نقطه؟</p>
            <p style="font-size: 11px; margin: 0 0 8px 0; color: #64748b; direction: ltr;">${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</p>
            <button id="btn-log-here" style="background: #10b981; color: white; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; width: 100%; font-family: inherit;">
              + ثبت اطلاعات ویزیت
            </button>
          </div>
        `)
        .openOn(map);

      setTimeout(() => {
        const btn = document.getElementById('btn-log-here');
        if (btn) {
          btn.onclick = () => {
            map.closePopup();
            onOpenLogModal({ latitude: e.latlng.lat, longitude: e.latlng.lng });
          };
        }
      }, 50);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // HTML5 Geolocation tracking (`navigator.geolocation.watchPosition`)
  useEffect(() => {
    let watchId: number | null = null;

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const loc: RepLocation = {
            latitude,
            longitude,
            accuracy,
            timestamp: position.timestamp,
          };
          setUserLocation(loc);
          setGpsError(null);

          // Update user live marker
          const map = mapInstanceRef.current;
          if (map) {
            const latLng: [number, number] = [latitude, longitude];

            if (!userMarkerRef.current) {
              const marker = L.marker(latLng, {
                icon: createUserMarkerIcon(),
                zIndexOffset: 1000,
              }).addTo(map);
              marker.bindTooltip('موقعیت زنده شما (GPS)', { direction: 'top', offset: [0, -12] });
              userMarkerRef.current = marker;
            } else {
              userMarkerRef.current.setLatLng(latLng);
            }

            if (!userAccuracyCircleRef.current) {
              userAccuracyCircleRef.current = L.circle(latLng, {
                radius: Math.min(accuracy || 20, 100),
                color: '#38bdf8',
                fillColor: '#38bdf8',
                fillOpacity: 0.15,
                weight: 1,
              }).addTo(map);
            } else {
              userAccuracyCircleRef.current.setLatLng(latLng);
              userAccuracyCircleRef.current.setRadius(Math.min(accuracy || 20, 100));
            }
          }
        },
        (error) => {
          console.warn('Geolocation watchPosition error:', error.message);
          setGpsError('سیگنال GPS خاموش است. موقعیت تهران تنظیم شد.');
          setUserLocation({
            latitude: TEHRAN_CENTER[0],
            longitude: TEHRAN_CENTER[1],
            accuracy: 25,
            timestamp: Date.now(),
          });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      );
    } else {
      setGpsError('مرورگر از قابلیت موقعیت‌یابی پشتیبانی نمی‌کند.');
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Update Markers & Route on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // Filter visits based on selected status pill
    const visibleVisits = visits.filter((v) => {
      if (statusFilter !== 'ALL' && v.sale_status !== statusFilter) return false;
      return true;
    });

    visibleVisits.forEach((visit) => {
      if (!visit.latitude || !visit.longitude) return;
      const latLng: [number, number] = [visit.latitude, visit.longitude];

      const marker = L.marker(latLng, {
        icon: createPinIcon(visit.sale_status, visit.sale_amount, visit.shop_name),
        title: `${visit.shop_name} (برای ویرایش کلیک کنید، برای حذف نگه دارید)`,
      });

      marker.bindTooltip(
        `<div style="text-align: center; font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${visit.shop_name}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">برای ویرایش کلیک کنید • برای حذف نگه دارید</div>
        </div>`,
        { direction: 'top', offset: [0, -36], opacity: 0.95 }
      );

      // Track long-press flag to distinguish normal click from tap-and-hold
      let longPressTimer: any = null;
      let didLongPress = false;

      // Normal click / press on shop marker opens information box to change details
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (didLongPress) {
          didLongPress = false;
          return;
        }
        onSelectVisit(visit);
        onEditVisit(visit);
      });

      markersLayer.addLayer(marker);

      // Attach touch/mouse hold listeners directly to DOM element for hold-to-delete
      const el = marker.getElement();
      if (el) {
        el.style.cursor = 'pointer';
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${visit.shop_name}. برای ویرایش کلیک کنید، برای حذف نگه دارید.`);
        el.setAttribute('tabindex', '0');

        const startHold = () => {
          didLongPress = false;
          if (longPressTimer) clearTimeout(longPressTimer);
          longPressTimer = setTimeout(() => {
            didLongPress = true;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate(60);
              } catch (_) {}
            }
            onPromptDelete(visit);
          }, 500); // 500ms hold threshold
        };

        const cancelHold = () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        };

        el.addEventListener('touchstart', startHold, { passive: true });
        el.addEventListener('touchend', cancelHold, { passive: true });
        el.addEventListener('touchcancel', cancelHold, { passive: true });
        el.addEventListener('touchmove', cancelHold, { passive: true });

        el.addEventListener('mousedown', (e) => {
          if (e.button === 0) startHold();
        });
        el.addEventListener('mouseup', cancelHold);
        el.addEventListener('mouseleave', cancelHold);

        // Keyboard accessibility: Enter to edit, Delete to prompt delete
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectVisit(visit);
            onEditVisit(visit);
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            onPromptDelete(visit);
          }
        });
      }
    });
  }, [visits, statusFilter, onSelectVisit, onEditVisit, onPromptDelete]);

  // Center on selected visit if passed from Dashboard
  useEffect(() => {
    if (selectedVisit && mapInstanceRef.current && selectedVisit.latitude && selectedVisit.longitude) {
      mapInstanceRef.current.setView([selectedVisit.latitude, selectedVisit.longitude], 17, {
        animate: true,
      });
    }
  }, [selectedVisit]);

  // Center on User GPS or directly to Tehran when location is off
  const handleRecenterGps = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({
            latitude: lat,
            longitude: lng,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
          setGpsError(null);
          map.setView([lat, lng], 16, { animate: true });
        },
        () => {
          // Location is off/denied: center directly on Tehran!
          setGpsError('سیگنال GPS خاموش است. موقعیت تهران تنظیم شد.');
          setUserLocation({
            latitude: TEHRAN_CENTER[0],
            longitude: TEHRAN_CENTER[1],
            accuracy: 25,
            timestamp: Date.now(),
          });
          map.setView(TEHRAN_CENTER, 15, { animate: true });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      setGpsError('سیگنال GPS خاموش است. موقعیت تهران تنظیم شد.');
      map.setView(TEHRAN_CENTER, 15, { animate: true });
    }
  }, []);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden bg-slate-950 font-sans" dir="rtl">
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0 touch-pan-x touch-pan-y"
        style={{ minHeight: '100%', height: '100%' }}
      />

      {/* Top Floating Control Bar */}
      <div
        className="absolute inset-x-3 z-20 flex items-center justify-between pointer-events-none"
        style={{ top: 'max(10px, calc(env(safe-area-inset-top, 0px) + 8px))' }}
      >
        {/* App Title & Quick Status */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-700/80 shadow-lg text-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-bold text-white tracking-tight">ردیاب ویزیتور فروش</span>
          <span className="text-slate-400 font-mono text-[11px] hidden sm:inline direction-ltr">
            {userLocation ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}` : 'در حال دریافت GPS...'}
          </span>
        </div>

        {/* Dashboard Drawer Trigger Button */}
        <button
          type="button"
          onClick={onOpenDashboard}
          aria-label="باز کردن داشبورد فروش و آمار"
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-white font-bold text-xs border border-slate-700/80 shadow-lg transition-all touch-manipulation cursor-pointer"
        >
          <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>داشبورد</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
            {visits.length}
          </span>
        </button>
      </div>

      {/* Quick Pin Filter Chips (Floating below top bar) */}
      <div
        className="absolute inset-x-3 z-20 flex items-center gap-1.5 overflow-x-auto pb-1 pointer-events-auto select-none no-scrollbar"
        style={{ top: 'max(56px, calc(env(safe-area-inset-top, 0px) + 52px))' }}
      >
        {(
          [
            { id: 'ALL', label: 'همه ویزیت‌ها', color: 'bg-slate-800 text-slate-200' },
            { id: 'Sold', label: 'موفق (سبز)', color: 'bg-emerald-600/90 text-white' },
            { id: 'Sample', label: 'نمونه (آبی)', color: 'bg-blue-600/90 text-white' },
            { id: 'Rejected', label: 'ناموفق (قرمز)', color: 'bg-rose-600/90 text-white' },
            { id: 'Callback', label: 'پیگیری (زرد)', color: 'bg-amber-600/90 text-white' },
          ] as const
        ).map((chip) => {
          const isActive = statusFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition-all shadow-md whitespace-nowrap touch-manipulation cursor-pointer ${
                isActive
                  ? `${chip.color} border-white/40 ring-2 ring-emerald-400/50 scale-102`
                  : 'bg-slate-900/80 border-slate-700/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* GPS Warning if restricted */}
      {gpsError && (
        <div
          className="absolute left-3 z-20 pointer-events-none max-w-xs"
          style={{ top: 'max(100px, calc(env(safe-area-inset-top, 0px) + 96px))' }}
        >
          <div className="bg-slate-900/90 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 shadow-lg backdrop-blur-xs">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>تهران (موقعیت پیش‌فرض)</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Action Bar & Controls - Positioned comfortably above mobile gesture navigation */}
      <div
        className="absolute inset-x-3 sm:inset-x-4 z-30 flex items-center justify-between pointer-events-none transition-all"
        style={{
          bottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
        }}
      >
        {/* Left Side Controls: Recenter GPS ("My Location") + Excel Download Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Recenter / My Location button */}
          <button
            type="button"
            onClick={handleRecenterGps}
            aria-label="تنظیم مجدد نقشه روی موقعیت زنده یا تهران"
            className="h-12 px-3.5 sm:px-4 rounded-2xl bg-slate-900/95 hover:bg-slate-800 active:scale-95 text-white border border-slate-700 shadow-2xl flex items-center gap-2 transition-all touch-manipulation cursor-pointer"
            title="موقعیت من روی نقشه"
          >
            <LocateFixed className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-slate-100 whitespace-nowrap">موقعیت من</span>
          </button>

          {/* Excel Export Button */}
          <button
            type="button"
            onClick={onDownloadExcel}
            aria-label="دانلود خروجی اکسل از تمام فروشگاه‌ها"
            className="h-12 px-3.5 sm:px-4 rounded-2xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/60 active:scale-95 text-emerald-300 shadow-2xl flex items-center gap-2 transition-all touch-manipulation cursor-pointer"
            title="دانلود فایل اکسل راست‌به‌چپ فروشگاه‌ها"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold whitespace-nowrap">خروجی اکسل</span>
          </button>
        </div>

        {/* Primary Action: Log Visit Button */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if (userLocation) {
                onOpenLogModal({ latitude: userLocation.latitude, longitude: userLocation.longitude });
              } else {
                onOpenLogModal({ latitude: defaultCenter[0], longitude: defaultCenter[1] });
              }
            }}
            aria-label="ثبت ویزیت فروشگاه جدید"
            className="h-12 sm:h-13 px-4 sm:px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm shadow-2xl shadow-emerald-950/80 border border-emerald-400/50 flex items-center gap-2 transition-all touch-manipulation cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-white stroke-[3]" />
            </div>
            <span className="tracking-wide whitespace-nowrap">+ ثبت ویزیت</span>
          </button>
        </div>
      </div>
    </div>
  );
};
