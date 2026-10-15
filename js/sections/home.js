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
