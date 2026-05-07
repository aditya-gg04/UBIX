/**
 * UBIX Entity Resolution Page
 */

window.ResolutionPage = {
  async render(container) {
    container.innerHTML = `
      <div class="flex-between mb-24">
        <div class="page-header" style="margin-bottom:0">
          <h1>Entity Resolution</h1>
          <p>Multi-layer matching pipeline and UBID registry</p>
        </div>
        <button class="btn btn-primary" onclick="ResolutionPage.runPipeline()" id="btn-pipeline">
          <span>🚀</span> Run Resolution Pipeline
        </button>
      </div>

      <div class="card mb-24">
        <div class="card-header">
          <h2 class="card-title">UBID Registry</h2>
          <input type="text" id="search-ubid" placeholder="Search by name, PAN, UBID..." 
            style="padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-elevated); color: white; width: 300px;">
        </div>
        <div class="table-container">
          <table id="ubid-table">
            <thead>
              <tr>
                <th>UBID</th>
                <th>Primary Name</th>
                <th>Primary PAN</th>
                <th>Records</th>
                <th>Depts</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="8" class="text-center">Loading UBIDs...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="flex-between mt-16 text-sm text-muted">
          <span id="ubid-stats">Showing 0 of 0 UBIDs</span>
        </div>
      </div>
    `;

    document.getElementById('search-ubid').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.loadUBIDs(e.target.value);
    });

    await this.loadUBIDs();
  },

  async loadUBIDs(search = '') {
    const tbody = document.querySelector('#ubid-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><div class="spinner" style="margin: 20px auto"></div></td></tr>';
    
    try {
      const url = search ? `/ubids?search=${encodeURIComponent(search)}&limit=20` : `/ubids?limit=20`;
      const res = await API.get(url);
      
      if (res.success && res.data.length > 0) {
        tbody.innerHTML = res.data.map(u => `
          <tr>
            <td class="mono" style="color: var(--accent-blue)">${u.id}</td>
            <td class="font-medium">${u.primary_name}</td>
            <td class="mono">${u.primary_pan || '-'}</td>
            <td><span class="badge badge-unknown">${u.record_count}</span></td>
            <td><span class="badge badge-unknown">${u.department_count}</span></td>
            <td>
              <div class="flex-center gap-8" style="justify-content: flex-start">
                <div class="confidence-bar" style="width: 50px;">
                  <div class="confidence-fill ${u.confidence >= 0.85 ? 'confidence-high' : 'confidence-medium'}" style="width: ${Math.round(u.confidence * 100)}%"></div>
                </div>
                <span class="mono text-sm">${Math.round(u.confidence * 100)}%</span>
              </div>
            </td>
            <td><span class="badge badge-${u.status}">${u.status.toUpperCase()}</span></td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="ResolutionPage.viewUBID('${u.id}')">View Details</button>
            </td>
          </tr>
        `).join('');
        document.getElementById('ubid-stats').textContent = `Showing top ${res.data.length} of ${res.total.toLocaleString()} UBIDs`;
      } else {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No UBIDs found. Run the pipeline to generate them.</td></tr>';
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-red">Error loading UBIDs: ${e.message}</td></tr>`;
    }
  },

  async runPipeline() {
    const btn = document.getElementById('btn-pipeline');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Running Pipeline...';
    
    try {
      const res = await API.post('/resolve');
      if (res.success) {
        showToast('Entity Resolution completed', 'success');
        
        App.showModal(`
          <h2 class="mb-16">Pipeline Execution Report</h2>
          <div class="kpi-grid mb-24">
            <div class="kpi-card" style="padding:16px">
              <div class="kpi-info">
                <div class="kpi-value text-blue">${res.results.candidate_pairs}</div>
                <div class="kpi-label">Candidate Pairs</div>
              </div>
            </div>
            <div class="kpi-card" style="padding:16px">
              <div class="kpi-info">
                <div class="kpi-value text-emerald">${res.results.auto_merged}</div>
                <div class="kpi-label">Pairs Auto-Merged</div>
              </div>
            </div>
            <div class="kpi-card" style="padding:16px">
              <div class="kpi-info">
                <div class="kpi-value text-amber">${res.results.pending_review}</div>
                <div class="kpi-label">Pairs Sent to Review</div>
              </div>
            </div>
          </div>
          <div class="flex gap-12 mt-24">
            <button class="btn btn-primary" onclick="App.closeModal(); ResolutionPage.loadUBIDs();">View UBIDs</button>
            <button class="btn btn-outline" onclick="App.closeModal(); window.location.hash='#/review'">Go to Review Queue</button>
          </div>
        `);
        
        App.updateBadges();
      } else {
        showToast(res.error || 'Pipeline failed', 'error');
      }
    } catch (e) {
      showToast('Error connecting to server', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀</span> Run Resolution Pipeline';
    }
  },

  async viewUBID(id) {
    App.showModal('<div class="loading-container"><div class="spinner"></div></div>');
    
    try {
      const res = await API.get(`/ubids/${id}`);
      if (!res.success) throw new Error(res.error);
      
      const { ubid, links } = res.data;
      
      const html = `
        <div class="flex-between mb-24 pb-16" style="border-bottom: 1px solid var(--border)">
          <div>
            <div class="font-mono text-sm text-blue mb-4">${ubid.id}</div>
            <h2 style="font-size: 22px; margin:0">${ubid.primary_name}</h2>
          </div>
          <div class="text-right">
            <div class="badge badge-${ubid.status}">${ubid.status.toUpperCase()}</div>
            <div class="text-sm text-muted mt-8">Overall Confidence: <span class="font-mono text-emerald">${Math.round(ubid.confidence * 100)}%</span></div>
          </div>
        </div>

        <h3 class="font-mono text-sm text-muted mb-16">LINKED SOURCE RECORDS (${links.length})</h3>
        
        <div class="signal-list mb-24">
          ${links.map(link => `
            <div class="signal-item" style="display:block; padding: 16px;">
              <div class="flex-between mb-12">
                <span class="badge badge-unknown">${link.department_code}</span>
                <span class="badge badge-active">${Math.round(link.confidence * 100)}% Confidence</span>
              </div>
              <div class="grid-2">
                <div>
                  <div class="text-xs text-muted mb-4 uppercase">Business Name</div>
                  <div class="font-medium mb-12">${link.business_name}</div>
                  <div class="text-xs text-muted mb-4 uppercase">Address</div>
                  <div class="text-sm">${link.address || '-'}</div>
                </div>
                <div>
                  <div class="text-xs text-muted mb-4 uppercase">Identifiers</div>
                  <div class="font-mono text-sm mb-4">PAN: ${link.pan || '-'}</div>
                  <div class="font-mono text-sm">GST: ${link.gstin || '-'}</div>
                  <div class="text-xs text-muted mb-4 mt-8 uppercase">Match Method</div>
                  <div class="text-sm">${link.match_method}</div>
                </div>
              </div>
              <div class="mt-16 pt-16 border-t border-light flex-between">
                <div class="text-xs text-muted">Linked: ${new Date(link.linked_at).toLocaleString()}</div>
                <button class="btn btn-sm btn-outline text-red" onclick="ResolutionPage.unlinkRecord('${ubid.id}', ${link.source_record_id})">Unlink</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      App.showModal(html);
    } catch (e) {
      App.showModal(`<div class="empty-state text-red">Error: ${e.message}</div>`);
    }
  },

  async unlinkRecord(ubidId, recordId) {
    if (!confirm('Are you sure you want to unlink this record? This action is reversible but will impact the UBID immediately.')) return;
    
    try {
      const res = await API.post(`/ubids/${ubidId}/unlink`, { source_record_id: recordId });
      if (res.success) {
        showToast('Record unlinked successfully', 'success');
        this.viewUBID(ubidId); // Refresh modal
        this.loadUBIDs(); // Refresh table
      } else {
        showToast(res.error, 'error');
      }
    } catch (e) {
      showToast('Error unlinking record', 'error');
    }
  }
};
