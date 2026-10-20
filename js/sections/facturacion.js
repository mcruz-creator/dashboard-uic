const FACT_DIMENSIONS = [
  { id: 'centro', field: 'centro', title: 'Por Institución', donut: true },
  { id: 'proto', field: 'protocolo', title: 'Por Protocolo', table: true },
  { id: 'fase', field: 'fase', title: 'Por Fase', donut: true },
  { id: 'ip', field: 'ip', title: 'Por Investigador Principal' },
  { id: 'esp', field: 'especialidad', title: 'Por Especialidad' },
  { id: 'tipo', field: 'tipo', title: 'Por Tipo', donut: true }
];

const FACT_MEDIDAS = {
  goUic: { label: 'Go UIC', title: 'Facturación esperada UIC', field: 'goUic', cobro: true },
  overhead: { label: 'Over Head (Instituciones)', title: 'Facturación Instituciones', field: 'overheadPct', cobro: false }
};

function factMedida() {
  const el = document.getElementById('fact-medida');
  return FACT_MEDIDAS[el ? el.value : 'goUic'] || FACT_MEDIDAS.goUic;
}

function factAmount(r) {
  return r[factMedida().field] || 0;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isSi(v) {
  const s = (v || '').trim().toLowerCase();
  return s === 'si' || s === 'sí';
}

function isFacturado(r) {
  return isSi(r.facturadoUic);
}

// No se cobra lo que no se facturó: Cobrado solo cuenta si la fila también está facturada
function isCobrado(r) {
  return isSi(r.cobrado) && isFacturado(r);
}

function isCobradoSinFacturar(r) {
  return isSi(r.cobrado) && !isFacturado(r);
}

function factKey(field, value) {
  const v = value || '(Sin dato)';
  return field === 'especialidad'
    ? v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ')
    : v;
}

function renderFacturacion() {
  const container = document.getElementById('section-facturacion');

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

  const dimCard = d => d.table ? `
    <div class="data-table-wrapper" style="margin-bottom:1.5rem">
      <table class="data-table">
        <thead id="thead-fact-${d.id}"></thead>
        <tbody id="tbody-fact-${d.id}"></tbody>
      </table>
    </div>` : `
    <div class="chart-container">
      <h3>${d.title}</h3>
      <div id="wrap-fact-${d.id}" style="height:200px"><canvas id="chart-fact-${d.id}"></canvas></div>
    </div>`;
  const donutCharts = FACT_DIMENSIONS.filter(d => d.donut).map(dimCard).join('');
  const barOrder = ['ip', 'esp', 'proto'];
  const barCharts = barOrder.map(id => FACT_DIMENSIONS.find(d => d.id === id)).map(dimCard).join('');

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Facturación de</label>
        <select id="fact-medida" class="filter-select" onchange="updateFacturacion()">
          ${Object.entries(FACT_MEDIDAS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Desde</label>
        <select id="fact-desde" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
      <div class="filter-group">
        <label>Hasta</label>
        <select id="fact-hasta" class="filter-select" onchange="updateFacturacion()"></select>
      </div>
    </div>
    <div id="fact-alert"></div>
    <div class="kpi-grid" id="fact-kpis"></div>
    <div class="chart-container">
      <h3>Evolución Mensual</h3>
      <div style="height:300px"><canvas id="chart-fact-monthly"></canvas></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;align-items:start">
      ${donutCharts}
    </div>
    ${barCharts}
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

  updateFacturacion();
}

function renderCobradoChart(dim, data) {
  const groups = {};
  data.forEach(r => {
    const key = factKey(dim.field, r[dim.field]);
    if (!groups[key]) groups[key] = { label: r[dim.field] || '(Sin dato)', esperado: 0, facturado: 0, cobrado: 0 };
    const g = groups[key];
    const amt = factAmount(r);
    g.esperado += amt;
    if (isFacturado(r)) g.facturado += amt;
    if (isCobrado(r)) g.cobrado += amt;
  });
  const entries = Object.values(groups).sort((a, b) => b.esperado - a.esperado);

  const medida = factMedida();
  const pct = (n, d) => `${d ? (n / d * 100).toFixed(1) : '0.0'}%`;

  if (dim.table) {
    const tot = entries.reduce((a, e) => ({
      esperado: a.esperado + e.esperado, facturado: a.facturado + e.facturado, cobrado: a.cobrado + e.cobrado
    }), { esperado: 0, facturado: 0, cobrado: 0 });
    // El circuito Facturado/Cobrado es de UIC: solo se muestra en la vista Go UIC
    document.getElementById(`thead-fact-${dim.id}`).innerHTML = medida.cobro
      ? `<tr><th>Protocolo</th><th>${medida.title}</th><th>Facturado UIC</th><th>% Facturado UIC</th><th>Cobrado UIC</th><th>No cobrado</th><th>% Cobrado</th></tr>`
      : `<tr><th>Protocolo</th><th>${medida.title}</th></tr>`;
    const cobroCols = e => medida.cobro
      ? `<td>${formatUSD(e.facturado)}</td><td>${pct(e.facturado, e.esperado)}</td><td>${formatUSD(e.cobrado)}</td><td>${formatUSD(e.facturado - e.cobrado)}</td><td>${pct(e.cobrado, e.facturado)}</td>` : '';
    document.getElementById(`tbody-fact-${dim.id}`).innerHTML = entries.map(e => `<tr>
      <td>${esc(e.label)}</td>
      <td>${formatUSD(e.esperado)}</td>
      ${cobroCols(e)}
    </tr>`).join('') + `<tr class="totals-row">
      <td><strong>TOTAL</strong></td>
      <td>${formatUSD(tot.esperado)}</td>
      ${cobroCols(tot)}
    </tr>`;
    return;
  }

  const wrap = document.getElementById(`wrap-fact-${dim.id}`);

  if (dim.donut) {
    wrap.style.height = '280px';
    const grandTotal = entries.reduce((t, e) => t + e.esperado, 0);
    createDoughnutChart(`chart-fact-${dim.id}`, entries.map(e => e.label), entries.map(e => e.esperado), {
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 14, font: { family: 'Inter', size: 12 } } },
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label: ctx => {
              const e = entries[ctx.dataIndex];
              return `${formatUSD(e.esperado)} (${pct(e.esperado, grandTotal)} del total)`;
            },
            footer: items => {
              if (!medida.cobro) return '';
              const e = entries[items[0].dataIndex];
              return [`${pct(e.facturado, e.esperado)} facturado`, `${pct(e.cobrado, e.facturado)} cobrado (de lo facturado)`];
            }
          }
        }
      }
    });
    return;
  }

  wrap.style.height = Math.max(140, entries.length * 34 + 80) + 'px';

  const stackedScales = {
    x: { stacked: true, beginAtZero: true, grid: { color: '#eef0f3' }, border: { display: false },
         ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', callback: v => formatAxisUSD(v) } },
    y: { stacked: true, grid: { display: false }, border: { color: '#e5e7eb' },
         ticks: { font: { family: 'Inter', size: 11 }, color: '#374151', callback(v) { return shortLabel(this.getLabelForValue(v)); } } }
  };

  // Tres tramos que suman lo esperado: cobrado + facturado sin cobrar + pendiente de facturar
  const barSeries = medida.cobro
    ? [
        { label: 'Cobrado UIC', data: entries.map(e => e.cobrado), backgroundColor: GO_COLORS.secondary },
        { label: 'Facturado sin cobrar', data: entries.map(e => e.facturado - e.cobrado), backgroundColor: GO_COLORS.primary },
        { label: 'Pendiente de facturar', data: entries.map(e => e.esperado - e.facturado), backgroundColor: '#cbd5e1' }
      ]
    : [{ label: medida.title, data: entries.map(e => e.esperado), backgroundColor: GO_COLORS.primary }];

  createBarChart(`chart-fact-${dim.id}`, entries.map(e => e.label), barSeries, {
    horizontal: true,
    scales: stackedScales,
    plugins: {
      legend: { ...defaultLegend, display: medida.cobro },
      tooltip: {
        ...defaultTooltip,
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${formatUSD(ctx.parsed.x)}`,
          footer: items => {
            if (!medida.cobro) return '';
            const e = entries[items[0].dataIndex];
            return `Esperado: ${formatUSD(e.esperado)} — ${pct(e.facturado, e.esperado)} facturado, ${pct(e.cobrado, e.facturado)} cobrado`;
          }
        }
      }
    }
  });
}

// Cobrado = SI sin Facturado = SI es un error de carga (no se cobra lo que no se facturó).
// Se revisa sobre toda la planilla, sin filtros, para que ningún filtro lo esconda.
function renderFactAlert() {
  const el = document.getElementById('fact-alert');
  if (!el) return;
  const bad = UIC_DATA.facturacion.filter(isCobradoSinFacturar);
  if (!bad.length) { el.innerHTML = ''; return; }
  const MAX = 10;
  const items = bad.slice(0, MAX).map(r => {
    const per = r.mes && r.anio ? `${monthName(r.mes).substring(0, 3)}-${String(r.anio).slice(-2)}` : 's/f';
    const fact = r.numeroFact ? `, factura ${esc(r.numeroFact)}` : '';
    return `<li>${esc(r.protocolo)} — ${esc(r.centro || '(Sin institución)')} — ${per}${fact}</li>`;
  }).join('');
  const more = bad.length > MAX ? `<li>… y ${bad.length - MAX} más</li>` : '';
  const plural = bad.length !== 1;
  el.innerHTML = `<div class="alert-banner" role="alert">
    <strong>Revisar la planilla: ${bad.length} ${plural ? 'filas tienen' : 'fila tiene'} Cobrado UIC = SI sin Facturado UIC = SI</strong>
    No se ${plural ? 'cuentan' : 'cuenta'} como cobrad${plural ? 'as' : 'a'} hasta que se marque${plural ? 'n' : ''} como facturad${plural ? 'as' : 'a'}.
    <ul>${items}${more}</ul>
  </div>`;
}

function updateFacturacion() {
  const desdeVal = document.getElementById('fact-desde').value;
  const hastaVal = document.getElementById('fact-hasta').value;

  const [dY, dM] = desdeVal.split('-').map(Number);
  const [hY, hM] = hastaVal.split('-').map(Number);
  const desdeNum = dY * 100 + dM;
  const hastaNum = hY * 100 + hM;

  let data = UIC_DATA.facturacion.filter(r => {
    const num = r.anio * 100 + r.mes;
    return num >= desdeNum && num <= hastaNum;
  });

  renderFactAlert();

  const medida = factMedida();
  const totalEsperado = sumBy(data, medida.field);
  const totalFacturado = sumBy(data.filter(isFacturado), medida.field);
  const totalCobrado = sumBy(data.filter(isCobrado), medida.field);
  const pctFacturado = totalEsperado ? totalFacturado / totalEsperado : 0;
  const pctCobradoEsperado = totalEsperado ? totalCobrado / totalEsperado : 0;
  const pctCobrado = totalFacturado ? totalCobrado / totalFacturado : 0;
  const totalVisitas = sumBy(data, 'visitas');
  // Ticket promedio: siempre columna Total / Visitas, independiente del selector de facturación
  const ticketPromedio = totalVisitas ? sumBy(data, 'total') / totalVisitas : 0;

  // Facturado y Cobrado refieren a UIC: con la vista de Instituciones no aplican
  const facturadoCards = `
    <div class="kpi-card">
      <div class="kpi-label">Facturado UIC</div>
      <div class="kpi-value">${formatUSD(totalFacturado)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">% Facturado UIC</div>
      <div class="kpi-value">${formatPct(pctFacturado)}</div>
    </div>`;
  const cobroCards = `
    <div class="kpi-card">
      <div class="kpi-label">Cobrado UIC</div>
      <div class="kpi-value" style="color:${GO_COLORS.secondary}">${formatUSD(totalCobrado)}</div>
      <div class="kpi-sub">${formatPct(pctCobradoEsperado)} de lo esperado</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">No cobrado</div>
      <div class="kpi-value">${formatUSD(totalFacturado - totalCobrado)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">% Cobrado</div>
      <div class="kpi-value" style="color:${GO_COLORS.secondary}">${formatPct(pctCobrado)}</div>
    </div>`;

  // Vista UIC: fila 1 = esperada + facturado, fila 2 = cobrado, Ticket Promedio a la derecha ocupando las dos filas
  const kpis = document.getElementById('fact-kpis');
  kpis.className = 'kpi-grid' + (medida.cobro ? ' kpi-grid-uic' : '');
  kpis.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">${medida.title}</div>
      <div class="kpi-value">${formatUSD(totalEsperado)}</div>
    </div>
    ${medida.cobro ? facturadoCards + cobroCards : ''}
    <div class="kpi-card kpi-card-ticket">
      <div class="kpi-label">Ticket Promedio</div>
      <div class="kpi-value">${formatUSD(ticketPromedio)}</div>
    </div>
  `;

  const monthEntries = [];
  data.forEach(r => {
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    let e = monthEntries.find(x => x.key === key);
    if (!e) {
      e = { key, esperado: 0, facturado: 0, cobrado: 0, label: `${monthName(r.mes).substring(0, 3)}-${String(r.anio).slice(-2)}` };
      monthEntries.push(e);
    }
    const amt = factAmount(r);
    e.esperado += amt;
    if (isFacturado(r)) e.facturado += amt;
    if (isCobrado(r)) e.cobrado += amt;
  });
  monthEntries.sort((a, b) => a.key.localeCompare(b.key));

  const lineSeries = medida.cobro
    ? [
        { label: 'Esperada', data: monthEntries.map(e => e.esperado), borderColor: GO_COLORS.primary,
          backgroundColor: 'rgba(0,51,102,0.10)', fill: true, tension: 0.35, pointBorderColor: GO_COLORS.primary },
        { label: 'Facturado UIC', data: monthEntries.map(e => e.facturado), borderColor: GO_COLORS.primaryLight,
          backgroundColor: 'rgba(0,89,179,0.10)', fill: false, tension: 0.35, pointBorderColor: GO_COLORS.primaryLight },
        { label: 'Cobrado UIC', data: monthEntries.map(e => e.cobrado), borderColor: GO_COLORS.secondary,
          backgroundColor: 'rgba(0,135,78,0.18)', fill: true, tension: 0.35, pointBorderColor: GO_COLORS.secondary }
      ]
    : [
        { label: 'Facturado', data: monthEntries.map(e => e.esperado), borderColor: GO_COLORS.primary,
          backgroundColor: 'rgba(0,51,102,0.10)', fill: true, tension: 0.35, pointBorderColor: GO_COLORS.primary }
      ];

  createLineChart('chart-fact-monthly',
    monthEntries.map(e => e.label),
    lineSeries,
    {
      scales: {
        x: { grid: { display: false }, border: { color: '#e5e7eb' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280' } },
        y: { beginAtZero: true, grid: { color: '#eef0f3' }, border: { display: false },
             ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', padding: 6, callback: v => formatAxisUSD(v) } }
      },
      plugins: {
        legend: { ...defaultLegend, display: medida.cobro },
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatUSD(ctx.parsed.y)}`,
            footer: items => {
              if (!medida.cobro) return '';
              const e = monthEntries[items[0].dataIndex];
              const p = (n, d) => `${d ? (n / d * 100).toFixed(1) : '0.0'}%`;
              return [`${p(e.facturado, e.esperado)} facturado`, `${p(e.cobrado, e.facturado)} cobrado (de lo facturado)`];
            }
          }
        }
      }
    }
  );

  FACT_DIMENSIONS.forEach(d => renderCobradoChart(d, data));
}
