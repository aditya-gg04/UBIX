/**
 * UBIX Query Engine Page
 */

window.QueryPage = {
  presets: [],

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Query Engine</h1>
        <p>Advanced cross-department insights and analytics</p>
      </div>

      <div class="grid-auto mb-24" id="preset-grid">
        <div class="loading-container" style="grid-column: 1/-1"><div class="spinner"></div></div>
      </div>

      <div class="card hidden" id="results-card">
        <div class="card-header">
          <div>
            <h2 class="card-title" id="results-title">Query Results</h2>
            <p class="text-sm text-muted mt-4" id="results-desc"></p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="QueryPage.closeResults()">Close</button>
        </div>
        <div class="table-container">
          <table id="results-table">
            <thead>
              <tr id="results-header"></tr>
            </thead>
            <tbody id="results-body"></tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadPresets();
  },

  async loadPresets() {
    try {
      const res = await API.get('/query/presets');
      if (res.success) {
        this.presets = res.data;
        const grid = document.getElementById('preset-grid');
        
        grid.innerHTML = this.presets.map(p => `
          <div class="query-card" onclick="QueryPage.runQuery('${p.id}')">
            <div class="query-card-icon">${p.icon}</div>
            <div class="query-card-name">${p.name}</div>
            <div class="query-card-desc">${p.description}</div>
            <div class="mt-12">
              <span class="badge badge-unknown text-xs">${p.category}</span>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      document.getElementById('preset-grid').innerHTML = `<div class="empty-state text-red">Error loading presets: ${e.message}</div>`;
    }
  },

  async runQuery(presetId) {
    const resultsCard = document.getElementById('results-card');
    const headerRow = document.getElementById('results-header');
    const tbody = document.getElementById('results-body');
    const title = document.getElementById('results-title');
    const desc = document.getElementById('results-desc');

    resultsCard.classList.remove('hidden');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center"><div class="spinner" style="margin: 20px auto"></div></td></tr>';
    headerRow.innerHTML = '';
    title.textContent = 'Running Query...';
    desc.textContent = '';

    // Scroll to results
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const preset = this.presets.find(p => p.id === presetId);
      const res = await API.post('/query', { preset_id: presetId });
      
      if (res.success && res.data.results) {
        title.textContent = preset ? preset.name : 'Query Results';
        desc.textContent = `${res.data.result_count} records found • ${res.data.description}`;

        const rows = res.data.results;
        
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No results found for this query.</td></tr>';
          return;
        }

        // Generate headers dynamically based on first row keys
        const keys = Object.keys(rows[0]);
        headerRow.innerHTML = keys.map(k => `<th>${k.replace(/_/g, ' ').toUpperCase()}</th>`).join('');

        // Generate rows
        tbody.innerHTML = rows.map(row => `
          <tr>
            ${keys.map(k => {
              let val = row[k];
              if (val === null || val === undefined) val = '-';
              
              // Format specific columns
              if (k === 'status') {
                return `<td><span class="badge badge-${val}">${String(val).toUpperCase()}</span></td>`;
              }
              if (k.includes('confidence')) {
                return `<td class="mono text-emerald">${Math.round(val * 100)}%</td>`;
              }
              if (k.includes('id') && String(val).startsWith('UBID-')) {
                return `<td class="mono text-blue">${String(val).split('-')[1]}</td>`;
              }
              if (k.includes('date') && val !== '-') {
                return `<td class="mono text-sm text-muted">${val}</td>`;
              }
              
              return `<td class="text-sm truncate" style="max-width: 200px" title="${val}">${val}</td>`;
            }).join('')}
          </tr>
        `).join('');
      } else {
        throw new Error(res.error || 'Failed to execute query');
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state text-red">Error: ${e.message}</td></tr>`;
      title.textContent = 'Query Failed';
    }
  },

  closeResults() {
    document.getElementById('results-card').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};
