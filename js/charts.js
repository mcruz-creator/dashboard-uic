const GO_COLORS = {
  primary: '#003366',
  primaryLight: '#0059b3',
  secondary: '#00874e',
  gray: '#9ca3af',
  grayLight: 'rgba(156, 163, 175, 0.3)',
  palette: [
    '#003366', '#00874e', '#0059b3', '#f59e0b',
    '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899',
    '#84cc16', '#f97316'
  ]
};

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = 'Inter, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#4b5563';
}

const chartInstances = {};

function formatAxisUSD(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(v);
}

function shortLabel(label, max = 26) {
  const s = String(label);
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

const defaultLegend = {
  position: 'top',
  align: 'start',
  labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { family: 'Inter', size: 12 } }
};

function destroyChart(canvasId) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
}

function formatUSD(num) {
  if (num === null || num === undefined) return 'USD 0';
  return 'USD ' + Math.round(num).toLocaleString('en-US');
}

function formatPct(num) {
  if (num === null || num === undefined) return '0.0%';
  return (num * 100).toFixed(1) + '%';
}

function formatPctRaw(num) {
  if (num === null || num === undefined) return '0.0%';
  return num.toFixed(1) + '%';
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Math.round(num).toLocaleString('en-US');
}

const defaultTooltip = {
  backgroundColor: 'rgba(0,31,63,0.92)',
  titleFont: { family: 'Inter', size: 13, weight: '600' },
  bodyFont: { family: 'Inter', size: 12 },
  footerFont: { family: 'Inter', size: 12, weight: '600' },
  padding: 12,
  cornerRadius: 8,
  boxPadding: 4,
  usePointStyle: true
};

const defaultScales = {
  x: {
    grid: { display: false },
    border: { color: '#e5e7eb' },
    ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280' }
  },
  y: {
    grid: { color: '#eef0f3' },
    border: { display: false },
    ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', padding: 6 }
  }
};

function createBarChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const ctx = el.getContext('2d');
  const { horizontal, ...restOpts } = options;
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(ds => ({ borderRadius: 4, maxBarThickness: horizontal ? 22 : 38, borderSkipped: false, ...ds }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 8 } },
      plugins: {
        tooltip: defaultTooltip,
        legend: { display: datasets.length > 1, ...defaultLegend }
      },
      scales: {
        ...defaultScales,
        ...(horizontal ? {
          x: { ...defaultScales.y, beginAtZero: true },
          y: { ...defaultScales.x }
        } : {
          y: { ...defaultScales.y, beginAtZero: true }
        })
      },
      indexAxis: horizontal ? 'y' : 'x',
      ...restOpts
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createLineChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const ctx = el.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(ds => ({ borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2, ...ds }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 8 } },
      plugins: { tooltip: defaultTooltip, legend: { ...defaultLegend } },
      scales: { ...defaultScales, y: { ...defaultScales.y, beginAtZero: true } },
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createDoughnutChart(canvasId, labels, data, options = {}) {
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const ctx = el.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: GO_COLORS.palette.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: defaultTooltip,
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, padding: 12 } }
      },
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createComboChart(canvasId, labels, barDatasets, lineDatasets, options = {}) {
  destroyChart(canvasId);
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const ctx = el.getContext('2d');
  const allDatasets = [
    ...barDatasets.map(ds => ({ ...ds, type: 'bar', yAxisID: 'y' })),
    ...lineDatasets.map(ds => ({ ...ds, type: 'line', yAxisID: 'y1', fill: false, tension: 0.3 }))
  ];
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: allDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: defaultTooltip, legend: { labels: { font: { family: 'Inter' } } } },
      scales: {
        x: defaultScales.x,
        y: { ...defaultScales.y, beginAtZero: true, position: 'left' },
        y1: {
          ...defaultScales.y,
          beginAtZero: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            callback: function(value) { return value.toFixed(0) + '%'; },
            font: { family: 'Inter', size: 11 }
          }
        }
      },
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}
