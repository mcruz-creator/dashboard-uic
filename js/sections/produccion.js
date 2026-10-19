let produccionPage = 1;
let produccionFiltered = [];

function renderProduccion() {
  const container = document.getElementById('section-produccion');
  const protocolos = uniqueValues(UIC_DATA.produccion, 'protocolo');
  const ips = uniqueValues(UIC_DATA.produccion, 'ip');

  const allPeriods = [];
  const seen = new Set();
  UIC_DATA.produccion.forEach(r => {
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
        <select id="prod-desde" class="filter-select" onchange="updateProduccion()"></select>
      </div>
      <div class="filter-group">
        <label>Hasta</label>
        <select id="prod-hasta" class="filter-select" onchange="updateProduccion()"></select>
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
    <div class="chart-container">
      <h3>Visitas por CRO / Patrocinador</h3>
      <div id="wrap-prod-cliente" style="height:260px"><canvas id="chart-prod-cliente"></canvas></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="chart-container">
        <h3>Top 10 Responsables</h3>
        <div style="height:300px"><canvas id="chart-prod-resp"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Top 10 Protocolos</h3>
        <div style="height:300px"><canvas id="chart-prod-proto"></canvas></div>
      </div>
    </div>
    <div class="data-table-wrapper">
      <table class="data-table" id="prod-table">
        <thead>
          <tr>
            <th>Protocolo</th>
            <th>Visita</th>
            <th>Paciente</th>
            <th>Tipo Visita</th>
            <th>Asistencia</th>
            <th>Lugar</th>
            <th>Fecha</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody id="prod-tbody"></tbody>
      </table>
      <div class="pagination" id="prod-pagination"></div>
    </div>
  `;

  const desdeSelect = document.getElementById('prod-desde');
  const hastaSelect = document.getElementById('prod-hasta');
  allPeriods.forEach(p => {
    desdeSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
    hastaSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
  });
  if (allPeriods.length > 0) {
    desdeSelect.value = allPeriods[0].value;
    hastaSelect.value = allPeriods[allPeriods.length - 1].value;
  }
  populateSelect('prod-proto', protocolos);
  populateSelect('prod-ip', ips);

  produccionPage = 1;
  updateProduccion();
}

function updateProduccion() {
  const [dY, dM] = document.getElementById('prod-desde').value.split('-').map(Number);
  const [hY, hM] = document.getElementById('prod-hasta').value.split('-').map(Number);
  const desdeNum = dY * 100 + dM;
  const hastaNum = hY * 100 + hM;
  const proto = document.getElementById('prod-proto').value;
  const ip = document.getElementById('prod-ip').value;
  const search = (document.getElementById('prod-search').value || '').toLowerCase();

  let data = UIC_DATA.produccion.filter(r => {
    const num = r.anio * 100 + r.mes;
    return num >= desdeNum && num <= hastaNum;
  });
  if (proto) data = data.filter(r => r.protocolo === proto);
  if (ip) data = data.filter(r => r.ip === ip);
  if (search) data = data.filter(r =>
    String(r.paciente ?? '').toLowerCase().includes(search) ||
    String(r.protocolo ?? '').toLowerCase().includes(search)
  );

  produccionFiltered = data;

  // KPIs
  const totalVisitas = data.length;
  const pacientesUnicos = countDistinct(data, 'paciente');
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

  // CRO (o patrocinador si no hay CRO)
  const byCliente = groupBy(data, 'cliente');
  const clienteEntries = Object.entries(byCliente)
    .map(([k, v]) => ({ name: k, count: v.length }))
    .sort((a, b) => b.count - a.count);
  document.getElementById('wrap-prod-cliente').style.height = Math.max(140, clienteEntries.length * 34 + 60) + 'px';
  createBarChart('chart-prod-cliente',
    clienteEntries.map(e => e.name),
    [{ label: 'Visitas', data: clienteEntries.map(e => e.count), backgroundColor: GO_COLORS.primary }],
    { horizontal: true }
  );

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

  // Top 10 protocolos
  const byProto = groupBy(data, 'protocolo');
  const protoEntries = Object.entries(byProto)
    .map(([k, v]) => ({ name: k, count: v.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  createBarChart('chart-prod-proto',
    protoEntries.map(e => e.name),
    [{ label: 'Visitas', data: protoEntries.map(e => e.count), backgroundColor: GO_COLORS.primaryLight }],
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
