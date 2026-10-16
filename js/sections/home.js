const PERIOD_START = { year: 2026, month: 7 };

const HOME_METRICS = [
  { id: 'facturacion', label: 'Facturación', realField: 'total', projKey: 'Facturación Total GO UIC' },
  { id: 'instituciones', label: 'Instituciones GO', realField: 'overheadPct', projKey: 'OH Instituciones GO' },
  { id: 'uic', label: 'UIC', realField: 'goUic', projKey: 'GO ACE' },
  { id: 'ebitda', label: 'EBITDA UIC', realField: null, projKey: null }
];

function buildPeriodOptions() {
  const options = [];
  const dataYears = uniqueValues(UIC_DATA.facturacion, 'anio');
  const projYears = Object.keys(UIC_DATA.proyeccion['Facturación Total GO UIC'] || {})
    .filter(k => k !== 'total').map(Number);
  const allYears = [...new Set([...dataYears, ...projYears])].sort();

  allYears.forEach(y => {
    for (let m = 1; m <= 12; m++) {
      if (periodToNum(y, m) < periodToNum(PERIOD_START.year, PERIOD_START.month)) continue;
      options.push({ value: `${y}-${m}`, year: y, month: m, label: `${monthName(m).substring(0, 3)}-${String(y).slice(-2)}` });
    }
  });
  return options;
}

function parsePeriod(val) {
  const [y, m] = val.split('-').map(Number);
  return { year: y, month: m };
}

function periodToNum(y, m) {
  return y * 100 + m;
}

function getMetricRealMonthly(metric, year, month) {
  const rows = UIC_DATA.facturacion.filter(r => r.anio === year && r.mes === month);

  if (metric.realField) {
    return rows.reduce((s, r) => s + (r[metric.realField] || 0), 0);
  }

  if (metric.id === 'ebitda') {
    const uicRevenue = rows.reduce((s, r) => s + (r.goUic || 0), 0);
    const costoReal = UIC_DATA.costosReales
      .filter(c => c.anio === year && c.mes === month)
      .reduce((s, c) => s + c.total, 0);
    return uicRevenue - costoReal;
  }
  return 0;
}

function getMetricProjMonthly(metric, year) {
  if (metric.projKey) {
    const projData = UIC_DATA.proyeccion[metric.projKey] || {};
    return (projData[year] || 0) / 12;
  }

  if (metric.id === 'ebitda') {
    const goAce = UIC_DATA.proyeccion['GO ACE'] || {};
    const costos = UIC_DATA.proyeccion['Total Costos UIC'] || {};
    return ((goAce[year] || 0) / 12) - ((costos[year] || 0) / 12);
  }
  return 0;
}

function renderHome() {
  const container = document.getElementById('section-home');
  const periods = buildPeriodOptions();

  const metricOptions = HOME_METRICS.map(m =>
    `<option value="${m.id}">${m.label}</option>`
  ).join('');

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Métrica</label>
        <select id="home-metrica" class="filter-select" onchange="updateHome()">${metricOptions}</select>
      </div>
      <div class="filter-group">
        <label>Desde</label>
        <select id="home-desde" class="filter-select" onchange="updateHome()"></select>
      </div>
      <div class="filter-group">
        <label>Hasta</label>
        <select id="home-hasta" class="filter-select" onchange="updateHome()"></select>
      </div>
    </div>
    <div class="kpi-grid" id="home-kpis"></div>
    <div class="chart-container">
      <h3 id="home-chart-title">Real vs Proyección</h3>
      <div style="height:350px"><canvas id="chart-home-bars"></canvas></div>
    </div>
    <div class="chart-container">
      <h3 id="home-chart-acc-title">Acumulado Real vs Proyección</h3>
      <div style="height:300px"><canvas id="chart-home-lines"></canvas></div>
    </div>
  `;

  const desdeSelect = document.getElementById('home-desde');
  const hastaSelect = document.getElementById('home-hasta');

  periods.forEach(p => {
    desdeSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
    hastaSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
  });

  const defaultDesde = periods.find(p => p.year === 2026 && p.month === 7);
  if (defaultDesde) desdeSelect.value = defaultDesde.value;

  const realMonths = UIC_DATA.facturacion
    .map(r => ({ year: r.anio, month: r.mes }))
    .filter(r => r.year && r.month);
  if (realMonths.length > 0) {
    const lastReal = realMonths.sort((a, b) => periodToNum(b.year, b.month) - periodToNum(a.year, a.month))[0];
    const lastOpt = periods.find(p => p.year === lastReal.year && p.month === lastReal.month);
    if (lastOpt) hastaSelect.value = lastOpt.value;
  } else {
    hastaSelect.value = periods[periods.length - 1].value;
  }

  updateHome();
}

function updateHome() {
  const metricId = document.getElementById('home-metrica').value;
  const metric = HOME_METRICS.find(m => m.id === metricId);
  const desde = parsePeriod(document.getElementById('home-desde').value);
  const hasta = parsePeriod(document.getElementById('home-hasta').value);
  const desdeNum = periodToNum(desde.year, desde.month);
  const hastaNum = periodToNum(hasta.year, hasta.month);

  // Build list of months in range
  const monthsInRange = [];
  let y = desde.year, m = desde.month;
  while (periodToNum(y, m) <= hastaNum) {
    monthsInRange.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  // Calculate real and projected per month
  const realValues = monthsInRange.map(({ year, month }) => getMetricRealMonthly(metric, year, month));
  const projValues = monthsInRange.map(({ year }) => getMetricProjMonthly(metric, year));

  const realTotal = realValues.reduce((s, v) => s + v, 0);
  const proyected = projValues.reduce((s, v) => s + v, 0);

  // KPIs
  const cumplimiento = proyected > 0 ? (realTotal / proyected) * 100 : 0;
  const desvio = realTotal - proyected;
  const cumplClass = cumplimiento >= 90 ? 'success' : cumplimiento >= 70 ? 'warning' : 'error';

  document.getElementById('home-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">${metric.label} Real</div>
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

  // Update chart titles
  document.getElementById('home-chart-title').textContent = `${metric.label} — Real vs Proyección`;
  document.getElementById('home-chart-acc-title').textContent = `${metric.label} — Acumulado Real vs Proyección`;

  // Bar chart
  const labels = monthsInRange.map(({ year, month }) =>
    `${monthName(month).substring(0, 3)}-${String(year).slice(-2)}`
  );

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
}
