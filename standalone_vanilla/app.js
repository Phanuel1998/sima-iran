// Standalone Vanilla JavaScript Field Sales Route & Visit Tracker
const API_BASE = window.location.origin.includes('localhost') ? 'http://127.0.0.1:5000/api' : '/api';
const OFFLINE_KEY = 'vanilla_sales_offline_queue';

let map;
let markersLayer;
let userMarker;
let currentCoords = { lat: 35.6892, lng: 51.3890 }; // Tehran, Iran
let visits = [];

// Initialize Map
function initMap() {
  map = L.map('map', { zoomControl: false }).setView([currentCoords.lat, currentCoords.lng], 16);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Map Click to Log
  map.on('click', (e) => {
    currentCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    openLogModal();
  });

  // Track user position via HTML5 Geolocation
  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(
      (pos) => {
        currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updateUserMarker();
      },
      (err) => console.warn('Geolocation warning:', err.message),
      { enableHighAccuracy: true }
    );
  }
}

function updateUserMarker() {
  const icon = L.divIcon({
    className: '',
    html: '<div style="width:14px; height:14px; background:#0284c7; border:2px solid white; border-radius:50%; box-shadow:0 0 10px #0284c7;"></div>',
    iconSize: [14, 14]
  });

  if (!userMarker) {
    userMarker = L.marker([currentCoords.lat, currentCoords.lng], { icon }).addTo(map);
  } else {
    userMarker.setLatLng([currentCoords.lat, currentCoords.lng]);
  }
}

function getPinIcon(status) {
  let color = '#10b981';
  let char = '✓';
  if (status === 'Rejected') { color = '#ef4444'; char = '✕'; }
  if (status === 'Callback') { color = '#f59e0b'; char = '⏰'; }

  return L.divIcon({
    className: '',
    html: `<div class="custom-pin pin-${status.toLowerCase()}" style="background:${color};">${char}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

function renderPins() {
  markersLayer.clearLayers();
  visits.forEach(v => {
    if (!v.latitude || !v.longitude) return;
    const marker = L.marker([v.latitude, v.longitude], { icon: getPinIcon(v.sale_status) });
    const popupHtml = `
      <div style="font-family:sans-serif; min-width:160px;">
        <h4 style="margin:0 0 4px; font-weight:800;">${v.shop_name}</h4>
        <div style="font-size:12px; font-weight:700; color:${v.sale_status === 'Sold' ? '#10b981' : v.sale_status === 'Rejected' ? '#ef4444' : '#f59e0b'};">${v.sale_status.toUpperCase()} ${v.sale_amount > 0 ? '($' + v.sale_amount + ')' : ''}</div>
        ${v.phone_number ? `<div style="font-size:11px; margin:4px 0;"><a href="tel:${v.phone_number}">📞 ${v.phone_number}</a></div>` : ''}
        ${v.notes ? `<div style="font-size:11px; color:#475569; background:#f1f5f9; padding:4px; border-radius:4px;">${v.notes}</div>` : ''}
      </div>
    `;
    marker.bindPopup(popupHtml);
    markersLayer.addLayer(marker);
  });
}

// Fetch visits from backend
async function loadVisits() {
  try {
    const res = await fetch(`${API_BASE}/visits`);
    const data = await res.json();
    if (data.success) {
      visits = data.visits;
      localStorage.setItem('cached_visits', JSON.stringify(visits));
    }
  } catch (err) {
    console.warn('Network offline, using cached visits:', err);
    visits = JSON.parse(localStorage.getItem('cached_visits') || '[]');
  }
  renderPins();
  updateMetrics();
}

// Submit visit (with offline-first fallback)
async function submitVisit(formData) {
  if (!navigator.onLine) {
    saveOffline(formData);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (!res.ok) throw new Error('Save failed');
    const data = await res.json();
    if (data.success) {
      visits.unshift(data.visit);
      renderPins();
      updateMetrics();
    }
  } catch (err) {
    saveOffline(formData);
  }
}

function saveOffline(data) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
  queue.push(data);
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  visits.unshift({ ...data, id: Date.now(), timestamp: new Date().toISOString() });
  renderPins();
  updateMetrics();
  alert('Network unavailable: Saved visit locally. Will sync when back online.');
}

async function syncOffline() {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
  if (queue.length === 0) return;
  try {
    const res = await fetch(`${API_BASE}/visits/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visits: queue })
    });
    if (res.ok) {
      localStorage.removeItem(OFFLINE_KEY);
      loadVisits();
    }
  } catch (err) {
    console.warn('Sync failed:', err);
  }
}

window.addEventListener('online', syncOffline);

function updateMetrics() {
  const total = visits.length;
  let sales = 0;
  let sold = 0, rejected = 0, callback = 0;

  visits.forEach(v => {
    const amt = parseFloat(v.sale_amount) || 0;
    if (v.sale_status === 'Sold') { sold++; sales += amt; }
    else if (v.sale_status === 'Rejected') { rejected++; }
    else if (v.sale_status === 'Callback') { callback++; }
  });

  const rate = total > 0 ? ((sold / total) * 100).toFixed(1) : 0;

  document.getElementById('badge-count').innerText = total;
  document.getElementById('metric-total').innerText = total;
  document.getElementById('metric-sales').innerText = '$' + sales.toFixed(2);
  document.getElementById('metric-conversion').innerText = rate + '%';
  document.getElementById('metric-sold').innerText = sold;
  document.getElementById('metric-rejected').innerText = rejected;
  document.getElementById('metric-callback').innerText = callback;

  // Render list
  const listEl = document.getElementById('visits-list');
  listEl.innerHTML = visits.map(v => `
    <div style="background:#1e293b; padding:10px; border-radius:8px; border:1px solid #334155; font-size:12px;">
      <div style="font-weight:700; color:#fff;">${v.shop_name}</div>
      <div style="color:${v.sale_status === 'Sold' ? '#10b981' : v.sale_status === 'Rejected' ? '#ef4444' : '#f59e0b'}; font-weight:700;">${v.sale_status} ${v.sale_amount > 0 ? ' - $' + v.sale_amount : ''}</div>
      <div style="color:#94a3b8; font-size:11px;">${v.timestamp || ''}</div>
    </div>
  `).join('');
}

// UI Handlers
function openLogModal() {
  document.getElementById('latitude').value = currentCoords.lat;
  document.getElementById('longitude').value = currentCoords.lng;
  document.getElementById('coords-display').innerText = `GPS: ${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}`;
  document.getElementById('modal-log').classList.add('active');
}

function closeLogModal() {
  document.getElementById('modal-log').classList.remove('active');
}

document.getElementById('btn-log-visit').addEventListener('click', openLogModal);
document.getElementById('btn-close-modal').addEventListener('click', closeLogModal);

document.getElementById('btn-toggle-dashboard').addEventListener('click', () => {
  document.getElementById('drawer-dashboard').classList.add('active');
});
document.getElementById('btn-close-drawer').addEventListener('click', () => {
  document.getElementById('drawer-dashboard').classList.remove('active');
});

document.getElementById('btn-recenter').addEventListener('click', () => {
  map.setView([currentCoords.lat, currentCoords.lng], 16, { animate: true });
});

document.getElementById('form-visit').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    shop_name: document.getElementById('shop_name').value.trim(),
    phone_number: document.getElementById('phone_number').value.trim(),
    sale_status: document.getElementById('sale_status').value,
    sale_amount: parseFloat(document.getElementById('sale_amount').value) || 0,
    notes: document.getElementById('notes').value.trim(),
    latitude: parseFloat(document.getElementById('latitude').value),
    longitude: parseFloat(document.getElementById('longitude').value),
  };

  await submitVisit(formData);
  e.target.reset();
  closeLogModal();
});

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadVisits();
});
