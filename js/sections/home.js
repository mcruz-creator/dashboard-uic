const PERIOD_START = { year: 2026, month: 7 };

const MONTH_ABBR_REV = {
  'ene':1,'feb':2,'mar':3,'abr':4,'may':5,'jun':6,
  'jul':7,'ago':8,'sep':9,'oct':10,'nov':11,'dic':12
};

function buildPeriodOptions() {
  const options = [];
  const dataYears = uniqueValues(UIC_DATA.facturacion, 'anio');
  const projYears = Object.keys(UIC_DATA.proyeccion['Facturación Total GO UIC'] || {})
    .filter(k => k !== 'total').map(Number);
  const allYears = [...new Set([...dataYears, ...projYears])].sort();

  allYears.forEach(y => {
    for (let m = 1; m <= 12; m++) {
      if (periodToNum(y, m) < periodToNum(PERIOD_START.year, PERIOD_START.month)) continue;
      options.push({ value: `${y}-${m}`, year: y, month: m, label: `${monthName(m).substring(0, 3)}-${String(y).slice(-2)}` });
    }
  });
  return options;
}

function parsePeriod(val) {
  const [y, m] = val.split('-').map(Number);
  return { year: y, month: m };
}

function periodToNum(y, m) {
  return y * 100 + m;
}

function periodLabel(year, month) {
  return `${monthName(month).substring(0, 3)}-${String(year).slice(-2)}`;
}

function renderHome() {
  const container = document.getElementById('section-home');
  const periods = buildPeriodOptions();

  container.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label>Desde</label>
        <select id="home-desde" class="filter-select" onchange="updateHome()"></select>
      </div>
      <div class="filter-group">
        <label>Hasta</label>
        <select id="home-hasta" class="filter-select" onchange="updateHome()"></select>
      </div>
      <div class="filter-group">
        <label>Proyección</label>
        <select id="home-proyeccion" class="filter-select" onchange="updateHome()">
          <option value="si" selected>Sí</option>
          <option value="no">No</option>
        </select>
      </div>
    </div>
    <div class="data-table-wrapper" style="overflow-x:auto" id="home-summary-table"></div>
  `;

  const desdeSelect = document.getElementById('home-desde');
  const hastaSelect = document.getElementById('home-hasta');

  periods.forEach(p => {
    desdeSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
    hastaSelect.innerHTML += `<option value="${p.value}">${p.label}</option>`;
  });

  const defaultDesde = periods.find(p => p.year === 2026 && p.month === 7);
  if (defaultDesde) desdeSelect.value = defaultDesde.value;

  const realMonths = UIC_DATA.facturacion
    .map(r => ({ year: r.anio, month: r.mes }))
    .filter(r => r.year && r.month);
  if (realMonths.length > 0) {
    const lastReal = realMonths.sort((a, b) => periodToNum(b.year, b.month) - periodToNum(a.year, a.month))[0];
    const lastOpt = periods.find(p => p.year === lastReal.year && p.month === lastReal.month);
    if (lastOpt) hastaSelect.value = lastOpt.value;
  } else {
    hastaSelect.value = periods[periods.length - 1].value;
  }

  updateHome();
}

function updateHome() {
  const desde = parsePeriod(document.getElementById('home-desde').value);
  const hasta = parsePeriod(document.getElementById('home-hasta').value);
  const proySi = document.getElementById('home-proyeccion').value === 'si';
  const hastaNum = periodToNum(hasta.year, hasta.month);

  const monthsInRange = [];
  let y = desde.year, m = desde.month;
  while (periodToNum(y, m) <= hastaNum) {
    monthsInRange.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const N = monthsInRange.length;

  // Helpers
  function sumFactField(field, months) {
    return months.reduce((s, { year, month }) => {
      const rows = UIC_DATA.facturacion.filter(r => r.anio === year && r.mes === month);
      return s + rows.reduce((s2, r) => s2 + (r[field] || 0), 0);
    }, 0);
  }

  function sumFactFieldMonth(field, year, month) {
    const rows = UIC_DATA.facturacion.filter(r => r.anio === year && r.mes === month);
    return rows.reduce((s, r) => s + (r[field] || 0), 0);
  }

  // Ingresos extraordinarios de instituciones (USD): solo existen como dato real, no hay proyección
  function sumExtra(months) {
    return months.reduce((s, { year, month }) => s + UIC_DATA.extraordinarios
      .filter(e => e.anio === year && e.mes === month)
      .reduce((s2, e) => s2 + e.usd, 0), 0);
  }

  function sumCostoConcepto(concepto, months) {
    return months.reduce((s, { year, month }) => {
      return s + UIC_DATA.costosReales
        .filter(c => c.anio === year && c.mes === month && c.concepto === concepto)
        .reduce((s2, c) => s2 + c.total, 0);
    }, 0);
  }

  function sumCostoConceptoMonth(concepto, year, month) {
    return UIC_DATA.costosReales
      .filter(c => c.anio === year && c.mes === month && c.concepto === concepto)
      .reduce((s, c) => s + c.total, 0);
  }

  function projForMonths(key, months) {
    return months.reduce((s, { year }) => {
      const data = UIC_DATA.proyeccion[key] || {};
      return s + (data[year] || 0) / 12;
    }, 0);
  }

  // Define rows
  const rowDefs = [
    { label: 'Facturación Total GO UIC', type: 'fact', field: 'total', projKey: 'Facturación Total GO UIC', bold: true },
    { label: 'DISTRIBUCIÓN — GRUPO OROÑO', type: 'section' },
    { label: 'OH Instituciones GO', type: 'fact', field: 'overheadPct', projKey: 'OH Instituciones GO', indent: true },
    { label: 'Ingresos Extraordinarios Inst.', type: 'extra', soloReal: true, indent: true },
    { label: 'GO ACE — UIC', type: 'fact', field: 'goUic', projKey: 'GO ACE', indent: true },
    { label: 'TOTAL GO', type: 'calc', calc: (vals) => vals['ohInst'] + (vals['extra'] || 0) + vals['goAce'], bold: true, calcKeys: ['ohInst', 'extra', 'goAce'] },
    { label: 'COSTOS OPERATIVOS — GO ACE (UIC)', type: 'section' },
    { label: 'Sueldo Gerenta UIC', type: 'costo', concepto: 'Sueldo Gerenta', projKey: 'Sueldo Gerenta', indent: true },
    { label: 'Gastos operativos', type: 'costo', concepto: 'Gastos operativos', projKey: 'Gastos operativos', indent: true },
    { label: 'Incentivo Director', type: 'costo', concepto: 'Incentivo Director', projKey: 'Incentivo Director', indent: true },
    { label: 'Total Costos UIC', type: 'costo', concepto: 'Total Costos UIC', projKey: 'Total Costos UIC', bold: true },
    { label: 'RESULTADO — GO ACE (UIC)', type: 'section' },
    { label: 'EBITDA UIC', type: 'calc', calc: (vals) => vals['goAce'] - vals['totalCostos'], bold: true, calcKeys: ['goAce', 'totalCostos'] },
    { label: 'Margen EBITDA', type: 'pct', calc: (vals) => vals['goAce'] > 0 ? (vals['ebitda'] / vals['goAce'] * 100) : 0, calcKeys: ['goAce', 'ebitda'] }
  ];

  const keyMap = {
    'OH Instituciones GO': 'ohInst',
    'Ingresos Extraordinarios Inst.': 'extra',
    'GO ACE — UIC': 'goAce',
    'Total Costos UIC': 'totalCostos',
    'EBITDA UIC': 'ebitda'
  };

  function computeColumn(months) {
    const vals = {};
    const results = [];
    rowDefs.forEach(row => {
      if (row.type === 'section') { results.push(null); return; }
      let value = 0;
      if (row.type === 'fact') value = sumFactField(row.field, months);
      else if (row.type === 'extra') value = sumExtra(months);
      else if (row.type === 'costo') value = sumCostoConcepto(row.concepto, months);
      else if (row.type === 'calc' || row.type === 'pct') value = row.calc(vals);
      const key = keyMap[row.label];
      if (key) vals[key] = value;
      results.push(value);
    });
    return results;
  }

  function computeMonthColumn(year, month) {
    const vals = {};
    const results = [];
    rowDefs.forEach(row => {
      if (row.type === 'section') { results.push(null); return; }
      let value = 0;
      if (row.type === 'fact') value = sumFactFieldMonth(row.field, year, month);
      else if (row.type === 'extra') value = sumExtra([{ year, month }]);
      else if (row.type === 'costo') value = sumCostoConceptoMonth(row.concepto, year, month);
      else if (row.type === 'calc' || row.type === 'pct') value = row.calc(vals);
      const key = keyMap[row.label];
      if (key) vals[key] = value;
      results.push(value);
    });
    return results;
  }

  function computeProjColumn(months) {
    const vals = {};
    const results = [];
    rowDefs.forEach(row => {
      if (row.type === 'section') { results.push(null); return; }
      // Sin proyección para los extraordinarios: no suman al TOTAL GO proyectado
      if (row.soloReal) { vals[keyMap[row.label]] = 0; results.push(null); return; }
      let value = 0;
      if (row.type === 'fact' || row.type === 'costo') value = projForMonths(row.projKey, months);
      else if (row.type === 'calc' || row.type === 'pct') value = row.calc(vals);
      const key = keyMap[row.label];
      if (key) vals[key] = value;
      results.push(value);
    });
    return results;
  }

  // Per-month columns (always shown)
  const monthColumns = monthsInRange.map(({ year, month }) => ({
    label: periodLabel(year, month),
    values: computeMonthColumn(year, month)
  }));

  const realTotal = computeColumn(monthsInRange);
  const desdeLabel = periodLabel(desde.year, desde.month);
  const hastaLabel = periodLabel(hasta.year, hasta.month);

  let compReal, compProy, compMonths, compLabel, compRealHeader, compProyHeader;

  if (proySi) {
    // Sí: estimate 2N months (real x2), project 2N months
    const N2 = N * 2;
    const monthsX2 = [];
    y = desde.year; m = desde.month;
    for (let i = 0; i < N2; i++) {
      monthsX2.push({ year: y, month: m });
      m++; if (m > 12) { m = 1; y++; }
    }
    const endX2 = monthsX2[monthsX2.length - 1];
    const hastaX2Label = periodLabel(endX2.year, endX2.month);

    const est6mRaw = realTotal.map(v => v === null ? null : v * 2);
    const est6m = est6mRaw.slice();
    const estVals = {};
    rowDefs.forEach((row, i) => {
      if (row.type === 'section') return;
      const key = keyMap[row.label];
      if (key) estVals[key] = est6m[i];
      if (row.type === 'pct') est6m[i] = row.calc(estVals);
    });

    compReal = est6m;
    compProy = computeProjColumn(monthsX2);
    compRealHeader = `${N2}m Est.<br><span style="font-weight:400;font-size:0.7rem">${desdeLabel}—${hastaX2Label}</span>`;
    compProyHeader = `${N2}m Proy.<br><span style="font-weight:400;font-size:0.7rem">${desdeLabel}—${hastaX2Label}</span>`;
  } else {
    // No: real N months vs projected N months (same period, respecting year boundaries)
    compReal = realTotal;
    compProy = computeProjColumn(monthsInRange);
    compRealHeader = `${N}m Real<br><span style="font-weight:400;font-size:0.7rem">${desdeLabel}—${hastaLabel}</span>`;
    compProyHeader = `${N}m Proy.<br><span style="font-weight:400;font-size:0.7rem">${desdeLabel}—${hastaLabel}</span>`;
  }

  const diff = compReal.map((v, i) => {
    if (v === null || compProy[i] === null) return null;
    return v - compProy[i];
  });

  // Build header
  const monthHeaders = monthColumns.map(c => `<th style="text-align:right;white-space:nowrap">${c.label}</th>`).join('');
  const diffSubLabel = proySi ? 'Est. vs Proy.' : 'Real vs Proy.';

  // Build rows
  const tableRows = rowDefs.map((row, i) => {
    if (row.type === 'section') {
      const colSpan = monthColumns.length + 5;
      return `<tr style="background:#f0f4f8"><td colspan="${colSpan}" style="font-weight:700;color:var(--go-primary);padding:0.5rem 1rem;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.03em">${row.label}</td></tr>`;
    }

    const isPct = row.type === 'pct';
    const fmt = isPct ? (v => v.toFixed(1) + '%') : formatUSD;
    const style = row.bold ? 'font-weight:700' : '';
    const indent = row.indent ? 'padding-left:2rem' : 'padding-left:1rem';

    const monthCells = monthColumns.map(c => `<td style="text-align:right">${fmt(c.values[i])}</td>`).join('');

    if (row.soloReal) {
      const dash = '<td style="text-align:right;color:#9ca3af">—</td>';
      return `<tr style="${style}">
      <td style="${indent};white-space:nowrap">${row.label}</td>
      ${monthCells}
      <td style="text-align:right;font-weight:600">${fmt(compReal[i])}</td>
      ${dash}${dash}${dash}
    </tr>`;
    }

    const diffVal = diff[i];
    const diffColor = isPct ? '' : (diffVal >= 0 ? 'color:var(--go-success)' : 'color:var(--go-error)');
    const diffPrefix = (!isPct && diffVal >= 0) ? '+' : '';

    const proyVal = compProy[i];
    const varPct = (proyVal && proyVal !== 0 && !isPct) ? ((compReal[i] - proyVal) / Math.abs(proyVal) * 100) : null;
    const varColor = varPct !== null ? (varPct >= 0 ? 'color:var(--go-success)' : 'color:var(--go-error)') : '';
    const varText = varPct !== null ? ((varPct >= 0 ? '+' : '') + varPct.toFixed(1) + '%') : '—';

    return `<tr style="${style}">
      <td style="${indent};white-space:nowrap">${row.label}</td>
      ${monthCells}
      <td style="text-align:right;font-weight:600">${fmt(compReal[i])}</td>
      <td style="text-align:right">${fmt(compProy[i])}</td>
      <td style="text-align:right;font-weight:600;${diffColor}">${diffPrefix}${fmt(diffVal)}</td>
      <td style="text-align:right;font-weight:600;${varColor}">${varText}</td>
    </tr>`;
  }).join('');

  document.getElementById('home-summary-table').innerHTML = `
    <table class="data-table" style="min-width:700px">
      <thead>
        <tr>
          <th style="position:sticky;left:0;background:#f9fafb;z-index:2">Concepto</th>
          ${monthHeaders}
          <th style="text-align:right;white-space:nowrap">${compRealHeader}</th>
          <th style="text-align:right;white-space:nowrap">${compProyHeader}</th>
          <th style="text-align:right;white-space:nowrap">Diferencia<br><span style="font-weight:400;font-size:0.7rem">${diffSubLabel}</span></th>
          <th style="text-align:right;white-space:nowrap">Var. %<br><span style="font-weight:400;font-size:0.7rem">${diffSubLabel}</span></th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}
