/**
 * UBIX Dashboard Page
 */

window.DashboardPage = {
  async render(container) {
    const res = await API.get('/stats');
    if (!res.success) throw new Error('Failed to load stats');
    
    const stats = res.data;

    container.innerHTML = `
      <div class="page-header">
        <h1>Platform Overview</h1>
        <p>Unified Business Identity & Activity Intelligence metrics</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon" style="color: var(--accent-blue)">🏢</div>
          <div class="kpi-info">
            <div class="kpi-value animate-count">${stats.ubids.toLocaleString()}</div>
            <div class="kpi-label">Unique UBIDs</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="color: var(--accent-emerald)">🟢</div>
          <div class="kpi-info">
            <div class="kpi-value animate-count">${stats.active_businesses.toLocaleString()}</div>
            <div class="kpi-label">Active Businesses</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="color: var(--accent-amber)">📋</div>
          <div class="kpi-info">
            <div class="kpi-value animate-count">${stats.source_records.toLocaleString()}</div>
            <div class="kpi-label">Source Records</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="color: var(--accent-purple)">⚠️</div>
          <div class="kpi-info">
            <div class="kpi-value animate-count">${stats.pending_reviews.toLocaleString()}</div>
            <div class="kpi-label">Pending Reviews</div>
          </div>
        </div>
      </div>

      <div class="grid-2 mt-24">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Department Coverage</h2>
          </div>
          <div class="chart-container">
            <canvas id="deptChart"></canvas>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Data Quality Pipeline</h2>
          </div>
          <div class="signal-list mt-16">
            <div class="signal-item">
              <div class="signal-type">Raw Sources</div>
              <div class="signal-explanation">Total records from ${stats.departments} departments</div>
              <div class="signal-score">${stats.source_records.toLocaleString()}</div>
            </div>
            <div class="signal-item">
              <div class="signal-type">Normalized</div>
              <div class="signal-explanation">Cleaned and standardized records</div>
              <div class="signal-score">${stats.normalized_records.toLocaleString()}</div>
            </div>
            <div class="signal-item">
              <div class="signal-type">Resolved</div>
              <div class="signal-explanation">Merged into unique business entities</div>
              <div class="signal-score">${stats.ubids.toLocaleString()}</div>
            </div>
          </div>

          <h3 class="font-mono text-sm text-muted mt-24 mb-16">IDENTIFIER COMPLETENESS</h3>
          <div class="mb-16">
            <div class="flex-between text-sm mb-8">
              <span>PAN Provided</span>
              <span class="font-mono">${Math.round((stats.records_with_pan / Math.max(1, stats.source_records)) * 100)}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(stats.records_with_pan / Math.max(1, stats.source_records)) * 100}%"></div>
            </div>
          </div>
          <div>
            <div class="flex-between text-sm mb-8">
              <span>GSTIN Provided</span>
              <span class="font-mono">${Math.round((stats.records_with_gstin / Math.max(1, stats.source_records)) * 100)}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(stats.records_with_gstin / Math.max(1, stats.source_records)) * 100}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render chart
    setTimeout(() => {
      const depts = stats.department_breakdown.slice(0, 6);
      if (stats.department_breakdown.length > 6) {
        const othersCount = stats.department_breakdown.slice(6).reduce((sum, d) => sum + d.record_count, 0);
        depts.push({ code: 'Others', record_count: othersCount });
      }

      createChart('deptChart', {
        type: 'doughnut',
        data: {
          labels: depts.map(d => d.code),
          datasets: [{
            data: depts.map(d => d.record_count),
            backgroundColor: [
              '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#64748b'
            ],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }, 100);
  }
};
