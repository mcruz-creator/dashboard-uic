function renderFacturacion() {
  const container = document.getElementById('section-facturacion');
  const ips = uniqueValues(UIC_DATA.facturacion, 'ip');
  const protocolos = uniqueValues(UIC_DATA.facturacion, 'protocolo');

  // Build period options from facturacion data
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
  populateSelect('fact-proto', protocolos);

  makeSortable('fact-table');
  updateFacturacion();
}

function updateFacturacion() {
  const desdeVal = document.getElementById('fact-desde').value;
  const hastaVal = document.getElementById('fact-hasta').value;
  const ip = document.getElementById('fact-ip').value;
  const proto = document.getElementById('fact-proto').value;

  const [dY, dM] = desdeVal.split('-').map(Number);
  const [hY, hM] = hastaVal.split('-').map(Number);
  const desdeNum = dY * 100 + dM;
  const hastaNum = hY * 100 + hM;

  let data = UIC_DATA.facturacion.filter(r => {
    const num = r.anio * 100 + r.mes;
    return num >= desdeNum && num <= hastaNum;
  });
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
  const monthEntries = [];
  data.forEach(r => {
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    const existing = monthEntries.find(e => e.key === key);
    if (existing) { existing.total += r.total; }
    else { monthEntries.push({ key, year: r.anio, month: r.mes, total: r.total, label: `${monthName(r.mes).substring(0, 3)}-${String(r.anio).slice(-2)}` }); }
  });
  monthEntries.sort((a, b) => a.key.localeCompare(b.key));

  createLineChart('chart-fact-monthly',
    monthEntries.map(e => e.label),
    [{
      label: 'Facturación USD',
      data: monthEntries.map(e => e.total),
      borderColor: GO_COLORS.primary,
      backgroundColor: 'rgba(0,51,102,0.1)',
      fill: true,
      tension: 0.3
    }]
  );
}
