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
