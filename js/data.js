// Google Sheets CSV URLs — replace GID with actual sheet GID after publishing
const SHEET_URLS = {
  // Format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=csv&gid=GID
  facturacion: 'PLACEHOLDER_FACTURACION_URL',
  produccion: 'PLACEHOLDER_PRODUCCION_URL',
  proyeccion: 'PLACEHOLDER_PROYECCION_URL'
};

const UIC_DATA = {
  facturacion: [],
  produccion: [],
  proyeccion: {},
  loaded: false
};

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeString(val) {
  if (!val) return '';
  return String(val).trim();
}

function parseFacturacion(results) {
  return results.data
    .filter(row => row['Protocolo'] && row['Protocolo'].trim())
    .map(row => ({
      centro: normalizeString(row['Centro']),
      protocolo: normalizeString(row['Protocolo']),
      visitas: parseNumber(row['Visitas']),
      moneda: normalizeString(row['Moneda']),
      honorarios: parseNumber(row['Honorarios']),
      overhead: parseNumber(row['Over Head']),
      total: parseNumber(row['Total']),
      promedioVisita: parseNumber(row['Promedio']),
      overheadPct: parseNumber(row['Over Head.1'] || row['Over Head_1']),
      goUic: parseNumber(row['Go UIC'] || row['GO UIC']),
      fase: normalizeString(row['Fase']),
      ip: normalizeString(row['IP']),
      especialidad: normalizeString(row['Especialidad']),
      tipo: normalizeString(row['Tipo']),
      fechaFact: normalizeString(row['Fecha Fact']),
      tipoFact: normalizeString(row['Tipo Fact']),
      numeroFact: normalizeString(row['Numero Fact']),
      mes: parseNumber(row['Mes']),
      anio: parseNumber(row['Año'] || row['Ano']),
      cobrado: normalizeString(row['Cobrado'])
    }));
}

function parseProduccion(results) {
  return results.data
    .filter(row => row['Protocolo'] && row['Protocolo'].trim())
    .map(row => ({
      protocolo: normalizeString(row['Protocolo']),
      visita: normalizeString(row['Visita']),
      screening: normalizeString(row['Screening']),
      paciente: normalizeString(row['Paciente']),
      tipoVisita: normalizeString(row['Tipo Visita']),
      asistencia: normalizeString(row['Asistencia']),
      atendido: normalizeString(row['Atendido']),
      cumplimientoTurno: normalizeString(row['Cumplimiento Turno']),
      responsable: normalizeString(row['Responsable Cumplimiento']),
      lugarTurno: normalizeString(row['Lugar Turno']),
      fechaTurno: normalizeString(row['Fecha del Turno']),
      horaTurno: normalizeString(row['Hora del Turno']),
      estadoHC: normalizeString(row['Estado HC']),
      firmante: normalizeString(row['Firmante']),
      fechaFirma: normalizeString(row['Fecha Firma']),
      publicada: normalizeString(row['Publicada']),
      monitoreada: normalizeString(row['Monitoreada']),
      patrocinador: normalizeString(row['Patrocinador']),
      cro: normalizeString(row['CRO']),
      ip: normalizeString(row['Investigador Principal']),
      tipoAtencion: normalizeString(row['Tipo de Atención'] || row['Tipo de Atencion']),
      fases: normalizeString(row['Fases']),
      especialidades: normalizeString(row['Especialidades']),
      mes: parseNumber(row['Mes']),
      anio: parseNumber(row['Año'] || row['Ano'])
    }));
}

function parseProyeccion(results) {
  const proy = {};
  const years = [];

  // Find the header row that contains year numbers (2026, 2027, ...)
  const headerRow = results.data.find(row => {
    const vals = Object.values(row);
    return vals.some(v => String(v).match(/^2026/));
  });

  if (!headerRow) return proy;

  // Extract year columns
  const keys = Object.keys(headerRow);
  keys.forEach(k => {
    const val = parseNumber(headerRow[k]);
    if (val >= 2026 && val <= 2035) {
      years.push({ key: k, year: val });
    }
  });

  // Find the indicator column (usually second column)
  const indicatorKey = keys.find(k => {
    const vals = results.data.map(r => normalizeString(r[k]));
    return vals.some(v => v.includes('Protocolos activos'));
  }) || keys[1];

  // Parse each indicator row
  // Ordered so longer/more specific names come before names they contain
  // (e.g. 'EBITDA UIC acumulado' and 'Margen EBITDA' before 'EBITDA UIC')
  const indicatorNames = [
    'EBITDA UIC acumulado',
    'Margen EBITDA',
    'EBITDA UIC',
    'Facturación Total GO UIC',
    'Protocolos activos',
    'Visitas realizadas',
    'Visitas/protocolo',
    'Ticket promedio',
    'OH Instituciones GO',
    'Total Costos UIC',
    'Sueldo Gerenta',
    'Gastos operativos',
    'Incentivo Director',
    'GO ACE'
  ];

  results.data.forEach(row => {
    const indicator = normalizeString(row[indicatorKey]);
    if (!indicator) return;

    const matchedName = indicatorNames.find(name =>
      indicator.toLowerCase().includes(name.toLowerCase())
    );
    if (!matchedName) return;

    const yearData = {};
    years.forEach(({ key, year }) => {
      yearData[year] = parseNumber(row[key]);
    });

    // Also grab TOTAL 10A if present
    const totalKey = keys.find(k =>
      normalizeString(headerRow[k]).toUpperCase().includes('TOTAL')
    );
    if (totalKey) {
      yearData.total = parseNumber(row[totalKey]);
    }

    proy[matchedName] = yearData;
  });

  return proy;
}

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject
    });
  });
}

async function loadAllData() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('error').classList.add('hidden');
  document.getElementById('content').classList.add('hidden');

  try {
    const [factResult, prodResult, proyResult] = await Promise.all([
      fetchCSV(SHEET_URLS.facturacion),
      fetchCSV(SHEET_URLS.produccion),
      fetchCSV(SHEET_URLS.proyeccion)
    ]);

    UIC_DATA.facturacion = parseFacturacion(factResult);
    UIC_DATA.produccion = parseProduccion(prodResult);
    UIC_DATA.proyeccion = parseProyeccion(proyResult);
    UIC_DATA.loaded = true;

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');

    initDashboard();
  } catch (err) {
    console.error('Error loading data:', err);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
  }
}
