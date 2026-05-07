/**
 * UBIX Activity Intelligence Page
 */

window.ActivityPage = {
  async render(container) {
    container.innerHTML = `
      <div class="flex-between mb-24">
        <div class="page-header" style="margin-bottom:0">
          <h1>Activity Intelligence</h1>
          <p>Classify business status based on cross-department events</p>
        </div>
        <button class="btn btn-primary" onclick="ActivityPage.runClassification()" id="btn-classify">
          <span>⚙️</span> Classify Businesses
        </button>
      </div>

      <div class="grid-2 mb-24">
        <div class="card">
          <div class="flex-between mb-16">
            <h2 class="card-title">Activity Status Distribution</h2>
            <select id="status-filter" style="padding:4px 8px; border-radius:4px; background:var(--bg-elevated); border:1px solid var(--border); color:white">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div class="table-container" style="max-height: 400px">
            <table id="activity-table">
              <thead>
                <tr>
                  <th>UBID</th>
                  <th>Business Name</th>
                  <th>Status</th>
                  <th>Events</th>
                  <th>Last Event</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="6" class="text-center">Loading classifications...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title mb-16">Unlinked Events Queue</h2>
          <p class="text-sm text-muted mb-16">Events that could not be automatically matched to a UBID.</p>
          <div class="table-container" style="max-height: 400px">
            <table id="unlinked-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Event Type</th>
                  <th>Date</th>
                  <th>Name Hint</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="4" class="text-center">Loading unlinked events...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('status-filter').addEventListener('change', (e) => {
      this.loadClassifications(e.target.value);
    });

    await Promise.all([
      this.loadClassifications(),
      this.loadUnlinkedEvents()
    ]);
  },

  async loadClassifications(status = '') {
    const tbody = document.querySelector('#activity-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner" style="margin: 20px auto"></div></td></tr>';
    
    try {
      const url = status ? `/activity?status=${status}&limit=50` : `/activity?limit=50`;
      const res = await API.get(url);
      
      if (res.success && res.data.length > 0) {
        tbody.innerHTML = res.data.map(c => `
          <tr>
            <td class="mono text-sm" style="color: var(--accent-blue)">${c.ubid_id.split('-')[1]}</td>
            <td class="font-medium truncate" style="max-width: 150px" title="${c.primary_name}">${c.primary_name}</td>
            <td><span class="badge badge-${c.status}">${c.status.toUpperCase()}</span></td>
            <td>${c.event_count}</td>
            <td class="mono text-sm text-muted">${c.last_event_date || '-'}</td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="ActivityPage.viewTimeline('${c.ubid_id}')">Timeline</button>
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No classifications found.</td></tr>';
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-red">Error: ${e.message}</td></tr>`;
    }
  },

  async loadUnlinkedEvents() {
    const tbody = document.querySelector('#unlinked-table tbody');
    if (!tbody) return;
    
    try {
      const res = await API.get('/activity/unlinked/events');
      if (res.success && res.data.length > 0) {
        tbody.innerHTML = res.data.map(e => `
          <tr>
            <td><span class="badge badge-unknown">${e.department_code}</span></td>
            <td class="text-sm">${e.event_type.replace('_', ' ')}</td>
            <td class="mono text-sm text-muted">${e.event_date}</td>
            <td class="text-sm truncate" style="max-width:120px" title="${e.business_name_hint}">${e.business_name_hint}</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No unlinked events.</td></tr>';
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state text-red">Error: ${e.message}</td></tr>`;
    }
  },

  async runClassification() {
    const btn = document.getElementById('btn-classify');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Classifying...';
    
    try {
      const res = await API.post('/activity/classify');
      if (res.success) {
        showToast('Classification completed', 'success');
        
        App.showModal(`
          <h2 class="mb-16">Classification Results</h2>
          <div class="kpi-grid mb-24">
            <div class="kpi-card" style="padding:16px">
              <div class="kpi-info">
                <div class="kpi-value text-emerald">${res.stats.active || 0}</div>
                <div class="kpi-label">Active</div>
              </div>
            </div>
            <div class="kpi-card" style="padding:16px">
              <div class="kpi-info">
                <div class="kpi-value text-amber">${res.stats.dormant || 0}</div>
                <div class="kpi-label">Dormant</div>
              </div>
            </div>
            <div class="kpi-card" style="padding:16px">
              <div class="kpi-info">
                <div class="kpi-value text-red">${res.stats.closed || 0}</div>
                <div class="kpi-label">Closed</div>
              </div>
            </div>
          </div>
          <button class="btn btn-primary" onclick="App.closeModal(); ActivityPage.loadClassifications();">Close</button>
        `);
      } else {
        showToast(res.error, 'error');
      }
    } catch (e) {
      showToast('Error connecting to server', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>⚙️</span> Classify Businesses';
    }
  },

  async viewTimeline(ubidId) {
    App.showModal('<div class="loading-container"><div class="spinner"></div></div>');
    
    try {
      const res = await API.get(`/activity/${ubidId}`);
      if (!res.success) throw new Error(res.error);
      
      const { classification, events } = res.data;
      
      const evidenceHtml = classification.evidence.map(ev => `
        <li class="mb-4 text-sm">${ev.description}</li>
      `).join('');

      const timelineHtml = events.map(ev => `
        <div class="timeline-item">
          <div class="timeline-date">${ev.event_date}</div>
          <div class="timeline-content">
            <span class="badge badge-unknown" style="margin-right:8px">${ev.department_code}</span>
            <span class="font-medium capitalize">${ev.event_type.replace('_', ' ')}</span>
          </div>
          ${ev.event_details ? `
            <div class="mt-8 p-12 text-sm text-muted" style="background:var(--bg-primary); border-radius:4px">
              ${JSON.parse(ev.event_details).description || 'No additional details'}
            </div>
          ` : ''}
        </div>
      `).join('');

      const html = `
        <div class="flex-between mb-24 pb-16" style="border-bottom: 1px solid var(--border)">
          <div>
            <div class="font-mono text-sm text-blue mb-4">${ubidId}</div>
            <h2 style="font-size: 22px; margin:0">Activity Profile</h2>
          </div>
          <div class="text-right">
            <div class="badge badge-${classification.status}">${classification.status.toUpperCase()}</div>
            <div class="text-sm text-muted mt-8">Confidence: <span class="font-mono">${Math.round(classification.confidence * 100)}%</span></div>
          </div>
        </div>

        <div class="grid-2 gap-24">
          <div>
            <h3 class="card-title mb-16">Classification Evidence</h3>
            <div class="card" style="background: var(--bg-primary)">
              <ul style="padding-left: 20px; margin: 0; color: var(--text-secondary)">
                ${evidenceHtml}
              </ul>
            </div>
          </div>
          
          <div>
            <h3 class="card-title mb-16">Event Timeline</h3>
            <div class="card" style="max-height: 400px; overflow-y: auto;">
              ${events.length > 0 ? `
                <div class="timeline">
                  ${timelineHtml}
                </div>
              ` : '<div class="empty-state">No events found.</div>'}
            </div>
          </div>
        </div>
      `;
      App.showModal(html);
    } catch (e) {
      App.showModal(`<div class="empty-state text-red">Error: ${e.message}</div>`);
    }
  }
};
