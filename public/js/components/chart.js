/** Chart helpers using Chart.js CDN */
(function() {
  // Load Chart.js from CDN
  if (!document.querySelector('script[src*="chart.js"]')) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
    document.head.appendChild(script);
  }
})();

function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  // Destroy existing chart
  if (canvas._chart) canvas._chart.destroy();
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    ...config,
    options: {
      ...config.options,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...config.options?.plugins,
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }, ...config.options?.plugins?.legend },
      },
      scales: config.type === 'doughnut' || config.type === 'pie' ? undefined : {
        x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: '#1e293b' }, ...config.options?.scales?.x },
        y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: '#1e293b' }, ...config.options?.scales?.y },
        ...config.options?.scales,
      },
    },
  });
  canvas._chart = chart;
  return chart;
}
