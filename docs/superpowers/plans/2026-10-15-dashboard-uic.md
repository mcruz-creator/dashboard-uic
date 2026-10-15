# Dashboard GO UIC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-section clinical trials dashboard for GO UIC, hosted on GitHub Pages, fed live from Google Sheets CSV, with login protection and Grupo Oroño branding.

**Architecture:** Static site (no build step). HTML pages load Tailwind CSS, Chart.js, and PapaParse from CDN. On page load, `data.js` fetches 3 published Google Sheets CSVs, parses them into JS arrays, and caches in memory. Each section reads from that cache, applies filters, and renders KPI cards, Chart.js graphs, and sortable/paginated HTML tables. Login uses SHA-256 hash comparison with sessionStorage persistence.

**Tech Stack:** HTML5, Tailwind CSS 3 (CDN), Chart.js 4 (CDN), PapaParse 5 (CDN), vanilla JS (ES modules), Google Fonts (Inter)

**Spec:** `docs/superpowers/specs/2026-10-15-dashboard-uic-design.md`

## Global Constraints

- No build step, no npm, no bundler — everything loads from CDN or is inline
- All CDN scripts use exact pinned versions (Tailwind 3.4.1, Chart.js 4.4.1, PapaParse 5.4.1)
- Working directory: `C:\Users\mcruz\Desktop\Claude\UIC`
- Colors: primary #003366 (azul GO), secondary #00874e (verde GO), bg #f8f9fa, cards white, text #1f2937
- Currency format: `USD #,###` with thousands separator (US locale)
- Percentages: 1 decimal (`42.4%`)
- Font: Inter from Google Fonts, fallback system-ui
- Responsive: works on desktop (1280px max), tablet, and mobile (cards stack, tables scroll horizontally)
- No unit test framework (static site); each task verifies via browser manually

## Review Focus

1. **Empty Google Sheet / CSV fetch failure** — dashboard should show an error message with retry button, never a blank page or JS error
2. **Proyección row parsing** — the Proyección sheet has a non-standard layout (indicators as rows, years as columns, with header rows and blank rows); parser must skip decorative rows and match indicator names exactly
3. **Month proration** — when comparing monthly real vs projection, the annual projection is divided by 12; if real data only covers partial months, the KPIs could be misleading (no mitigation in scope, but the user should be aware)
4. **Join Facturación↔Producción by Protocolo** — protocol names must match exactly between sheets; whitespace differences or typos in the Sheet will silently drop rows from the Sponsors section
5. **Cobrado column** — the spec highlights rows with Cobrado = empty or "No" in red; the column may contain "Sí", "Si", "No", empty, or other values — normalize before comparing

---

### Task 1: Login page and auth

**Files:**
- Create: `index.html`
- Create: `js/auth.js`
- Create: `css/style.css`

**Interfaces:**
- Consumes: nothing
- Produces: `sessionStorage` token `uic_auth` that `dashboard.html` checks; `css/style.css` with CSS custom properties for GO colors used by all subsequent tasks

- [ ] **Step 1: Create `css/style.css` with GO color tokens and base styles**

```css
:root {
  --go-primary: #003366;
  --go-secondary: #00874e;
  --go-bg: #f8f9fa;
  --go-card: #ffffff;
  --go-text: #1f2937;
  --go-success: #10b981;
  --go-warning: #f59e0b;
  --go-error: #ef4444;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background-color: var(--go-bg);
  color: var(--go-text);
  margin: 0;
}

.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--go-primary) 0%, #004d99 100%);
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  text-align: center;
}

.login-card img {
  max-width: 180px;
  margin-bottom: 1.5rem;
}

.login-card h1 {
  color: var(--go-primary);
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.login-card h2 {
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 400;
  margin-bottom: 2rem;
}

.login-field {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  margin-bottom: 1rem;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}

.login-field:focus {
  border-color: var(--go-primary);
  box-shadow: 0 0 0 3px rgba(0,51,102,0.1);
}

.login-btn {
  width: 100%;
  padding: 0.75rem;
  background: var(--go-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.login-btn:hover {
  background: #004d99;
}

.login-error {
  color: var(--go-error);
  font-size: 0.85rem;
  margin-top: 0.75rem;
  display: none;
}
```

- [ ] **Step 2: Create `js/auth.js` with hash check and session management**

```js
const AUTH_CONFIG = {
  // SHA-256 hash of the password — generate with:
  // echo -n "password" | shasum -a 256
  // or: crypto.subtle.digest('SHA-256', new TextEncoder().encode('password'))
  passwordHash: 'PLACEHOLDER_HASH_HERE',
  sessionKey: 'uic_auth',
  tokenValue: 'authenticated'
};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(password) {
  const hash = await hashPassword(password);
  if (hash === AUTH_CONFIG.passwordHash) {
    sessionStorage.setItem(AUTH_CONFIG.sessionKey, AUTH_CONFIG.tokenValue);
    return true;
  }
  return false;
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_CONFIG.sessionKey) === AUTH_CONFIG.tokenValue;
}

function logout() {
  sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
  window.location.href = 'index.html';
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
```

- [ ] **Step 3: Create `index.html` with login form**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GO UIC — Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <img src="assets/logo-go.png" alt="Grupo Oroño">
      <h1>GO UIC</h1>
      <h2>Unidad de Investigación Clínica</h2>
      <form id="loginForm">
        <input type="password" id="password" class="login-field" placeholder="Contraseña" required autofocus>
        <button type="submit" class="login-btn">Ingresar</button>
        <p id="loginError" class="login-error">Contraseña incorrecta</p>
      </form>
    </div>
  </div>
  <script src="js/auth.js"></script>
  <script>
    // If already authenticated, go to dashboard
    if (isAuthenticated()) {
      window.location.href = 'dashboard.html';
    }
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const success = await login(password);
      if (success) {
        window.location.href = 'dashboard.html';
      } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Create a placeholder `assets/logo-go.png`**

Use a placeholder image (a simple colored rectangle or text). The real logo will be added later when the user provides it. Create a minimal SVG as `assets/logo-go.svg` if the .png is not available:

```
assets/logo-go.png  ← user provides later
```

For now, the `<img>` tag has `alt="Grupo Oroño"` so the page works without the image.

- [ ] **Step 5: Verify in browser**

Open `index.html` in browser. Check:
1. Login card centered on blue gradient background
2. Logo area shows (or alt text)
3. Password field accepts input
4. Submit with wrong password shows error message
5. Submit with correct password (once hash is set) redirects to dashboard.html

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/auth.js assets/
git commit -m "feat: add login page with auth and GO branding"
```

---

### Task 2: Dashboard shell (header, tabs, layout)

**Files:**
- Create: `dashboard.html`

**Interfaces:**
- Consumes: `js/auth.js` → `requireAuth()`, `logout()`; `css/style.css` → GO color tokens
- Produces: `dashboard.html` with `<div id="section-home">`, `<div id="section-facturacion">`, `<div id="section-produccion">`, `<div id="section-proyeccion">`, `<div id="section-sponsors">` containers. Tab switching via `data-section` attribute. Global function `switchSection(name)`.

- [ ] **Step 1: Create `dashboard.html` with full layout**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GO UIC — Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com/3.4.1"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            go: { primary: '#003366', secondary: '#00874e', bg: '#f8f9fa' }
          }
        }
      }
    }
  </script>
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
</head>
<body class="bg-gray-50 min-h-screen">

  <!-- Header -->
  <header class="bg-go-primary text-white shadow-lg sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="assets/logo-go.png" alt="GO" class="h-10">
        <span class="text-lg font-semibold hidden sm:inline">GO UIC — Dashboard</span>
      </div>
      <button onclick="logout()" class="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition">
        Cerrar sesión
      </button>
    </div>
  </header>

  <!-- Tabs -->
  <nav class="bg-white border-b shadow-sm sticky top-[60px] z-40">
    <div class="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
      <button class="tab-btn active" data-section="home" onclick="switchSection('home')">
        Real vs Proyección
      </button>
      <button class="tab-btn" data-section="facturacion" onclick="switchSection('facturacion')">
        Facturación
      </button>
      <button class="tab-btn" data-section="produccion" onclick="switchSection('produccion')">
        Producción
      </button>
      <button class="tab-btn" data-section="proyeccion" onclick="switchSection('proyeccion')">
        Proyección
      </button>
      <button class="tab-btn" data-section="sponsors" onclick="switchSection('sponsors')">
        Patrocinadores
      </button>
    </div>
  </nav>

  <!-- Loading spinner -->
  <div id="loading" class="flex flex-col items-center justify-center py-32">
    <div class="animate-spin rounded-full h-12 w-12 border-4 border-go-primary border-t-transparent mb-4"></div>
    <p class="text-gray-500">Cargando datos...</p>
  </div>

  <!-- Error state -->
  <div id="error" class="hidden flex flex-col items-center justify-center py-32">
    <p class="text-red-600 text-lg mb-4">No se pudieron cargar los datos. Verificá tu conexión.</p>
    <button onclick="loadAllData()" class="bg-go-primary text-white px-6 py-2 rounded-lg hover:bg-blue-900 transition">
      Reintentar
    </button>
  </div>

  <!-- Main content (5 sections, only one visible at a time) -->
  <main id="content" class="hidden max-w-7xl mx-auto px-4 py-6">
    <div id="section-home"></div>
    <div id="section-facturacion" class="hidden"></div>
    <div id="section-produccion" class="hidden"></div>
    <div id="section-proyeccion" class="hidden"></div>
    <div id="section-sponsors" class="hidden"></div>
  </main>

  <!-- Scripts -->
  <script src="js/auth.js"></script>
  <script src="js/data.js"></script>
  <script src="js/charts.js"></script>
  <script src="js/filters.js"></script>
  <script src="js/sections/home.js"></script>
  <script src="js/sections/facturacion.js"></script>
  <script src="js/sections/produccion.js"></script>
  <script src="js/sections/proyeccion.js"></script>
  <script src="js/sections/sponsors.js"></script>
  <script>
    if (!requireAuth()) throw new Error('Not authenticated');
    loadAllData();
  </script>
</body>
</html>
```

- [ ] **Step 2: Add tab and layout styles to `css/style.css`**

Append to `css/style.css`:

```css
/* Tabs */
.tab-btn {
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s, border-color 0.2s;
}

.tab-btn:hover {
  color: var(--go-primary);
}

.tab-btn.active {
  color: var(--go-primary);
  border-bottom-color: var(--go-primary);
  font-weight: 600;
}

/* KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.kpi-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.kpi-card .kpi-label {
  font-size: 0.8rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.kpi-card .kpi-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--go-primary);
}

.kpi-card .kpi-value.success { color: var(--go-success); }
.kpi-card .kpi-value.warning { color: var(--go-warning); }
.kpi-card .kpi-value.error { color: var(--go-error); }

/* Chart containers */
.chart-container {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  margin-bottom: 1.5rem;
}

.chart-container h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--go-text);
  margin-bottom: 1rem;
}

/* Tables */
.data-table-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.data-table thead {
  position: sticky;
  top: 0;
  background: #f9fafb;
  z-index: 1;
}

.data-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.data-table th:hover {
  background: #f3f4f6;
}

.data-table th .sort-arrow {
  margin-left: 4px;
  opacity: 0.3;
}

.data-table th.sorted .sort-arrow {
  opacity: 1;
}

.data-table td {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.data-table .row-highlight {
  background: #fef2f2;
}

.data-table .totals-row {
  font-weight: 700;
  background: #f0f9ff;
  border-top: 2px solid var(--go-primary);
}

/* Filters */
.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  align-items: end;
}

.filter-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  background: white;
  outline: none;
  min-width: 140px;
}

.filter-select:focus {
  border-color: var(--go-primary);
  box-shadow: 0 0 0 3px rgba(0,51,102,0.1);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
}

.pagination button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.8rem;
}

.pagination button.active {
  background: var(--go-primary);
  color: white;
  border-color: var(--go-primary);
}

/* Two-column layout for Sponsors section */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .two-col {
    grid-template-columns: 1fr;
  }
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

/* Search input */
.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  outline: none;
  width: 250px;
  max-width: 100%;
}

.search-input:focus {
  border-color: var(--go-primary);
  box-shadow: 0 0 0 3px rgba(0,51,102,0.1);
}
```

- [ ] **Step 3: Verify in browser**

Open `dashboard.html` (will redirect to login since no session). After login:
1. Header shows with blue GO background, logo, title, and logout button
2. 5 tabs visible below header, "Real vs Proyección" active
3. Loading spinner shows (data fetch will fail without URLs — expected)
4. Tabs are horizontally scrollable on mobile
5. Logout button works (redirects to login)

- [ ] **Step 4: Commit**

```bash
git add dashboard.html css/style.css
git commit -m "feat: add dashboard shell with header, tabs, and layout styles"
```

---

### Task 3: Data layer (fetch, parse, cache)

**Files:**
- Create: `js/data.js`

**Interfaces:**
- Consumes: PapaParse (global `Papa` from CDN)
- Produces: Global object `UIC_DATA` with properties `facturacion` (array of objects), `produccion` (array of objects), `proyeccion` (object mapping indicator names to {year: value} objects). Global function `loadAllData()` that fetches, parses, caches, and calls `initDashboard()` on success.

- [ ] **Step 1: Create `js/data.js`**

```js
// Google Sheets CSV URLs — replace GID with actual sheet GID after publishing
const SHEET_URLS = {
  // Format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=csv&gid=GID
  facturacion: 'PLACEHOLDER_FACTURACION_URL',
  produccion: 'PLACEHOLDER_PRODUCCION_URL',
  proyeccion: 'PLACEHOLDER_PROYECCION_URL'
};

const UIC_DATA = {
  facturacion: [],
  produccion: [],
  proyeccion: {},
  loaded: false
};

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeString(val) {
  if (!val) return '';
  return String(val).trim();
}

function parseFacturacion(results) {
  return results.data
    .filter(row => row['Protocolo'] && row['Protocolo'].trim())
    .map(row => ({
      centro: normalizeString(row['Centro']),
      protocolo: normalizeString(row['Protocolo']),
      visitas: parseNumber(row['Visitas']),
      moneda: normalizeString(row['Moneda']),
      honorarios: parseNumber(row['Honorarios']),
      overhead: parseNumber(row['Over Head']),
      total: parseNumber(row['Total']),
      promedioVisita: parseNumber(row['Promedio']),
      overheadPct: parseNumber(row['Over Head.1'] || row['Over Head_1']),
      goUic: parseNumber(row['Go UIC'] || row['GO UIC']),
      fase: normalizeString(row['Fase']),
      ip: normalizeString(row['IP']),
      especialidad: normalizeString(row['Especialidad']),
      tipo: normalizeString(row['Tipo']),
      fechaFact: normalizeString(row['Fecha Fact']),
      tipoFact: normalizeString(row['Tipo Fact']),
      numeroFact: normalizeString(row['Numero Fact']),
      mes: parseNumber(row['Mes']),
      anio: parseNumber(row['Año'] || row['Ano']),
      cobrado: normalizeString(row['Cobrado'])
    }));
}

function parseProduccion(results) {
  return results.data
    .filter(row => row['Protocolo'] && row['Protocolo'].trim())
    .map(row => ({
      protocolo: normalizeString(row['Protocolo']),
      visita: normalizeString(row['Visita']),
      screening: normalizeString(row['Screening']),
      paciente: normalizeString(row['Paciente']),
      tipoVisita: normalizeString(row['Tipo Visita']),
      asistencia: normalizeString(row['Asistencia']),
      atendido: normalizeString(row['Atendido']),
      cumplimientoTurno: normalizeString(row['Cumplimiento Turno']),
      responsable: normalizeString(row['Responsable Cumplimiento']),
      lugarTurno: normalizeString(row['Lugar Turno']),
      fechaTurno: normalizeString(row['Fecha del Turno']),
      horaTurno: normalizeString(row['Hora del Turno']),
      estadoHC: normalizeString(row['Estado HC']),
      firmante: normalizeString(row['Firmante']),
      fechaFirma: normalizeString(row['Fecha Firma']),
      publicada: normalizeString(row['Publicada']),
      monitoreada: normalizeString(row['Monitoreada']),
      patrocinador: normalizeString(row['Patrocinador']),
      cro: normalizeString(row['CRO']),
      ip: normalizeString(row['Investigador Principal']),
      tipoAtencion: normalizeString(row['Tipo de Atención'] || row['Tipo de Atencion']),
      fases: normalizeString(row['Fases']),
      especialidades: normalizeString(row['Especialidades']),
      mes: parseNumber(row['Mes']),
      anio: parseNumber(row['Año'] || row['Ano'])
    }));
}

function parseProyeccion(results) {
  const proy = {};
  const years = [];

  // Find the header row that contains year numbers (2026, 2027, ...)
  const headerRow = results.data.find(row => {
    const vals = Object.values(row);
    return vals.some(v => String(v).match(/^2026/));
  });

  if (!headerRow) return proy;

  // Extract year columns
  const keys = Object.keys(headerRow);
  keys.forEach(k => {
    const val = parseNumber(headerRow[k]);
    if (val >= 2026 && val <= 2035) {
      years.push({ key: k, year: val });
    }
  });

  // Find the indicator column (usually second column)
  const indicatorKey = keys.find(k => {
    const vals = results.data.map(r => normalizeString(r[k]));
    return vals.some(v => v.includes('Protocolos activos'));
  }) || keys[1];

  // Parse each indicator row
  const indicatorNames = [
    'Protocolos activos',
    'Visitas realizadas',
    'Visitas/protocolo',
    'Ticket promedio',
    'Facturación Total GO UIC',
    'OH Instituciones GO',
    'GO ACE',
    'Total Costos UIC',
    'EBITDA UIC',
    'Margen EBITDA',
    'EBITDA UIC acumulado',
    'Sueldo Gerenta',
    'Gastos operativos',
    'Incentivo Director'
  ];

  results.data.forEach(row => {
    const indicator = normalizeString(row[indicatorKey]);
    if (!indicator) return;

    const matchedName = indicatorNames.find(name =>
      indicator.toLowerCase().includes(name.toLowerCase())
    );
    if (!matchedName) return;

    const yearData = {};
    years.forEach(({ key, year }) => {
      yearData[year] = parseNumber(row[key]);
    });

    // Also grab TOTAL 10A if present
    const totalKey = keys.find(k =>
      normalizeString(headerRow[k]).toUpperCase().includes('TOTAL')
    );
    if (totalKey) {
      yearData.total = parseNumber(row[totalKey]);
    }

    proy[matchedName] = yearData;
  });

  return proy;
}

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject
    });
  });
}

async function loadAllData() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('error').classList.add('hidden');
  document.getElementById('content').classList.add('hidden');

  try {
    const [factResult, prodResult, proyResult] = await Promise.all([
      fetchCSV(SHEET_URLS.facturacion),
      fetchCSV(SHEET_URLS.produccion),
      fetchCSV(SHEET_URLS.proyeccion)
    ]);

    UIC_DATA.facturacion = parseFacturacion(factResult);
    UIC_DATA.produccion = parseProduccion(prodResult);
    UIC_DATA.proyeccion = parseProyeccion(proyResult);
    UIC_DATA.loaded = true;

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');

    initDashboard();
  } catch (err) {
    console.error('Error loading data:', err);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
  }
}
```

- [ ] **Step 2: Verify in browser console**

After data loads (requires real Google Sheets URLs — use test CSVs for now):
1. Open console, check `UIC_DATA.facturacion.length` > 0
2. Check `UIC_DATA.produccion.length` > 0
3. Check `Object.keys(UIC_DATA.proyeccion).length` > 0
4. Check a sample row: `UIC_DATA.facturacion[0].protocolo` is a non-empty string
5. Check number parsing: `UIC_DATA.facturacion[0].total` is a number, not a string

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "feat: add data layer with CSV fetch, parse, and cache"
```

---

### Task 4: Shared utilities (charts factory, filters, formatting)

**Files:**
- Create: `js/charts.js`
- Create: `js/filters.js`

**Interfaces:**
- Consumes: Chart.js (global `Chart` from CDN), `UIC_DATA` from `data.js`
- Produces:
  - `createBarChart(canvasId, labels, datasets, options)` → Chart instance
  - `createLineChart(canvasId, labels, datasets, options)` → Chart instance
  - `createDoughnutChart(canvasId, labels, data, options)` → Chart instance
  - `createComboChart(canvasId, labels, barDatasets, lineDatasets, options)` → Chart instance
  - `destroyChart(canvasId)` — destroys existing chart on a canvas before re-creating
  - `formatUSD(number)` → string like `"USD 729,966"`
  - `formatPct(number)` → string like `"42.4%"`
  - `formatNumber(number)` → string like `"1,234"`
  - `populateSelect(selectId, values, allLabel)` — fills a `<select>` with options
  - `getFilterValues(sectionId)` → object with current filter values
  - `switchSection(name)` — shows section, hides others, updates tab active state
  - `initDashboard()` — called after data loads, renders all sections

- [ ] **Step 1: Create `js/charts.js`**

```js
const GO_COLORS = {
  primary: '#003366',
  primaryLight: '#0059b3',
  secondary: '#00874e',
  gray: '#9ca3af',
  grayLight: 'rgba(156, 163, 175, 0.3)',
  palette: [
    '#003366', '#00874e', '#0059b3', '#f59e0b',
    '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899',
    '#84cc16', '#f97316'
  ]
};

const chartInstances = {};

function destroyChart(canvasId) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
}

function formatUSD(num) {
  if (num === null || num === undefined) return 'USD 0';
  return 'USD ' + Math.round(num).toLocaleString('en-US');
}

function formatPct(num) {
  if (num === null || num === undefined) return '0.0%';
  return (num * 100).toFixed(1) + '%';
}

function formatPctRaw(num) {
  if (num === null || num === undefined) return '0.0%';
  return num.toFixed(1) + '%';
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Math.round(num).toLocaleString('en-US');
}

const defaultTooltip = {
  backgroundColor: 'rgba(0,0,0,0.8)',
  titleFont: { family: 'Inter', size: 13 },
  bodyFont: { family: 'Inter', size: 12 },
  padding: 10,
  cornerRadius: 8
};

const defaultScales = {
  x: {
    grid: { display: false },
    ticks: { font: { family: 'Inter', size: 11 } }
  },
  y: {
    grid: { color: '#f3f4f6' },
    ticks: { font: { family: 'Inter', size: 11 } }
  }
};

function createBarChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: defaultTooltip,
        legend: { display: datasets.length > 1, labels: { font: { family: 'Inter' } } }
      },
      scales: {
        ...defaultScales,
        ...(options.horizontal ? {
          x: { ...defaultScales.y, beginAtZero: true },
          y: { ...defaultScales.x }
        } : {
          y: { ...defaultScales.y, beginAtZero: true }
        })
      },
      indexAxis: options.horizontal ? 'y' : 'x',
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createLineChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: defaultTooltip, legend: { labels: { font: { family: 'Inter' } } } },
      scales: { ...defaultScales, y: { ...defaultScales.y, beginAtZero: true } },
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createDoughnutChart(canvasId, labels, data, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: GO_COLORS.palette.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: defaultTooltip,
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, padding: 12 } }
      },
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createComboChart(canvasId, labels, barDatasets, lineDatasets, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const allDatasets = [
    ...barDatasets.map(ds => ({ ...ds, type: 'bar', yAxisID: 'y' })),
    ...lineDatasets.map(ds => ({ ...ds, type: 'line', yAxisID: 'y1', fill: false, tension: 0.3 }))
  ];
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: allDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: defaultTooltip, legend: { labels: { font: { family: 'Inter' } } } },
      scales: {
        x: defaultScales.x,
        y: { ...defaultScales.y, beginAtZero: true, position: 'left' },
        y1: {
          ...defaultScales.y,
          beginAtZero: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            callback: function(value) { return value.toFixed(0) + '%'; },
            font: { family: 'Inter', size: 11 }
          }
        }
      },
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}
```

- [ ] **Step 2: Create `js/filters.js`**

```js
function populateSelect(selectId, values, allLabel = 'Todos') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';

  if (allLabel) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = allLabel;
    select.appendChild(opt);
  }

  values.forEach(val => {
    if (!val) return;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  });
}

function uniqueValues(data, key) {
  const set = new Set(data.map(row => row[key]).filter(Boolean));
  return [...set].sort();
}

function filterByPeriod(data, anio, mes) {
  let filtered = data;
  if (anio) filtered = filtered.filter(r => r.anio === parseInt(anio));
  if (mes) filtered = filtered.filter(r => r.mes === parseInt(mes));
  return filtered;
}

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function monthName(num) {
  return MONTH_NAMES[num] || '';
}

function groupBy(data, key) {
  const groups = {};
  data.forEach(row => {
    const k = row[key] || '(vacío)';
    if (!groups[k]) groups[k] = [];
    groups[k].push(row);
  });
  return groups;
}

function sumBy(data, key) {
  return data.reduce((sum, row) => sum + (row[key] || 0), 0);
}

function countDistinct(data, key) {
  return new Set(data.map(r => r[key]).filter(Boolean)).size;
}

// Tab switching
function switchSection(name) {
  const sections = ['home', 'facturacion', 'produccion', 'proyeccion', 'sponsors'];
  sections.forEach(s => {
    const el = document.getElementById('section-' + s);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
}

// Table sorting
function makeSortable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const headers = table.querySelectorAll('th[data-sort]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr:not(.totals-row)'));
      const isNum = th.dataset.type === 'number';
      const currentDir = th.dataset.dir === 'asc' ? 'desc' : 'asc';

      headers.forEach(h => { h.dataset.dir = ''; h.classList.remove('sorted'); });
      th.dataset.dir = currentDir;
      th.classList.add('sorted');

      rows.sort((a, b) => {
        let aVal = a.querySelector(`td[data-col="${col}"]`)?.textContent || '';
        let bVal = b.querySelector(`td[data-col="${col}"]`)?.textContent || '';
        if (isNum) {
          aVal = parseFloat(aVal.replace(/[^0-9.\-]/g, '')) || 0;
          bVal = parseFloat(bVal.replace(/[^0-9.\-]/g, '')) || 0;
        }
        if (currentDir === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });

      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

// Pagination
function paginate(data, page, perPage = 20) {
  const start = (page - 1) * perPage;
  return {
    rows: data.slice(start, start + perPage),
    totalPages: Math.ceil(data.length / perPage),
    currentPage: page
  };
}

function renderPagination(containerId, totalPages, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = i === currentPage ? 'active' : '';
    btn.addEventListener('click', () => onPageChange(i));
    container.appendChild(btn);
  }
}

// Init dashboard — called after data loads
function initDashboard() {
  renderHome();
  renderFacturacion();
  renderProduccion();
  renderProyeccion();
  renderSponsors();
  switchSection('home');
}
```

- [ ] **Step 3: Verify in browser**

1. Check `formatUSD(729966)` returns `"USD 729,966"` in console
2. Check `formatPct(0.424)` returns `"42.4%"`
3. Check tab switching works (click each tab, verify content area changes)

- [ ] **Step 4: Commit**

```bash
git add js/charts.js js/filters.js
git commit -m "feat: add chart factory, filter utilities, and formatting helpers"
```

---

### Task 5: Section — Real vs Proyección (Home)

**Files:**
- Create: `js/sections/home.js`

**Interfaces:**
- Consumes: `UIC_DATA.facturacion`, `UIC_DATA.proyeccion`, all chart and filter utilities
- Produces: `renderHome()` — populates `#section-home` with filters, KPIs, and 2 charts

- [ ] **Step 1: Create `js/sections/home.js`**

```js
function renderHome() {
  const container = document.getElementById('section-home');
  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Año</label>
        <select id="home-anio" class="filter-select" onchange="updateHome()"></select>
      </div>
      <div class="filter-group">
        <label>Mes</label>
        <select id="home-mes" class="filter-select" onchange="updateHome()"></select>
      </div>
    </div>
    <div class="kpi-grid" id="home-kpis"></div>
    <div class="chart-container">
      <h3>Facturación Real vs Proyección</h3>
      <div style="height:350px"><canvas id="chart-home-bars"></canvas></div>
    </div>
    <div class="chart-container">
      <h3>Acumulado Real vs Proyección</h3>
      <div style="height:300px"><canvas id="chart-home-lines"></canvas></div>
    </div>
  `;

  // Populate year filter from available data + projection years
  const dataYears = uniqueValues(UIC_DATA.facturacion, 'anio').map(String);
  const projYears = Object.keys(UIC_DATA.proyeccion['Facturación Total GO UIC'] || {})
    .filter(k => k !== 'total');
  const allYears = [...new Set([...dataYears, ...projYears])].sort();
  populateSelect('home-anio', allYears, null);

  // Default to first year with real data
  if (dataYears.length > 0) {
    document.getElementById('home-anio').value = dataYears[0];
  }

  // Populate month filter
  const months = [
    { value: '', label: 'Todos (Anual)' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))
  ];
  const mesSelect = document.getElementById('home-mes');
  mesSelect.innerHTML = months.map(m =>
    `<option value="${m.value}">${m.label}</option>`
  ).join('');

  updateHome();
}

function updateHome() {
  const anio = document.getElementById('home-anio').value;
  const mes = document.getElementById('home-mes').value;
  const anioNum = parseInt(anio);

  // Real data filtered
  let realData = UIC_DATA.facturacion.filter(r => r.anio === anioNum);
  if (mes) realData = realData.filter(r => r.mes === parseInt(mes));
  const realTotal = sumBy(realData, 'total');

  // Projected
  const proyAnual = (UIC_DATA.proyeccion['Facturación Total GO UIC'] || {})[anioNum] || 0;
  const proyected = mes ? proyAnual / 12 : proyAnual;

  // KPIs
  const cumplimiento = proyected > 0 ? (realTotal / proyected) * 100 : 0;
  const desvio = realTotal - proyected;
  const cumplClass = cumplimiento >= 90 ? 'success' : cumplimiento >= 70 ? 'warning' : 'error';

  document.getElementById('home-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Facturado Real</div>
      <div class="kpi-value">${formatUSD(realTotal)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Proyectado</div>
      <div class="kpi-value">${formatUSD(proyected)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cumplimiento</div>
      <div class="kpi-value ${cumplClass}">${cumplimiento.toFixed(1)}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Desvío</div>
      <div class="kpi-value ${desvio >= 0 ? 'success' : 'error'}">
        ${desvio >= 0 ? '+' : ''}${formatUSD(desvio)}
      </div>
    </div>
  `;

  // Bar chart: real vs projection by month (if annual view) or single bar (if month view)
  if (!mes) {
    // Show by month for the selected year
    const byMonth = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = 0;
    realData.forEach(r => { if (r.mes) byMonth[r.mes] += r.total; });

    const labels = Object.keys(byMonth).map(m => monthName(parseInt(m)).substring(0, 3));
    const realValues = Object.values(byMonth);
    const projValues = Array(12).fill(proyAnual / 12);

    createBarChart('chart-home-bars', labels, [
      { label: 'Real', data: realValues, backgroundColor: GO_COLORS.primary },
      { label: 'Proyección', data: projValues, backgroundColor: GO_COLORS.grayLight, borderColor: GO_COLORS.gray, borderWidth: 1 }
    ]);

    // Accumulated line chart
    let realAcc = 0, projAcc = 0;
    const realAccData = realValues.map(v => realAcc += v);
    const projAccData = projValues.map(v => projAcc += v);

    createLineChart('chart-home-lines', labels, [
      { label: 'Real acumulado', data: realAccData, borderColor: GO_COLORS.primary, backgroundColor: 'rgba(0,51,102,0.1)', fill: true, tension: 0.3 },
      { label: 'Proyección acumulada', data: projAccData, borderColor: GO_COLORS.gray, borderDash: [5, 5], tension: 0.3 }
    ]);
  } else {
    // Single month: just show the two bars
    createBarChart('chart-home-bars', [monthName(parseInt(mes)) + ' ' + anio], [
      { label: 'Real', data: [realTotal], backgroundColor: GO_COLORS.primary },
      { label: 'Proyección', data: [proyected], backgroundColor: GO_COLORS.grayLight, borderColor: GO_COLORS.gray, borderWidth: 1 }
    ]);

    // For single month, show YTD accumulated
    const ytdReal = UIC_DATA.facturacion
      .filter(r => r.anio === anioNum && r.mes <= parseInt(mes))
      .reduce((s, r) => s + r.total, 0);
    const ytdProj = (proyAnual / 12) * parseInt(mes);

    const monthLabels = [];
    const realAccData = [];
    const projAccData = [];
    let rAcc = 0, pAcc = 0;
    for (let m = 1; m <= parseInt(mes); m++) {
      monthLabels.push(monthName(m).substring(0, 3));
      rAcc += UIC_DATA.facturacion.filter(r => r.anio === anioNum && r.mes === m).reduce((s, r) => s + r.total, 0);
      pAcc += proyAnual / 12;
      realAccData.push(rAcc);
      projAccData.push(pAcc);
    }

    createLineChart('chart-home-lines', monthLabels, [
      { label: 'Real acumulado', data: realAccData, borderColor: GO_COLORS.primary, backgroundColor: 'rgba(0,51,102,0.1)', fill: true, tension: 0.3 },
      { label: 'Proyección acumulada', data: projAccData, borderColor: GO_COLORS.gray, borderDash: [5, 5], tension: 0.3 }
    ]);
  }
}
```

- [ ] **Step 2: Verify in browser**

1. Home tab shows 4 KPI cards with values
2. Year/month filters change the data
3. Bar chart shows real vs projection side by side
4. Line chart shows accumulated comparison
5. Semaphore colors work (green/yellow/red on cumplimiento)

- [ ] **Step 3: Commit**

```bash
git add js/sections/home.js
git commit -m "feat: add Home section — Real vs Proyección with KPIs and charts"
```

---

### Task 6: Section — Facturación

**Files:**
- Create: `js/sections/facturacion.js`

**Interfaces:**
- Consumes: `UIC_DATA.facturacion`, all chart/filter utilities
- Produces: `renderFacturacion()` — populates `#section-facturacion`

- [ ] **Step 1: Create `js/sections/facturacion.js`**

```js
function renderFacturacion() {
  const container = document.getElementById('section-facturacion');
  const ips = uniqueValues(UIC_DATA.facturacion, 'ip');
  const protocolos = uniqueValues(UIC_DATA.facturacion, 'protocolo');
  const anios = uniqueValues(UIC_DATA.facturacion, 'anio').map(String);

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Año</label>
        <select id="fact-anio" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
      <div class="filter-group">
        <label>Mes</label>
        <select id="fact-mes" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
      <div class="filter-group">
        <label>Investigador Principal</label>
        <select id="fact-ip" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
      <div class="filter-group">
        <label>Protocolo</label>
        <select id="fact-proto" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
    </div>
    <div class="kpi-grid" id="fact-kpis"></div>
    <div class="data-table-wrapper">
      <table class="data-table" id="fact-table">
        <thead>
          <tr>
            <th data-sort="protocolo">Protocolo <span class="sort-arrow">↕</span></th>
            <th data-sort="fase">Fase <span class="sort-arrow">↕</span></th>
            <th data-sort="ip">IP <span class="sort-arrow">↕</span></th>
            <th data-sort="visitas" data-type="number">Visitas <span class="sort-arrow">↕</span></th>
            <th data-sort="honorarios" data-type="number">Honorarios <span class="sort-arrow">↕</span></th>
            <th data-sort="overhead" data-type="number">Over Head <span class="sort-arrow">↕</span></th>
            <th data-sort="total" data-type="number">Total USD <span class="sort-arrow">↕</span></th>
            <th data-sort="cobrado">Cobrado <span class="sort-arrow">↕</span></th>
          </tr>
        </thead>
        <tbody id="fact-tbody"></tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="chart-container">
        <h3>Facturación por IP</h3>
        <div style="height:300px"><canvas id="chart-fact-ip"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Top 10 Protocolos</h3>
        <div style="height:300px"><canvas id="chart-fact-proto"></canvas></div>
      </div>
    </div>
    <div class="chart-container">
      <h3>Evolución Mensual</h3>
      <div style="height:300px"><canvas id="chart-fact-monthly"></canvas></div>
    </div>
  `;

  populateSelect('fact-anio', anios);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }));
  const mesSelect = document.getElementById('fact-mes');
  mesSelect.innerHTML = '<option value="">Todos</option>' +
    months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  populateSelect('fact-ip', ips);
  populateSelect('fact-proto', protocolos);

  makeSortable('fact-table');
  updateFacturacion();
}

function updateFacturacion() {
  const anio = document.getElementById('fact-anio').value;
  const mes = document.getElementById('fact-mes').value;
  const ip = document.getElementById('fact-ip').value;
  const proto = document.getElementById('fact-proto').value;

  let data = UIC_DATA.facturacion;
  if (anio) data = data.filter(r => r.anio === parseInt(anio));
  if (mes) data = data.filter(r => r.mes === parseInt(mes));
  if (ip) data = data.filter(r => r.ip === ip);
  if (proto) data = data.filter(r => r.protocolo === proto);

  // KPIs
  const totalFact = sumBy(data, 'total');
  const totalHon = sumBy(data, 'honorarios');
  const totalGoUic = sumBy(data, 'goUic');

  document.getElementById('fact-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total Facturado</div>
      <div class="kpi-value">${formatUSD(totalFact)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Honorarios</div>
      <div class="kpi-value">${formatUSD(totalHon)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">GO UIC</div>
      <div class="kpi-value">${formatUSD(totalGoUic)}</div>
    </div>
  `;

  // Table
  const tbody = document.getElementById('fact-tbody');
  const cobradoNormalize = (val) => {
    const v = val.toLowerCase().trim();
    return v === 'sí' || v === 'si' || v === 'yes';
  };

  tbody.innerHTML = data.map(r => {
    const isCobrado = cobradoNormalize(r.cobrado);
    return `<tr class="${!isCobrado ? 'row-highlight' : ''}">
      <td data-col="protocolo">${r.protocolo}</td>
      <td data-col="fase">${r.fase}</td>
      <td data-col="ip">${r.ip}</td>
      <td data-col="visitas">${formatNumber(r.visitas)}</td>
      <td data-col="honorarios">${formatUSD(r.honorarios)}</td>
      <td data-col="overhead">${formatUSD(r.overhead)}</td>
      <td data-col="total">${formatUSD(r.total)}</td>
      <td data-col="cobrado">${r.cobrado || 'No'}</td>
    </tr>`;
  }).join('') + `<tr class="totals-row">
    <td colspan="3"><strong>TOTAL</strong></td>
    <td>${formatNumber(sumBy(data, 'visitas'))}</td>
    <td>${formatUSD(totalHon)}</td>
    <td>${formatUSD(sumBy(data, 'overhead'))}</td>
    <td>${formatUSD(totalFact)}</td>
    <td></td>
  </tr>`;

  // Chart: by IP
  const byIp = groupBy(data, 'ip');
  const ipLabels = Object.keys(byIp).sort((a, b) => sumBy(byIp[b], 'total') - sumBy(byIp[a], 'total'));
  const ipValues = ipLabels.map(k => sumBy(byIp[k], 'total'));
  createBarChart('chart-fact-ip', ipLabels, [{
    label: 'Facturación USD', data: ipValues, backgroundColor: GO_COLORS.primary
  }], { horizontal: true });

  // Chart: top 10 protocols
  const byProto = groupBy(data, 'protocolo');
  const protoEntries = Object.entries(byProto)
    .map(([k, v]) => ({ name: k, total: sumBy(v, 'total') }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  createBarChart('chart-fact-proto', protoEntries.map(e => e.name), [{
    label: 'Total USD', data: protoEntries.map(e => e.total), backgroundColor: GO_COLORS.secondary
  }]);

  // Chart: monthly evolution
  const byMonth = groupBy(data, 'mes');
  const monthKeys = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
  createLineChart('chart-fact-monthly',
    monthKeys.map(m => monthName(m).substring(0, 3)),
    [{
      label: 'Facturación USD',
      data: monthKeys.map(m => sumBy(byMonth[m], 'total')),
      borderColor: GO_COLORS.primary,
      backgroundColor: 'rgba(0,51,102,0.1)',
      fill: true,
      tension: 0.3
    }]
  );
}
```

- [ ] **Step 2: Verify in browser**

1. Facturación tab shows 4 filters, 3 KPI cards
2. Table shows all rows, sorted by click on headers
3. Rows without Cobrado highlighted in red
4. Totals row at bottom
5. 3 charts render correctly
6. Filters re-render everything

- [ ] **Step 3: Commit**

```bash
git add js/sections/facturacion.js
git commit -m "feat: add Facturación section with table, KPIs, and charts"
```

---

### Task 7: Section — Producción

**Files:**
- Create: `js/sections/produccion.js`

**Interfaces:**
- Consumes: `UIC_DATA.produccion`, all chart/filter utilities, `paginate()`, `renderPagination()`
- Produces: `renderProduccion()` — populates `#section-produccion`

- [ ] **Step 1: Create `js/sections/produccion.js`**

```js
let produccionPage = 1;
let produccionFiltered = [];

function renderProduccion() {
  const container = document.getElementById('section-produccion');
  const protocolos = uniqueValues(UIC_DATA.produccion, 'protocolo');
  const ips = uniqueValues(UIC_DATA.produccion, 'ip');
  const anios = uniqueValues(UIC_DATA.produccion, 'anio').map(String);

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Año</label>
        <select id="prod-anio" class="filter-select" onchange="updateProduccion()"></select>
      </div>
      <div class="filter-group">
        <label>Mes</label>
        <select id="prod-mes" class="filter-select" onchange="updateProduccion()"></select>
      </div>
      <div class="filter-group">
        <label>Protocolo</label>
        <select id="prod-proto" class="filter-select" onchange="updateProduccion()"></select>
      </div>
      <div class="filter-group">
        <label>Investigador Principal</label>
        <select id="prod-ip" class="filter-select" onchange="updateProduccion()"></select>
      </div>
      <div class="filter-group">
        <label>Buscar</label>
        <input type="text" id="prod-search" class="search-input" placeholder="Paciente o protocolo..." oninput="updateProduccion()">
      </div>
    </div>
    <div class="kpi-grid" id="prod-kpis"></div>
    <div class="data-table-wrapper">
      <table class="data-table" id="prod-table">
        <thead>
          <tr>
            <th data-sort="protocolo">Protocolo <span class="sort-arrow">↕</span></th>
            <th data-sort="visita">Visita <span class="sort-arrow">↕</span></th>
            <th data-sort="paciente">Paciente <span class="sort-arrow">↕</span></th>
            <th data-sort="tipoVisita">Tipo Visita <span class="sort-arrow">↕</span></th>
            <th data-sort="asistencia">Asistencia <span class="sort-arrow">↕</span></th>
            <th data-sort="lugarTurno">Lugar <span class="sort-arrow">↕</span></th>
            <th data-sort="fechaTurno">Fecha <span class="sort-arrow">↕</span></th>
            <th data-sort="ip">IP <span class="sort-arrow">↕</span></th>
          </tr>
        </thead>
        <tbody id="prod-tbody"></tbody>
      </table>
      <div class="pagination" id="prod-pagination"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="chart-container">
        <h3>Visitas por Mes</h3>
        <div style="height:300px"><canvas id="chart-prod-monthly"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Tipo de Atención</h3>
        <div style="height:300px"><canvas id="chart-prod-tipo"></canvas></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="chart-container">
        <h3>Top 10 Responsables</h3>
        <div style="height:300px"><canvas id="chart-prod-resp"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Top 10 Firmantes</h3>
        <div style="height:300px"><canvas id="chart-prod-firm"></canvas></div>
      </div>
    </div>
  `;

  populateSelect('prod-anio', anios);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }));
  document.getElementById('prod-mes').innerHTML = '<option value="">Todos</option>' +
    months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  populateSelect('prod-proto', protocolos);
  populateSelect('prod-ip', ips);

  makeSortable('prod-table');
  produccionPage = 1;
  updateProduccion();
}

function updateProduccion() {
  const anio = document.getElementById('prod-anio').value;
  const mes = document.getElementById('prod-mes').value;
  const proto = document.getElementById('prod-proto').value;
  const ip = document.getElementById('prod-ip').value;
  const search = (document.getElementById('prod-search').value || '').toLowerCase();

  let data = UIC_DATA.produccion;
  if (anio) data = data.filter(r => r.anio === parseInt(anio));
  if (mes) data = data.filter(r => r.mes === parseInt(mes));
  if (proto) data = data.filter(r => r.protocolo === proto);
  if (ip) data = data.filter(r => r.ip === ip);
  if (search) data = data.filter(r =>
    r.paciente.toLowerCase().includes(search) ||
    r.protocolo.toLowerCase().includes(search)
  );

  produccionFiltered = data;

  // KPIs
  const totalVisitas = data.length;
  const pacientesUnicos = countDistinct(data, 'paciente');
  const cumplidos = data.filter(r =>
    r.cumplimientoTurno.toLowerCase() === 'sí' || r.cumplimientoTurno.toLowerCase() === 'si'
  ).length;
  const tasaCumpl = totalVisitas > 0 ? (cumplidos / totalVisitas) * 100 : 0;
  const mesesUnicos = new Set(data.map(r => `${r.anio}-${r.mes}`)).size;
  const visitasMes = mesesUnicos > 0 ? totalVisitas / mesesUnicos : totalVisitas;

  document.getElementById('prod-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Visitas Realizadas</div>
      <div class="kpi-value">${formatNumber(totalVisitas)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Pacientes Únicos</div>
      <div class="kpi-value">${formatNumber(pacientesUnicos)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Tasa de Cumplimiento</div>
      <div class="kpi-value">${tasaCumpl.toFixed(1)}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Visitas/Mes Promedio</div>
      <div class="kpi-value">${formatNumber(visitasMes)}</div>
    </div>
  `;

  // Paginated table
  renderProduccionPage(1);

  // Charts
  const byMonth = groupBy(data, 'mes');
  const monthKeys = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
  createBarChart('chart-prod-monthly',
    monthKeys.map(m => monthName(m).substring(0, 3)),
    [{ label: 'Visitas', data: monthKeys.map(m => byMonth[m].length), backgroundColor: GO_COLORS.primary }]
  );

  const byTipo = groupBy(data, 'tipoAtencion');
  const tipoLabels = Object.keys(byTipo);
  createDoughnutChart('chart-prod-tipo', tipoLabels, tipoLabels.map(t => byTipo[t].length));

  // Top 10 responsables
  const byResp = groupBy(data, 'responsable');
  const respEntries = Object.entries(byResp)
    .map(([k, v]) => ({ name: k, count: v.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  createBarChart('chart-prod-resp',
    respEntries.map(e => e.name),
    [{ label: 'Visitas', data: respEntries.map(e => e.count), backgroundColor: GO_COLORS.secondary }],
    { horizontal: true }
  );

  // Top 10 firmantes
  const byFirm = groupBy(data, 'firmante');
  const firmEntries = Object.entries(byFirm)
    .map(([k, v]) => ({ name: k, count: v.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  createBarChart('chart-prod-firm',
    firmEntries.map(e => e.name),
    [{ label: 'Visitas', data: firmEntries.map(e => e.count), backgroundColor: GO_COLORS.primaryLight }],
    { horizontal: true }
  );
}

function renderProduccionPage(page) {
  produccionPage = page;
  const { rows, totalPages, currentPage } = paginate(produccionFiltered, page, 20);

  document.getElementById('prod-tbody').innerHTML = rows.map(r =>
    `<tr>
      <td data-col="protocolo">${r.protocolo}</td>
      <td data-col="visita">${r.visita}</td>
      <td data-col="paciente">${r.paciente}</td>
      <td data-col="tipoVisita">${r.tipoVisita}</td>
      <td data-col="asistencia">${r.asistencia}</td>
      <td data-col="lugarTurno">${r.lugarTurno}</td>
      <td data-col="fechaTurno">${r.fechaTurno}</td>
      <td data-col="ip">${r.ip}</td>
    </tr>`
  ).join('');

  renderPagination('prod-pagination', totalPages, currentPage, renderProduccionPage);
}
```

- [ ] **Step 2: Verify in browser**

1. 4 KPI cards with correct counts
2. Table paginates at 20 rows
3. Search filters in real time
4. 4 charts render (monthly bars, donut, responsables, firmantes)
5. Pagination buttons work

- [ ] **Step 3: Commit**

```bash
git add js/sections/produccion.js
git commit -m "feat: add Producción section with paginated table and 4 charts"
```

---

### Task 8: Section — Proyección financiera

**Files:**
- Create: `js/sections/proyeccion.js`

**Interfaces:**
- Consumes: `UIC_DATA.proyeccion`, chart utilities
- Produces: `renderProyeccion()` — populates `#section-proyeccion`

- [ ] **Step 1: Create `js/sections/proyeccion.js`**

```js
function renderProyeccion() {
  const container = document.getElementById('section-proyeccion');
  const years = Object.keys(UIC_DATA.proyeccion['Facturación Total GO UIC'] || {})
    .filter(k => k !== 'total')
    .map(Number)
    .sort();

  const minYear = years[0] || 2026;
  const maxYear = years[years.length - 1] || 2035;

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Desde</label>
        <select id="proy-desde" class="filter-select" onchange="updateProyeccion()">
          ${years.map(y => `<option value="${y}" ${y === minYear ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Hasta</label>
        <select id="proy-hasta" class="filter-select" onchange="updateProyeccion()">
          ${years.map(y => `<option value="${y}" ${y === maxYear ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="kpi-grid" id="proy-kpis"></div>
    <div class="chart-container">
      <h3>Ingresos vs Costos</h3>
      <div style="height:350px"><canvas id="chart-proy-stacked"></canvas></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="chart-container">
        <h3>EBITDA y Margen</h3>
        <div style="height:300px"><canvas id="chart-proy-ebitda"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Crecimiento de Protocolos</h3>
        <div style="height:300px"><canvas id="chart-proy-protocols"></canvas></div>
      </div>
    </div>
    <div class="data-table-wrapper">
      <table class="data-table" id="proy-table">
        <thead>
          <tr>
            <th>Año</th>
            <th>Protocolos</th>
            <th>Visitas</th>
            <th>Facturación</th>
            <th>OH GO</th>
            <th>Costos UIC</th>
            <th>EBITDA</th>
            <th>Margen %</th>
          </tr>
        </thead>
        <tbody id="proy-tbody"></tbody>
      </table>
    </div>
  `;

  updateProyeccion();
}

function updateProyeccion() {
  const desde = parseInt(document.getElementById('proy-desde').value);
  const hasta = parseInt(document.getElementById('proy-hasta').value);
  const proy = UIC_DATA.proyeccion;

  const getVal = (indicator, year) => (proy[indicator] || {})[year] || 0;

  const years = [];
  for (let y = desde; y <= hasta; y++) years.push(y);

  // KPIs
  const totalFact = years.reduce((s, y) => s + getVal('Facturación Total GO UIC', y), 0);
  const lastEbitdaAcc = getVal('EBITDA UIC acumulado', hasta);
  const lastProtocols = getVal('Protocolos activos', hasta);
  const firstMargin = getVal('Margen EBITDA', desde);
  const lastMargin = getVal('Margen EBITDA', hasta);

  document.getElementById('proy-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Facturación Total</div>
      <div class="kpi-value">${formatUSD(totalFact)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">EBITDA UIC Acumulado</div>
      <div class="kpi-value">${formatUSD(lastEbitdaAcc)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Protocolos (${hasta})</div>
      <div class="kpi-value">${formatNumber(lastProtocols)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Margen EBITDA</div>
      <div class="kpi-value">${formatPctRaw(firstMargin * 100)} → ${formatPctRaw(lastMargin * 100)}</div>
    </div>
  `;

  // Stacked bar chart: OH + GO ACE + Costos + EBITDA = Facturación
  const ohData = years.map(y => getVal('OH Instituciones GO', y));
  const aceData = years.map(y => getVal('GO ACE', y));
  const costosData = years.map(y => getVal('Total Costos UIC', y));
  const ebitdaData = years.map(y => getVal('EBITDA UIC', y));

  destroyChart('chart-proy-stacked');
  const ctxStacked = document.getElementById('chart-proy-stacked').getContext('2d');
  chartInstances['chart-proy-stacked'] = new Chart(ctxStacked, {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [
        { label: 'OH Instituciones GO', data: ohData, backgroundColor: '#94a3b8' },
        { label: 'GO ACE UIC', data: aceData, backgroundColor: '#64748b' },
        { label: 'Costos UIC', data: costosData, backgroundColor: GO_COLORS.warning },
        { label: 'EBITDA UIC', data: ebitdaData, backgroundColor: GO_COLORS.secondary }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: defaultTooltip, legend: { labels: { font: { family: 'Inter' } } } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } },
        y: { stacked: true, grid: { color: '#f3f4f6' }, beginAtZero: true, ticks: { font: { family: 'Inter', size: 11 } } }
      }
    }
  });

  // EBITDA + Margin combo chart
  const marginData = years.map(y => getVal('Margen EBITDA', y) * 100);
  createComboChart('chart-proy-ebitda', years.map(String),
    [{ label: 'EBITDA USD', data: ebitdaData, backgroundColor: GO_COLORS.primary }],
    [{ label: 'Margen %', data: marginData, borderColor: GO_COLORS.secondary, pointBackgroundColor: GO_COLORS.secondary }]
  );

  // Protocols growth line
  const protocolData = years.map(y => getVal('Protocolos activos', y));
  createLineChart('chart-proy-protocols', years.map(String), [{
    label: 'Protocolos activos',
    data: protocolData,
    borderColor: GO_COLORS.primary,
    backgroundColor: 'rgba(0,51,102,0.1)',
    fill: true,
    tension: 0.3
  }]);

  // Table
  const tbody = document.getElementById('proy-tbody');
  let totals = { protocolos: 0, visitas: 0, fact: 0, oh: 0, costos: 0, ebitda: 0 };

  tbody.innerHTML = years.map(y => {
    const protocolos = getVal('Protocolos activos', y);
    const visitas = getVal('Visitas realizadas', y);
    const fact = getVal('Facturación Total GO UIC', y);
    const oh = getVal('OH Instituciones GO', y) + getVal('GO ACE', y);
    const costos = getVal('Total Costos UIC', y);
    const ebitda = getVal('EBITDA UIC', y);
    const margin = getVal('Margen EBITDA', y);

    totals.protocolos = protocolos; // last value
    totals.visitas += visitas;
    totals.fact += fact;
    totals.oh += oh;
    totals.costos += costos;
    totals.ebitda += ebitda;

    return `<tr>
      <td>${y}</td>
      <td>${formatNumber(protocolos)}</td>
      <td>${formatNumber(visitas)}</td>
      <td>${formatUSD(fact)}</td>
      <td>${formatUSD(oh)}</td>
      <td>${formatUSD(costos)}</td>
      <td>${formatUSD(ebitda)}</td>
      <td>${formatPctRaw(margin * 100)}</td>
    </tr>`;
  }).join('') + `<tr class="totals-row">
    <td><strong>TOTAL</strong></td>
    <td>${formatNumber(totals.protocolos)}</td>
    <td>${formatNumber(totals.visitas)}</td>
    <td>${formatUSD(totals.fact)}</td>
    <td>${formatUSD(totals.oh)}</td>
    <td>${formatUSD(totals.costos)}</td>
    <td>${formatUSD(totals.ebitda)}</td>
    <td></td>
  </tr>`;
}
```

- [ ] **Step 2: Verify in browser**

1. Year range filters work (desde/hasta)
2. 4 KPI cards with correct projection values
3. Stacked bar chart shows the 4 cost/income layers
4. Combo chart shows EBITDA bars + margin line
5. Protocol growth line goes from ~25 to ~114
6. Table has 10 rows (2026-2035) + totals

- [ ] **Step 3: Commit**

```bash
git add js/sections/proyeccion.js
git commit -m "feat: add Proyección financiera section with 3 charts and summary table"
```

---

### Task 9: Section — Patrocinadores y CROs

**Files:**
- Create: `js/sections/sponsors.js`

**Interfaces:**
- Consumes: `UIC_DATA.facturacion`, `UIC_DATA.produccion`, chart/filter utilities
- Produces: `renderSponsors()` — populates `#section-sponsors`

- [ ] **Step 1: Create `js/sections/sponsors.js`**

```js
function renderSponsors() {
  const container = document.getElementById('section-sponsors');
  const anios = uniqueValues(UIC_DATA.produccion, 'anio').map(String);
  const patrocinadores = uniqueValues(UIC_DATA.produccion, 'patrocinador');
  const cros = uniqueValues(UIC_DATA.produccion, 'cro');

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Año</label>
        <select id="sp-anio" class="filter-select" onchange="updateSponsors()"></select>
      </div>
      <div class="filter-group">
        <label>Mes</label>
        <select id="sp-mes" class="filter-select" onchange="updateSponsors()"></select>
      </div>
      <div class="filter-group">
        <label>Patrocinador</label>
        <select id="sp-patron" class="filter-select" onchange="updateSponsors()"></select>
      </div>
      <div class="filter-group">
        <label>CRO</label>
        <select id="sp-cro" class="filter-select" onchange="updateSponsors()"></select>
      </div>
    </div>
    <div class="two-col">
      <!-- Left: Patrocinadores -->
      <div>
        <div class="chart-container">
          <h3>Facturación por Patrocinador</h3>
          <div style="height:280px"><canvas id="chart-sp-patron-fact"></canvas></div>
        </div>
        <div class="chart-container">
          <h3>Visitas por Patrocinador</h3>
          <div style="height:280px"><canvas id="chart-sp-patron-vis"></canvas></div>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Patrocinador</th>
                <th>Protocolos</th>
                <th>Visitas</th>
                <th>Facturación USD</th>
              </tr>
            </thead>
            <tbody id="sp-patron-tbody"></tbody>
          </table>
        </div>
      </div>
      <!-- Right: CROs -->
      <div>
        <div class="chart-container">
          <h3>Protocolos por CRO</h3>
          <div style="height:280px"><canvas id="chart-sp-cro-donut"></canvas></div>
        </div>
        <div class="chart-container">
          <h3>Visitas por CRO</h3>
          <div style="height:280px"><canvas id="chart-sp-cro-vis"></canvas></div>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>CRO</th>
                <th>Protocolos</th>
                <th>Patrocinadores</th>
                <th>Visitas</th>
                <th>Facturación USD</th>
              </tr>
            </thead>
            <tbody id="sp-cro-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  populateSelect('sp-anio', anios);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }));
  document.getElementById('sp-mes').innerHTML = '<option value="">Todos</option>' +
    months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  populateSelect('sp-patron', patrocinadores);
  populateSelect('sp-cro', cros);

  updateSponsors();
}

function updateSponsors() {
  const anio = document.getElementById('sp-anio').value;
  const mes = document.getElementById('sp-mes').value;
  const patron = document.getElementById('sp-patron').value;
  const cro = document.getElementById('sp-cro').value;

  // Filter production data
  let prodData = UIC_DATA.produccion;
  if (anio) prodData = prodData.filter(r => r.anio === parseInt(anio));
  if (mes) prodData = prodData.filter(r => r.mes === parseInt(mes));
  if (patron) prodData = prodData.filter(r => r.patrocinador === patron);
  if (cro) prodData = prodData.filter(r => r.cro === cro);

  // Build protocol→facturacion lookup
  const factByProto = {};
  let factData = UIC_DATA.facturacion;
  if (anio) factData = factData.filter(r => r.anio === parseInt(anio));
  if (mes) factData = factData.filter(r => r.mes === parseInt(mes));
  factData.forEach(r => {
    if (!factByProto[r.protocolo]) factByProto[r.protocolo] = 0;
    factByProto[r.protocolo] += r.total;
  });

  // --- Patrocinadores ---
  const byPatron = groupBy(prodData, 'patrocinador');
  const patronStats = Object.entries(byPatron).map(([name, rows]) => {
    const protos = new Set(rows.map(r => r.protocolo));
    const fact = [...protos].reduce((s, p) => s + (factByProto[p] || 0), 0);
    return { name, protocolos: protos.size, visitas: rows.length, facturacion: fact };
  }).sort((a, b) => b.facturacion - a.facturacion);

  // Patron charts
  createBarChart('chart-sp-patron-fact',
    patronStats.map(s => s.name),
    [{ label: 'USD', data: patronStats.map(s => s.facturacion), backgroundColor: GO_COLORS.primary }],
    { horizontal: true }
  );
  createBarChart('chart-sp-patron-vis',
    patronStats.map(s => s.name),
    [{ label: 'Visitas', data: patronStats.map(s => s.visitas), backgroundColor: GO_COLORS.secondary }],
    { horizontal: true }
  );

  // Patron table
  document.getElementById('sp-patron-tbody').innerHTML = patronStats.map(s =>
    `<tr>
      <td>${s.name}</td>
      <td>${s.protocolos}</td>
      <td>${formatNumber(s.visitas)}</td>
      <td>${formatUSD(s.facturacion)}</td>
    </tr>`
  ).join('') + `<tr class="totals-row">
    <td><strong>TOTAL</strong></td>
    <td>${patronStats.reduce((s, r) => s + r.protocolos, 0)}</td>
    <td>${formatNumber(patronStats.reduce((s, r) => s + r.visitas, 0))}</td>
    <td>${formatUSD(patronStats.reduce((s, r) => s + r.facturacion, 0))}</td>
  </tr>`;

  // --- CROs ---
  const byCro = groupBy(prodData, 'cro');
  const croStats = Object.entries(byCro).map(([name, rows]) => {
    const protos = new Set(rows.map(r => r.protocolo));
    const patrons = new Set(rows.map(r => r.patrocinador));
    const fact = [...protos].reduce((s, p) => s + (factByProto[p] || 0), 0);
    return { name, protocolos: protos.size, patrocinadores: patrons.size, visitas: rows.length, facturacion: fact };
  }).sort((a, b) => b.facturacion - a.facturacion);

  // CRO donut (by protocols)
  createDoughnutChart('chart-sp-cro-donut',
    croStats.map(s => s.name),
    croStats.map(s => s.protocolos)
  );
  createBarChart('chart-sp-cro-vis',
    croStats.map(s => s.name),
    [{ label: 'Visitas', data: croStats.map(s => s.visitas), backgroundColor: GO_COLORS.primaryLight }],
    { horizontal: true }
  );

  // CRO table
  document.getElementById('sp-cro-tbody').innerHTML = croStats.map(s =>
    `<tr>
      <td>${s.name}</td>
      <td>${s.protocolos}</td>
      <td>${s.patrocinadores}</td>
      <td>${formatNumber(s.visitas)}</td>
      <td>${formatUSD(s.facturacion)}</td>
    </tr>`
  ).join('') + `<tr class="totals-row">
    <td><strong>TOTAL</strong></td>
    <td>${croStats.reduce((s, r) => s + r.protocolos, 0)}</td>
    <td>${croStats.reduce((s, r) => s + r.patrocinadores, 0)}</td>
    <td>${formatNumber(croStats.reduce((s, r) => s + r.visitas, 0))}</td>
    <td>${formatUSD(croStats.reduce((s, r) => s + r.facturacion, 0))}</td>
  </tr>`;
}
```

- [ ] **Step 2: Verify in browser**

1. Two-column layout renders (patrocinadores left, CROs right)
2. Filters work across both columns
3. Charts match table data
4. Join by protocolo produces correct facturacion per sponsor
5. CRO donut shows distribution
6. On mobile, columns stack vertically

- [ ] **Step 3: Commit**

```bash
git add js/sections/sponsors.js
git commit -m "feat: add Patrocinadores y CROs section with dual-column layout"
```

---

### Task 10: Integration, Google Sheets URLs, and final verification

**Files:**
- Modify: `js/data.js` (replace placeholder URLs)
- Modify: `js/auth.js` (set real password hash)

**Interfaces:**
- Consumes: all previous tasks
- Produces: fully working dashboard

- [ ] **Step 1: Set up Google Sheets CSV URLs**

After the user publishes the Google Sheet (Archivo → Compartir → Publicar en la web → CSV, one URL per tab), replace the placeholders in `js/data.js`:

```js
const SHEET_URLS = {
  facturacion: 'https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=FACTURACION_GID',
  produccion: 'https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=PRODUCCION_GID',
  proyeccion: 'https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=PROYECCION_GID'
};
```

- [ ] **Step 2: Set the password hash**

Generate the SHA-256 hash for the chosen password. In the browser console:

```js
async function genHash(pw) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
genHash('YOUR_PASSWORD').then(console.log);
```

Paste the resulting hash into `js/auth.js` replacing `PLACEHOLDER_HASH_HERE`.

- [ ] **Step 3: Full end-to-end verification**

Open `index.html` in browser. Check every flow:
1. Login with wrong password → error shown
2. Login with right password → redirected to dashboard
3. Home tab: KPIs, bar chart, line chart, filters work
4. Facturación tab: filters, table sorting, cobrado highlighting, 3 charts
5. Producción tab: search, pagination, 4 charts, KPIs
6. Proyección tab: year range filter, stacked chart, combo chart, protocol line, table
7. Patrocinadores tab: two-column layout, all charts and tables, filters
8. Logout → back to login
9. Direct URL to dashboard.html without login → redirected to login
10. Mobile responsive: resize browser, verify cards stack and tables scroll

- [ ] **Step 4: Add logo**

Request or obtain the Grupo Oroño logo. Save as `assets/logo-go.png`. Verify it shows in the login page and dashboard header.

- [ ] **Step 5: Deploy to GitHub Pages**

```bash
git add -A
git commit -m "feat: complete UIC dashboard with all 5 sections"
```

Enable GitHub Pages on the repository (Settings → Pages → Source: main branch, root folder).

- [ ] **Step 6: Final commit with deployed URL**

Verify the live URL works. Share with the user.
