/**
 * UBIX Data Ingestion Page
 */

window.IngestionPage = {
  async render(container) {
    const res = await API.get('/departments');
    if (!res.success) throw new Error('Failed to load departments');
    
    const departments = res.data;

    container.innerHTML = `
      <div class="flex-between mb-24">
        <div class="page-header" style="margin-bottom:0">
          <h1>Data Ingestion</h1>
          <p>Connect and normalize source department data</p>
        </div>
        <div class="flex gap-12">
          <button class="btn btn-outline" onclick="IngestionPage.loadRecords()">Refresh View</button>
          <button class="btn btn-primary" onclick="IngestionPage.normalizeAll()" id="btn-normalize">
            <span>⚙️</span> Normalize Data
          </button>
        </div>
      </div>

      <div class="grid-auto mb-24">
        ${departments.map(d => `
          <div class="card" style="padding: 16px;">
            <div class="flex-between mb-8">
              <span class="font-mono text-sm text-muted">${d.code}</span>
              <span class="badge ${d.record_count > 0 ? 'badge-active' : 'badge-unknown'}">${d.record_count.toLocaleString()} records</span>
            </div>
            <div class="card-title" style="font-size: 14px;">${d.name}</div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Source Records Explorer</h2>
          <input type="text" id="search-input" placeholder="Search name, PAN, GSTIN..." 
            style="padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-elevated); color: white; width: 300px;">
        </div>
        <div class="table-container">
          <table id="records-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Department</th>
                <th>Business Name</th>
                <th>PAN / GSTIN</th>
                <th>District</th>
                <th>Ingested At</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="6" class="text-center">Loading records...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="flex-between mt-16 text-sm text-muted">
          <span id="record-stats">Showing 0 of 0 records</span>
        </div>
      </div>
    `;

    // Add search listener
    document.getElementById('search-input').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        this.loadRecords(e.target.value);
      }
    });

    await this.loadRecords();
  },

  async loadRecords(search = '') {
    const tbody = document.querySelector('#records-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner" style="margin: 20px auto"></div></td></tr>';
    
    try {
      const url = search ? `/records?search=${encodeURIComponent(search)}&limit=20` : `/records?limit=20`;
      const res = await API.get(url);
      
      if (res.success && res.data.length > 0) {
        tbody.innerHTML = res.data.map(r => `
          <tr>
            <td class="mono">SRC-${r.id}</td>
            <td><span class="badge badge-unknown">${r.department_code}</span></td>
            <td class="font-medium">${r.business_name}</td>
            <td class="mono">
              <div style="margin-bottom: 4px;">${r.pan ? '🟩 ' + r.pan : '<span class="text-muted">No PAN</span>'}</div>
              <div>${r.gstin ? '🟦 ' + r.gstin : '<span class="text-muted">No GSTIN</span>'}</div>
            </td>
            <td>${r.district || '-'}</td>
            <td class="mono text-muted">${new Date(r.ingested_at).toISOString().split('T')[0]}</td>
          </tr>
        `).join('');
        document.getElementById('record-stats').textContent = `Showing top ${res.data.length} of ${res.total.toLocaleString()} records`;
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No records found.</td></tr>';
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-red">Error loading records: ${e.message}</td></tr>`;
    }
  },

  async normalizeAll() {
    const btn = document.getElementById('btn-normalize');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Normalizing...';
    
    try {
      const res = await API.post('/ingest/normalize');
      if (res.success) {
        showToast(`Successfully normalized ${res.count} records`, 'success');
      } else {
        showToast(res.error || 'Normalization failed', 'error');
      }
    } catch (e) {
      showToast('Error connecting to server', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>⚙️</span> Normalize Data';
    }
  }
};
