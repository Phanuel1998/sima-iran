# Field Sales Route & Visit Tracker (PWA)

A mobile-first Progressive Web Application designed for field sales representatives to track their walking route, log shop visits with GPS coordinates, manage offline sync, and analyze real-time sales conversion metrics.

---

## Tech Stack & Architecture

- **Frontend**: Mobile-first responsive UI, Leaflet.js with high-contrast OpenStreetMap / CartoDB tiles, touch-optimized dialogs, offline-first localStorage queue.
- **Backend Options**:
  1. **Full-Stack Node.js / Express**: `server.ts` with built-in SQLite (`node:sqlite` DatabaseSync) and Vite middleware.
  2. **Python / Flask**: `backend_python/app.py` with SQLite3, Flask-CORS, and CSV export.
- **Database**: SQLite (`field_sales.db`) with `visits` table.
- **Offline Sync**: Automatic queuing in `localStorage` when offline with background retry upon reconnect.

---

## Directory Structure

```text
├── field_sales.db             # SQLite database storing visits
├── server.ts                  # Express + SQLite full-stack server
├── package.json               # Node dependencies & dev scripts
├── index.html                 # App entry point with Leaflet & PWA meta
├── src/
│   ├── App.tsx                # Main application orchestrator
│   ├── main.tsx               # Client entry point
│   ├── index.css              # Custom map pins, pulse animations & styling
│   ├── types.ts               # Visit, SaleStatus, and Metrics interfaces
│   ├── components/
│   │   ├── MapTracker.tsx     # Fullscreen Leaflet map, GPS tracking & pins
│   │   ├── LogVisitModal.tsx  # Touch-friendly bottom sheet visit logging form
│   │   └── DashboardDrawer.tsx# Daily KPI cards, search filter & CSV export
│   ├── services/
│   │   ├── api.ts             # API client with automatic offline fallback
│   │   └── offlineStorage.ts  # LocalStorage queue & caching management
│   └── utils/
│       ├── metrics.ts         # Pure calculations: conversion rate, distance, CSV
│       └── metrics.test.ts    # Node:test unit tests
├── backend_python/
│   ├── app.py                 # Standalone Python Flask backend
│   └── requirements.txt       # Python dependencies (flask, flask-cors)
└── standalone_vanilla/
    ├── index.html             # Pure Vanilla HTML5 frontend
    ├── styles.css             # Vanilla CSS mobile-first stylesheet
    └── app.js                 # Pure Vanilla JS Leaflet & offline sync
```

---

## How to Run

### Option A: Node.js Full-Stack (Default in this environment)
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Option B: Python Flask + Standalone Frontend
1. Install Python dependencies:
   ```bash
   pip install -r backend_python/requirements.txt
   ```
2. Start Flask backend:
   ```bash
   python backend_python/app.py
   ```
   Backend runs on `http://localhost:5000` with endpoints:
   - `GET /api/visits`
   - `POST /api/visits`
   - `POST /api/visits/sync`
   - `GET /api/export` (Downloadable CSV)
3. Open `standalone_vanilla/index.html` in your browser or serve it via `python -m http.server 8000`.

---

## Key Features

1. **Visual Route & Map Interface**:
   - Leaflet.js with live geolocation (`navigator.geolocation.watchPosition`).
   - Dynamic colored pins:
     - 🟢 **Green Pin**: Sale Closed ("Sold")
     - 🔴 **Red Pin**: Deal Rejected ("Rejected")
     - 🟡 **Yellow Pin**: Follow-up Required ("Callback")
   - Tap any spot on the map or use the **"Log Visit" FAB** to record a visit.
   - Route path polyline displaying walking trajectory and total distance covered.

2. **Offline-First Resilience**:
   - Network dropouts automatically queue records into `localStorage`.
   - Visual status bar displays offline state and pending count.
   - Auto-syncs to SQLite backend immediately when network is restored.

3. **Metrics Dashboard & CSV Export**:
   - Real-time KPIs: Total Visited, Total Sales Revenue, Conversion Rate (%).
   - One-click CSV export of SQLite records formatted for CRM / Excel.
