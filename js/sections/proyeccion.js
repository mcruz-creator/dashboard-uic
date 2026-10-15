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
