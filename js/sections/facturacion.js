const FACT_DIMENSIONS = [
  { id: 'centro', field: 'centro', title: 'Por Institución', donut: true },
  { id: 'proto', field: 'protocolo', title: 'Por Protocolo', table: true },
  { id: 'fase', field: 'fase', title: 'Por Fase', donut: true },
  { id: 'ip', field: 'ip', title: 'Por Investigador Principal' },
  { id: 'esp', field: 'especialidad', title: 'Por Especialidad' },
  { id: 'tipo', field: 'tipo', title: 'Por Tipo', donut: true }
];

const FACT_MEDIDAS = {
  goUic: { label: 'Go UIC', title: 'Facturación UIC', field: 'goUic', cobro: true },
  overhead: { label: 'Over Head (Instituciones)', title: 'Facturación Instituciones', field: 'overheadPct', cobro: false }
};

function factMedida() {
  const el = document.getElementById('fact-medida');
  return FACT_MEDIDAS[el ? el.value : 'goUic'] || FACT_MEDIDAS.goUic;
}

function factAmount(r) {
  return r[factMedida().field] || 0;
}

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
        <thead>
          <tr><th>Protocolo</th><th id="th-fact-total">Facturación UIC</th><th>Cobrado</th><th>No cobrado</th><th>% Cobrado</th></tr>
        </thead>
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
    if (!groups[key]) groups[key] = { label: r[dim.field] || '(Sin dato)', cobrado: 0, pendiente: 0 };
    if (isCobrado(r)) groups[key].cobrado += factAmount(r);
    else groups[key].pendiente += factAmount(r);
  });
  const entries = Object.values(groups)
    .sort((a, b) => (b.cobrado + b.pendiente) - (a.cobrado + a.pendiente));

  if (dim.table) {
    const pct = (c, t) => `${t ? (c / t * 100).toFixed(1) : '0.0'}%`;
    const tot = entries.reduce((a, e) => ({ c: a.c + e.cobrado, p: a.p + e.pendiente }), { c: 0, p: 0 });
    document.getElementById(`tbody-fact-${dim.id}`).innerHTML = entries.map(e => `<tr>
      <td>${e.label}</td>
      <td>${formatUSD(e.cobrado + e.pendiente)}</td>
      <td>${formatUSD(e.cobrado)}</td>
      <td>${formatUSD(e.pendiente)}</td>
      <td>${pct(e.cobrado, e.cobrado + e.pendiente)}</td>
    </tr>`).join('') + `<tr class="totals-row">
      <td><strong>TOTAL</strong></td>
      <td>${formatUSD(tot.c + tot.p)}</td>
      <td>${formatUSD(tot.c)}</td>
      <td>${formatUSD(tot.p)}</td>
      <td>${pct(tot.c, tot.c + tot.p)}</td>
    </tr>`;
    return;
  }

  const wrap = document.getElementById(`wrap-fact-${dim.id}`);

  if (dim.donut) {
    wrap.style.height = '280px';
    const grandTotal = entries.reduce((t, e) => t + e.cobrado + e.pendiente, 0);
    createDoughnutChart(`chart-fact-${dim.id}`, entries.map(e => e.label), entries.map(e => e.cobrado + e.pendiente), {
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 14, font: { family: 'Inter', size: 12 } } },
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label: ctx => {
              const e = entries[ctx.dataIndex];
              const t = e.cobrado + e.pendiente;
              return `${formatUSD(t)} (${grandTotal ? (t / grandTotal * 100).toFixed(1) : '0.0'}% del total)`;
            },
            footer: items => {
              const e = entries[items[0].dataIndex];
              const t = e.cobrado + e.pendiente;
              return `${t ? (e.cobrado / t * 100).toFixed(1) : '0.0'}% cobrado`;
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

  createBarChart(`chart-fact-${dim.id}`, entries.map(e => e.label), [
    { label: 'Cobrado', data: entries.map(e => e.cobrado), backgroundColor: GO_COLORS.secondary },
    { label: 'No cobrado', data: entries.map(e => e.pendiente), backgroundColor: GO_COLORS.primary }
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

  const [dY, dM] = desdeVal.split('-').map(Number);
  const [hY, hM] = hastaVal.split('-').map(Number);
  const desdeNum = dY * 100 + dM;
  const hastaNum = hY * 100 + hM;

  let data = UIC_DATA.facturacion.filter(r => {
    const num = r.anio * 100 + r.mes;
    return num >= desdeNum && num <= hastaNum;
  });

  const medida = factMedida();
  document.getElementById('th-fact-total').textContent = medida.title;
  const totalGoUic = sumBy(data, medida.field);
  const totalCobrado = sumBy(data.filter(isCobrado), medida.field);
  const pctCobrado = totalGoUic ? totalCobrado / totalGoUic : 0;
  const totalVisitas = sumBy(data, 'visitas');
  // Ticket promedio: siempre columna Total / Visitas, independiente del selector de facturación
  const ticketPromedio = totalVisitas ? sumBy(data, 'total') / totalVisitas : 0;

  // "Cobrado = SI" refiere al cobro de UIC: con la vista de Instituciones no aplica
  const cobroCards = `
    <div class="kpi-card">
      <div class="kpi-label">Cobrado</div>
      <div class="kpi-value" style="color:${GO_COLORS.secondary}">${formatUSD(totalCobrado)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">No cobrado</div>
      <div class="kpi-value">${formatUSD(totalGoUic - totalCobrado)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">% Cobrado</div>
      <div class="kpi-value" style="color:${GO_COLORS.secondary}">${formatPct(pctCobrado)}</div>
    </div>`;

  document.getElementById('fact-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">${medida.title}</div>
      <div class="kpi-value">${formatUSD(totalGoUic)}</div>
    </div>
    ${medida.cobro ? cobroCards : ''}
    <div class="kpi-card">
      <div class="kpi-label">Ticket Promedio</div>
      <div class="kpi-value">${formatUSD(ticketPromedio)}</div>
    </div>
  `;

  const monthEntries = [];
  data.forEach(r => {
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    let e = monthEntries.find(x => x.key === key);
    if (!e) {
      e = { key, facturado: 0, cobrado: 0, label: `${monthName(r.mes).substring(0, 3)}-${String(r.anio).slice(-2)}` };
      monthEntries.push(e);
    }
    e.facturado += factAmount(r);
    if (isCobrado(r)) e.cobrado += factAmount(r);
  });
  monthEntries.sort((a, b) => a.key.localeCompare(b.key));

  createLineChart('chart-fact-monthly',
    monthEntries.map(e => e.label),
    [
      { label: 'Facturado', data: monthEntries.map(e => e.facturado), borderColor: GO_COLORS.primary,
        backgroundColor: 'rgba(0,51,102,0.10)', fill: true, tension: 0.35, pointBorderColor: GO_COLORS.primary },
      { label: 'Cobrado', data: monthEntries.map(e => e.cobrado), borderColor: GO_COLORS.secondary,
        backgroundColor: 'rgba(0,135,78,0.18)', fill: true, tension: 0.35, pointBorderColor: GO_COLORS.secondary }
    ],
    {
      scales: {
        x: { grid: { display: false }, border: { color: '#e5e7eb' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280' } },
        y: { beginAtZero: true, grid: { color: '#eef0f3' }, border: { display: false },
             ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', padding: 6, callback: v => formatAxisUSD(v) } }
      },
      plugins: {
        legend: { display: true, ...defaultLegend },
        tooltip: {
          ...defaultTooltip,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatUSD(ctx.parsed.y)}`,
            footer: items => {
              const e = monthEntries[items[0].dataIndex];
              return `${e.facturado ? (e.cobrado / e.facturado * 100).toFixed(1) : '0.0'}% cobrado`;
            }
          }
        }
      }
    }
  );

  FACT_DIMENSIONS.forEach(d => renderCobradoChart(d, data));
}
