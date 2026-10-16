function populateSelect(selectId, values, allLabel = 'Todos') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';

  if (allLabel) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = allLabel;
    select.appendChild(opt);
  }

  values.forEach(val => {
    if (!val) return;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  });
}

function uniqueValues(data, key) {
  const set = new Set(data.map(row => row[key]).filter(Boolean));
  return [...set].sort();
}

function filterByPeriod(data, anio, mes) {
  let filtered = data;
  if (anio) filtered = filtered.filter(r => r.anio === parseInt(anio));
  if (mes) filtered = filtered.filter(r => r.mes === parseInt(mes));
  return filtered;
}

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function monthName(num) {
  return MONTH_NAMES[num] || '';
}

function groupBy(data, key) {
  const groups = {};
  data.forEach(row => {
    const k = row[key] || '(vacío)';
    if (!groups[k]) groups[k] = [];
    groups[k].push(row);
  });
  return groups;
}

function sumBy(data, key) {
  return data.reduce((sum, row) => sum + (row[key] || 0), 0);
}

function countDistinct(data, key) {
  return new Set(data.map(r => r[key]).filter(Boolean)).size;
}

function getFilterValues(sectionId) {
  const container = document.getElementById('section-' + sectionId);
  if (!container) return {};
  const selects = container.querySelectorAll('select');
  const values = {};
  selects.forEach(sel => {
    const key = sel.id || sel.name;
    if (key) values[key] = sel.value;
  });
  return values;
}

// Tab switching
function switchSection(name) {
  const sections = ['home', 'facturacion', 'produccion', 'proyeccion', 'sponsors'];
  sections.forEach(s => {
    const el = document.getElementById('section-' + s);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
}

// Table sorting
function makeSortable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const headers = table.querySelectorAll('th[data-sort]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr:not(.totals-row)'));
      const isNum = th.dataset.type === 'number';
      const currentDir = th.dataset.dir === 'asc' ? 'desc' : 'asc';

      headers.forEach(h => { h.dataset.dir = ''; h.classList.remove('sorted'); });
      th.dataset.dir = currentDir;
      th.classList.add('sorted');

      rows.sort((a, b) => {
        let aVal = a.querySelector(`td[data-col="${col}"]`)?.textContent || '';
        let bVal = b.querySelector(`td[data-col="${col}"]`)?.textContent || '';
        if (isNum) {
          aVal = parseFloat(aVal.replace(/[^0-9.\-]/g, '')) || 0;
          bVal = parseFloat(bVal.replace(/[^0-9.\-]/g, '')) || 0;
        }
        if (currentDir === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });

      const totalsRow = tbody.querySelector('.totals-row');
      rows.forEach(row => tbody.appendChild(row));
      if (totalsRow) tbody.appendChild(totalsRow);
    });
  });
}

// Pagination
function paginate(data, page, perPage = 20) {
  const start = (page - 1) * perPage;
  return {
    rows: data.slice(start, start + perPage),
    totalPages: Math.ceil(data.length / perPage),
    currentPage: page
  };
}

function renderPagination(containerId, totalPages, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = i === currentPage ? 'active' : '';
    btn.addEventListener('click', () => onPageChange(i));
    container.appendChild(btn);
  }
}

// Init dashboard — called after data loads
function initDashboard() {
  renderHome();
  renderFacturacion();
  renderProduccion();
  renderProyeccion();
  renderSponsors();
  switchSection('home');
}
