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

function addMonths(year, month, n) {
  let y = year, m = month;
  for (let i = 0; i < n; i++) {
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return { year: y, month: m };
}

function periodLabel(year, month) {
  return `${monthName(month).substring(0, 3)}-${String(year).slice(-2)}`;
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
    <div id="home-kpis-section"></div>
    <div class="chart-container">
      <h3 id="home-chart-title">Real vs Proyección</h3>
      <div style="height:350px"><canvas id="chart-home-bars"></canvas></div>
    </div>
    <div class="data-table-wrapper" id="home-summary-table"></div>
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

  // Build list of months in selected range
  const monthsInRange = [];
  let y = desde.year, m = desde.month;
  while (periodToNum(y, m) <= hastaNum) {
    monthsInRange.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const N = monthsInRange.length;
  const N2 = N * 2;

  // Build x2 period (from desde, 2N months)
  const monthsX2 = [];
  y = desde.year;
  m = desde.month;
  for (let i = 0; i < N2; i++) {
    monthsX2.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  // Real total for selected N months
  const realValues = monthsInRange.map(({ year, month }) => getMetricRealMonthly(metric, year, month));
  const realTotal = realValues.reduce((s, v) => s + v, 0);

  // Projected for N months
  const projNValues = monthsInRange.map(({ year }) => getMetricProjMonthly(metric, year));
  const projN = projNValues.reduce((s, v) => s + v, 0);

  // Estimated x2 = real * 2
  const estimadoX2 = realTotal * 2;

  // Projected for 2N months
  const projX2Values = monthsX2.map(({ year }) => getMetricProjMonthly(metric, year));
  const projX2 = projX2Values.reduce((s, v) => s + v, 0);

  // Cumplimiento and desvío for N months
  const cumplN = projN > 0 ? (realTotal / projN) * 100 : 0;
  const desvioN = realTotal - projN;
  const cumplNClass = cumplN >= 90 ? 'success' : cumplN >= 70 ? 'warning' : 'error';

  // Cumplimiento and desvío for x2
  const cumplX2 = projX2 > 0 ? (estimadoX2 / projX2) * 100 : 0;
  const desvioX2 = estimadoX2 - projX2;
  const cumplX2Class = cumplX2 >= 90 ? 'success' : cumplX2 >= 70 ? 'warning' : 'error';

  // Period labels
  const desdeLabel = periodLabel(desde.year, desde.month);
  const hastaLabel = periodLabel(hasta.year, hasta.month);
  const endX2 = monthsX2[monthsX2.length - 1];
  const hastaX2Label = periodLabel(endX2.year, endX2.month);

  // KPIs section: 2 rows
  document.getElementById('home-kpis-section').innerHTML = `
    <h4 style="font-size:0.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">
      ${N} meses — ${desdeLabel} a ${hastaLabel}
    </h4>
    <div class="kpi-grid" style="margin-bottom:1.25rem;">
      <div class="kpi-card">
        <div class="kpi-label">${metric.label} Real</div>
        <div class="kpi-value">${formatUSD(realTotal)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Proyectado</div>
        <div class="kpi-value">${formatUSD(projN)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cumplimiento</div>
        <div class="kpi-value ${cumplNClass}">${cumplN.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Desvío</div>
        <div class="kpi-value ${desvioN >= 0 ? 'success' : 'error'}">
          ${desvioN >= 0 ? '+' : ''}${formatUSD(desvioN)}
        </div>
      </div>
    </div>

    <h4 style="font-size:0.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">
      ${N2} meses (estimado) — ${desdeLabel} a ${hastaX2Label}
    </h4>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">${metric.label} Estimado</div>
        <div class="kpi-value">${formatUSD(estimadoX2)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Proyectado</div>
        <div class="kpi-value">${formatUSD(projX2)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cumplimiento</div>
        <div class="kpi-value ${cumplX2Class}">${cumplX2.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Desvío</div>
        <div class="kpi-value ${desvioX2 >= 0 ? 'success' : 'error'}">
          ${desvioX2 >= 0 ? '+' : ''}${formatUSD(desvioX2)}
        </div>
      </div>
    </div>
  `;

  // Bar chart: 2 bars — Estimado x2 vs Proyectado x2
  const chartLabel = `${desdeLabel} a ${hastaX2Label}`;
  document.getElementById('home-chart-title').textContent = `${metric.label} — Estimado vs Proyección (${N2} meses)`;

  createBarChart('chart-home-bars', [chartLabel], [
    { label: `Estimado (real×2)`, data: [estimadoX2], backgroundColor: GO_COLORS.primary, barPercentage: 0.5 },
    { label: 'Proyección', data: [projX2], backgroundColor: GO_COLORS.grayLight, borderColor: GO_COLORS.gray, borderWidth: 1, barPercentage: 0.5 }
  ]);

  // Summary table: all metrics for N and 2N months
  const tableRows = HOME_METRICS.map(met => {
    const rVals = monthsInRange.map(({ year, month }) => getMetricRealMonthly(met, year, month));
    const rTotal = rVals.reduce((s, v) => s + v, 0);
    const pNVals = monthsInRange.map(({ year }) => getMetricProjMonthly(met, year));
    const pN = pNVals.reduce((s, v) => s + v, 0);
    const estX2 = rTotal * 2;
    const pX2Vals = monthsX2.map(({ year }) => getMetricProjMonthly(met, year));
    const pX2 = pX2Vals.reduce((s, v) => s + v, 0);
    const cN = pN > 0 ? (rTotal / pN * 100).toFixed(1) : '—';
    const cX2 = pX2 > 0 ? (estX2 / pX2 * 100).toFixed(1) : '—';
    return `
      <tr>
        <td data-col="metrica" style="font-weight:600">${met.label}</td>
        <td data-col="real_n" style="text-align:right">${formatUSD(rTotal)}</td>
        <td data-col="proy_n" style="text-align:right">${formatUSD(pN)}</td>
        <td data-col="cumpl_n" style="text-align:right;color:${parseFloat(cN) >= 90 ? 'var(--go-success)' : parseFloat(cN) >= 70 ? 'var(--go-warning)' : 'var(--go-error)'}">${cN}%</td>
        <td data-col="est_x2" style="text-align:right">${formatUSD(estX2)}</td>
        <td data-col="proy_x2" style="text-align:right">${formatUSD(pX2)}</td>
        <td data-col="cumpl_x2" style="text-align:right;color:${parseFloat(cX2) >= 90 ? 'var(--go-success)' : parseFloat(cX2) >= 70 ? 'var(--go-warning)' : 'var(--go-error)'}">${cX2}%</td>
      </tr>`;
  }).join('');

  document.getElementById('home-summary-table').innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th rowspan="2" style="vertical-align:bottom">Métrica</th>
          <th colspan="3" style="text-align:center;border-bottom:1px solid #e5e7eb">${N} meses (${desdeLabel} — ${hastaLabel})</th>
          <th colspan="3" style="text-align:center;border-bottom:1px solid #e5e7eb">${N2} meses estimado (${desdeLabel} — ${hastaX2Label})</th>
        </tr>
        <tr>
          <th style="text-align:right">Real</th>
          <th style="text-align:right">Proyectado</th>
          <th style="text-align:right">Cumpl.</th>
          <th style="text-align:right">Estimado</th>
          <th style="text-align:right">Proyectado</th>
          <th style="text-align:right">Cumpl.</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}
