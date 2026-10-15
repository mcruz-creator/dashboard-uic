let produccionPage = 1;
let produccionFiltered = [];

function renderProduccion() {
  const container = document.getElementById('section-produccion');
  const protocolos = uniqueValues(UIC_DATA.produccion, 'protocolo');
  const ips = uniqueValues(UIC_DATA.produccion, 'ip');
  const anios = uniqueValues(UIC_DATA.produccion, 'anio').map(String);

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Año</label>
        <select id="prod-anio" class="filter-select" onchange="updateProduccion()"></select>
      </div>
      <div class="filter-group">
        <label>Mes</label>
        <select id="prod-mes" class="filter-select" onchange="updateProduccion()"></select>
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
    <div class="data-table-wrapper">
      <table class="data-table" id="prod-table">
        <thead>
          <tr>
            <th data-sort="protocolo">Protocolo <span class="sort-arrow">↕</span></th>
            <th data-sort="visita">Visita <span class="sort-arrow">↕</span></th>
            <th data-sort="paciente">Paciente <span class="sort-arrow">↕</span></th>
            <th data-sort="tipoVisita">Tipo Visita <span class="sort-arrow">↕</span></th>
            <th data-sort="asistencia">Asistencia <span class="sort-arrow">↕</span></th>
            <th data-sort="lugarTurno">Lugar <span class="sort-arrow">↕</span></th>
            <th data-sort="fechaTurno">Fecha <span class="sort-arrow">↕</span></th>
            <th data-sort="ip">IP <span class="sort-arrow">↕</span></th>
          </tr>
        </thead>
        <tbody id="prod-tbody"></tbody>
      </table>
      <div class="pagination" id="prod-pagination"></div>
    </div>
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
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="chart-container">
        <h3>Top 10 Responsables</h3>
        <div style="height:300px"><canvas id="chart-prod-resp"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Top 10 Firmantes</h3>
        <div style="height:300px"><canvas id="chart-prod-firm"></canvas></div>
      </div>
    </div>
  `;

  populateSelect('prod-anio', anios);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }));
  document.getElementById('prod-mes').innerHTML = '<option value="">Todos</option>' +
    months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  populateSelect('prod-proto', protocolos);
  populateSelect('prod-ip', ips);

  makeSortable('prod-table');
  produccionPage = 1;
  updateProduccion();
}

function updateProduccion() {
  const anio = document.getElementById('prod-anio').value;
  const mes = document.getElementById('prod-mes').value;
  const proto = document.getElementById('prod-proto').value;
  const ip = document.getElementById('prod-ip').value;
  const search = (document.getElementById('prod-search').value || '').toLowerCase();

  let data = UIC_DATA.produccion;
  if (anio) data = data.filter(r => r.anio === parseInt(anio));
  if (mes) data = data.filter(r => r.mes === parseInt(mes));
  if (proto) data = data.filter(r => r.protocolo === proto);
  if (ip) data = data.filter(r => r.ip === ip);
  if (search) data = data.filter(r =>
    r.paciente.toLowerCase().includes(search) ||
    r.protocolo.toLowerCase().includes(search)
  );

  produccionFiltered = data;

  // KPIs
  const totalVisitas = data.length;
  const pacientesUnicos = countDistinct(data, 'paciente');
  const cumplidos = data.filter(r =>
    r.cumplimientoTurno.toLowerCase() === 'sí' || r.cumplimientoTurno.toLowerCase() === 'si'
  ).length;
  const tasaCumpl = totalVisitas > 0 ? (cumplidos / totalVisitas) * 100 : 0;
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
      <div class="kpi-label">Tasa de Cumplimiento</div>
      <div class="kpi-value">${tasaCumpl.toFixed(1)}%</div>
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

  // Top 10 firmantes
  const byFirm = groupBy(data, 'firmante');
  const firmEntries = Object.entries(byFirm)
    .map(([k, v]) => ({ name: k, count: v.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  createBarChart('chart-prod-firm',
    firmEntries.map(e => e.name),
    [{ label: 'Visitas', data: firmEntries.map(e => e.count), backgroundColor: GO_COLORS.primaryLight }],
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
