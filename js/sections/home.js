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
  const hastaNum = periodToNum(hasta.year, hasta.month);

  const monthsInRange = [];
  let y = desde.year, m = desde.month;
  while (periodToNum(y, m) <= hastaNum) {
    monthsInRange.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const N = monthsInRange.length;
  const N2 = N * 2;

  // Build x2 period
  const monthsX2 = [];
  y = desde.year;
  m = desde.month;
  for (let i = 0; i < N2; i++) {
    monthsX2.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const endX2 = monthsX2[monthsX2.length - 1];
  const desdeLabel = periodLabel(desde.year, desde.month);
  const hastaLabel = periodLabel(hasta.year, hasta.month);
  const hastaX2Label = periodLabel(endX2.year, endX2.month);

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

  // Define rows with how to get their values
  const rowDefs = [
    { label: 'Facturación Total GO UIC', type: 'fact', field: 'total', projKey: 'Facturación Total GO UIC', bold: true },
    { label: 'DISTRIBUCIÓN — GRUPO OROÑO', type: 'section' },
    { label: 'OH Instituciones GO — 13,14%', type: 'fact', field: 'overheadPct', projKey: 'OH Instituciones GO', indent: true },
    { label: 'GO ACE — UIC — 3,33%', type: 'fact', field: 'goUic', projKey: 'GO ACE', indent: true },
    { label: '→ TOTAL GO por año', type: 'calc', calc: (vals) => vals['ohInst'] + vals['goAce'], bold: true, calcKeys: ['ohInst', 'goAce'] },
    { label: 'COSTOS OPERATIVOS — GO ACE (UIC)', type: 'section' },
    { label: 'Sueldo Gerenta UIC', type: 'costo', concepto: 'Sueldo Gerenta', projKey: 'Sueldo Gerenta', indent: true },
    { label: 'Gastos operativos (8% retención UIC)', type: 'costo', concepto: 'Gastos operativos', projKey: 'Gastos operativos', indent: true },
    { label: 'Incentivo Director', type: 'costo', concepto: 'Incentivo Director', projKey: 'Incentivo Director', indent: true },
    { label: 'Total Costos UIC', type: 'costo', concepto: 'Total Costos UIC', projKey: 'Total Costos UIC', bold: true },
    { label: 'RESULTADO — GO ACE (UIC)', type: 'section' },
    { label: 'EBITDA UIC', type: 'calc', calc: (vals) => vals['goAce'] - vals['totalCostos'], bold: true, calcKeys: ['goAce', 'totalCostos'] },
    { label: 'Margen EBITDA', type: 'pct', calc: (vals) => vals['goAce'] > 0 ? (vals['ebitda'] / vals['goAce'] * 100) : 0, calcKeys: ['goAce', 'ebitda'] }
  ];

  // Internal keys for calc dependencies
  const keyMap = {
    'OH Instituciones GO — 13,14%': 'ohInst',
    'GO ACE — UIC — 3,33%': 'goAce',
    'Total Costos UIC': 'totalCostos',
    'EBITDA UIC': 'ebitda'
  };

  // Compute values for a set of months
  function computeColumn(months) {
    const vals = {};
    const results = [];

    rowDefs.forEach(row => {
      if (row.type === 'section') {
        results.push(null);
        return;
      }

      let value = 0;
      if (row.type === 'fact') {
        value = sumFactField(row.field, months);
      } else if (row.type === 'costo') {
        value = sumCostoConcepto(row.concepto, months);
      } else if (row.type === 'calc' || row.type === 'pct') {
        value = row.calc(vals);
      }

      const key = keyMap[row.label];
      if (key) vals[key] = value;

      results.push(value);
    });

    return results;
  }

  // Compute values per individual month
  function computeMonthColumn(year, month) {
    const vals = {};
    const results = [];

    rowDefs.forEach(row => {
      if (row.type === 'section') {
        results.push(null);
        return;
      }

      let value = 0;
      if (row.type === 'fact') {
        value = sumFactFieldMonth(row.field, year, month);
      } else if (row.type === 'costo') {
        value = sumCostoConceptoMonth(row.concepto, year, month);
      } else if (row.type === 'calc' || row.type === 'pct') {
        value = row.calc(vals);
      }

      const key = keyMap[row.label];
      if (key) vals[key] = value;

      results.push(value);
    });

    return results;
  }

  // Compute projection column for a set of months
  function computeProjColumn(months) {
    const vals = {};
    const results = [];

    rowDefs.forEach(row => {
      if (row.type === 'section') {
        results.push(null);
        return;
      }

      let value = 0;
      if (row.type === 'fact' || row.type === 'costo') {
        value = projForMonths(row.projKey, months);
      } else if (row.type === 'calc' || row.type === 'pct') {
        value = row.calc(vals);
      }

      const key = keyMap[row.label];
      if (key) vals[key] = value;

      results.push(value);
    });

    return results;
  }

  // Compute all columns
  const monthColumns = monthsInRange.map(({ year, month }) => ({
    label: periodLabel(year, month),
    values: computeMonthColumn(year, month)
  }));

  const realTotal = computeColumn(monthsInRange);
  const est6mRaw = realTotal.map(v => v === null ? null : v * 2);

  // Recalculate percentage rows from estimated values instead of doubling
  const est6m = est6mRaw.slice();
  const estVals = {};
  rowDefs.forEach((row, i) => {
    if (row.type === 'section') return;
    const key = keyMap[row.label];
    if (key) estVals[key] = est6m[i];
    if (row.type === 'pct') {
      est6m[i] = row.calc(estVals);
    }
  });

  const proy6m = computeProjColumn(monthsX2);
  const diff = est6m.map((v, i) => {
    if (v === null || proy6m[i] === null) return null;
    return v - proy6m[i];
  });

  // Build header
  const monthHeaders = monthColumns.map(c => `<th style="text-align:right;white-space:nowrap">${c.label}</th>`).join('');

  // Build rows
  const tableRows = rowDefs.map((row, i) => {
    if (row.type === 'section') {
      const colSpan = monthColumns.length + 4;
      return `<tr style="background:#f0f4f8"><td colspan="${colSpan}" style="font-weight:700;color:var(--go-primary);padding:0.5rem 1rem;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.03em">${row.label}</td></tr>`;
    }

    const isPct = row.type === 'pct';
    const fmt = isPct ? (v => v.toFixed(1) + '%') : formatUSD;
    const style = row.bold ? 'font-weight:700' : '';
    const indent = row.indent ? 'padding-left:2rem' : 'padding-left:1rem';

    const monthCells = monthColumns.map(c => `<td style="text-align:right">${fmt(c.values[i])}</td>`).join('');

    const diffVal = diff[i];
    const diffColor = isPct ? '' : (diffVal >= 0 ? 'color:var(--go-success)' : 'color:var(--go-error)');
    const diffPrefix = (!isPct && diffVal >= 0) ? '+' : '';

    return `<tr style="${style}">
      <td style="${indent};white-space:nowrap">${row.label}</td>
      ${monthCells}
      <td style="text-align:right;font-weight:600">${fmt(est6m[i])}</td>
      <td style="text-align:right">${fmt(proy6m[i])}</td>
      <td style="text-align:right;font-weight:600;${diffColor}">${diffPrefix}${fmt(diffVal)}</td>
    </tr>`;
  }).join('');

  document.getElementById('home-summary-table').innerHTML = `
    <table class="data-table" style="min-width:700px">
      <thead>
        <tr>
          <th style="position:sticky;left:0;background:#f9fafb;z-index:2">Concepto</th>
          ${monthHeaders}
          <th style="text-align:right;white-space:nowrap">${N2}m Est.<br><span style="font-weight:400;font-size:0.7rem">${desdeLabel}—${hastaX2Label}</span></th>
          <th style="text-align:right;white-space:nowrap">${N2}m Proy.<br><span style="font-weight:400;font-size:0.7rem">${desdeLabel}—${hastaX2Label}</span></th>
          <th style="text-align:right;white-space:nowrap">Diferencia<br><span style="font-weight:400;font-size:0.7rem">Est. vs Proy.</span></th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}
