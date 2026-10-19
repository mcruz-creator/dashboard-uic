const FACT_DIMENSIONS = [
  { id: 'centro', field: 'centro', title: 'Por Institución' },
  { id: 'proto', field: 'protocolo', title: 'Por Protocolo' },
  { id: 'fase', field: 'fase', title: 'Por Fase' },
  { id: 'ip', field: 'ip', title: 'Por Investigador Principal' },
  { id: 'esp', field: 'especialidad', title: 'Por Especialidad' },
  { id: 'tipo', field: 'tipo', title: 'Por Tipo' }
];

function isCobrado(r) {
  const v = (r.cobrado || '').trim().toLowerCase();
  return v === 'si' || v === 'sí';
}

function factKey(field, value) {
  const v = value || '(Sin dato)';
  return field === 'especialidad'
    ? v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ')
    : v;
}

function renderFacturacion() {
  const container = document.getElementById('section-facturacion');
  const ips = uniqueValues(UIC_DATA.facturacion, 'ip');
  const centros = uniqueValues(UIC_DATA.facturacion, 'centro');

  const allPeriods = [];
  const seen = new Set();
  UIC_DATA.facturacion.forEach(r => {
    if (!r.anio || !r.mes) return;
    const key = `${r.anio}-${r.mes}`;
    if (!seen.has(key)) {
      seen.add(key);
      allPeriods.push({ value: key, year: r.anio, month: r.mes, label: `${monthName(r.mes).substring(0, 3)}-${String(r.anio).slice(-2)}` });
    }
  });
  allPeriods.sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));

  const dimCard = d => `
    <div class="chart-container">
      <h3>${d.title}</h3>
      <div id="wrap-fact-${d.id}" style="height:200px"><canvas id="chart-fact-${d.id}"></canvas></div>
    </div>`;
  const BIG = ['proto', 'esp'];
  const smallCharts = FACT_DIMENSIONS.filter(d => !BIG.includes(d.id)).map(dimCard).join('');
  const bigCharts = FACT_DIMENSIONS.filter(d => BIG.includes(d.id)).map(dimCard).join('');

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Desde</label>
        <select id="fact-desde" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
      <div class="filter-group">
        <label>Hasta</label>
        <select id="fact-hasta" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
      <div class="filter-group">
        <label>Investigador Principal</label>
        <select id="fact-ip" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
      <div class="filter-group">
        <label>Institución</label>
        <select id="fact-centro" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
    </div>
    <div class="kpi-grid" id="fact-kpis"></div>
    <div class="chart-container">
      <h3>Evolución Mensual</h3>
      <div style="height:300px"><canvas id="chart-fact-monthly"></canvas></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;align-items:start">
      ${smallCharts}
    </div>
    ${bigCharts}
  `;

  const desdeSelect = document.getElementById('fact-desde');
  const hastaSelect = document.getElementById('fact-hasta');
  allPeriods.forEach(p => {
    desdeSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
    hastaSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
  });
  if (allPeriods.length > 0) {
    desdeSelect.value = allPeriods[0].value;
    hastaSelect.value = allPeriods[allPeriods.length - 1].value;
  }

  populateSelect('fact-ip', ips);
  populateSelect('fact-centro', centros);

  updateFacturacion();
}

function renderCobradoChart(dim, data) {
  const groups = {};
  data.forEach(r => {
    const key = factKey(dim.field, r[dim.field]);
    if (!groups[key]) groups[key] = { label: r[dim.field] || '(Sin dato)', cobrado: 0, pendiente: 0 };
    if (isCobrado(r)) groups[key].cobrado += r.goUic;
    else groups[key].pendiente += r.goUic;
  });
  const entries = Object.values(groups)
    .sort((a, b) => (b.cobrado + b.pendiente) - (a.cobrado + a.pendiente));

  const wrap = document.getElementById(`wrap-fact-${dim.id}`);
  wrap.style.height = Math.max(140, entries.length * 34 + 80) + 'px';

  const stackedScales = {
    x: { stacked: true, beginAtZero: true, grid: { color: '#eef0f3' }, border: { display: false },
         ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', callback: v => formatAxisUSD(v) } },
    y: { stacked: true, grid: { display: false }, border: { color: '#e5e7eb' },
         ticks: { font: { family: 'Inter', size: 11 }, color: '#374151', callback(v) { return shortLabel(this.getLabelForValue(v)); } } }
  };

  createBarChart(`chart-fact-${dim.id}`, entries.map(e => e.label), [
    { label: 'Cobrado', data: entries.map(e => e.cobrado), backgroundColor: GO_COLORS.secondary },
    { label: 'No cobrado', data: entries.map(e => e.pendiente), backgroundColor: '#cbd5e1' }
  ], {
    horizontal: true,
    scales: stackedScales,
    plugins: {
      legend: { display: true, ...defaultLegend },
      tooltip: {
        ...defaultTooltip,
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${formatUSD(ctx.parsed.x)}`,
          footer: items => {
            const e = entries[items[0].dataIndex];
            const total = e.cobrado + e.pendiente;
            return `Total: ${formatUSD(total)} — ${total ? (e.cobrado / total * 100).toFixed(1) : '0.0'}% cobrado`;
          }
        }
      }
    }
  });
}

function updateFacturacion() {
  const desdeVal = document.getElementById('fact-desde').value;
  const hastaVal = document.getElementById('fact-hasta').value;
  const ip = document.getElementById('fact-ip').value;
  const centro = document.getElementById('fact-centro').value;

  const [dY, dM] = desdeVal.split('-').map(Number);
  const [hY, hM] = hastaVal.split('-').map(Number);
  const desdeNum = dY * 100 + dM;
  const hastaNum = hY * 100 + hM;

  let data = UIC_DATA.facturacion.filter(r => {
    const num = r.anio * 100 + r.mes;
    return num >= desdeNum && num <= hastaNum;
  });
  if (ip) data = data.filter(r => r.ip === ip);
  if (centro) data = data.filter(r => r.centro === centro);

  const totalGoUic = sumBy(data, 'goUic');
  const totalCobrado = sumBy(data.filter(isCobrado), 'goUic');
  const pctCobrado = totalGoUic ? totalCobrado / totalGoUic : 0;

  document.getElementById('fact-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Facturación UIC</div>
      <div class="kpi-value">${formatUSD(totalGoUic)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cobrado</div>
      <div class="kpi-value">${formatUSD(totalCobrado)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">No cobrado</div>
      <div class="kpi-value">${formatUSD(totalGoUic - totalCobrado)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">% Cobrado</div>
      <div class="kpi-value">${formatPct(pctCobrado)}</div>
    </div>
  `;

  const monthEntries = [];
  data.forEach(r => {
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    const existing = monthEntries.find(e => e.key === key);
    if (existing) { existing.total += r.goUic; }
    else { monthEntries.push({ key, total: r.goUic, label: `${monthName(r.mes).substring(0, 3)}-${String(r.anio).slice(-2)}` }); }
  });
  monthEntries.sort((a, b) => a.key.localeCompare(b.key));

  createLineChart('chart-fact-monthly',
    monthEntries.map(e => e.label),
    [{
      label: 'Facturación UIC USD',
      data: monthEntries.map(e => e.total),
      borderColor: GO_COLORS.primary,
      backgroundColor: 'rgba(0,51,102,0.1)',
      fill: true,
      tension: 0.35,
      pointBorderColor: GO_COLORS.primary
    }],
    {
      scales: {
        x: { grid: { display: false }, border: { color: '#e5e7eb' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280' } },
        y: { beginAtZero: true, grid: { color: '#eef0f3' }, border: { display: false },
             ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', padding: 6, callback: v => formatAxisUSD(v) } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...defaultTooltip, callbacks: { label: ctx => formatUSD(ctx.parsed.y) } }
      }
    }
  );

  FACT_DIMENSIONS.forEach(d => renderCobradoChart(d, data));
}
