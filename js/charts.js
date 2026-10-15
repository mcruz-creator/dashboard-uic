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

const chartInstances = {};

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
  backgroundColor: 'rgba(0,0,0,0.8)',
  titleFont: { family: 'Inter', size: 13 },
  bodyFont: { family: 'Inter', size: 12 },
  padding: 10,
  cornerRadius: 8
};

const defaultScales = {
  x: {
    grid: { display: false },
    ticks: { font: { family: 'Inter', size: 11 } }
  },
  y: {
    grid: { color: '#f3f4f6' },
    ticks: { font: { family: 'Inter', size: 11 } }
  }
};

function createBarChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: defaultTooltip,
        legend: { display: datasets.length > 1, labels: { font: { family: 'Inter' } } }
      },
      scales: {
        ...defaultScales,
        ...(options.horizontal ? {
          x: { ...defaultScales.y, beginAtZero: true },
          y: { ...defaultScales.x }
        } : {
          y: { ...defaultScales.y, beginAtZero: true }
        })
      },
      indexAxis: options.horizontal ? 'y' : 'x',
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createLineChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: defaultTooltip, legend: { labels: { font: { family: 'Inter' } } } },
      scales: { ...defaultScales, y: { ...defaultScales.y, beginAtZero: true } },
      ...options
    }
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function createDoughnutChart(canvasId, labels, data, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
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
  const ctx = document.getElementById(canvasId).getContext('2d');
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
