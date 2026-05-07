/**
 * UBIX Human Review Page
 */

window.ReviewPage = {
  currentMatchId: null,

  async render(container) {
    container.innerHTML = `
      <div class="flex-between mb-24">
        <div class="page-header" style="margin-bottom:0">
          <h1>Human-in-the-loop Review</h1>
          <p>Medium-confidence matches requiring validation</p>
        </div>
        <div class="badge badge-pending" style="font-size: 14px; padding: 6px 16px" id="review-counter">
          0 Pending
        </div>
      </div>

      <div id="review-workspace">
        <div class="loading-container"><div class="spinner"></div></div>
      </div>
    `;

    await this.loadNext();
  },

  async loadNext() {
    const workspace = document.getElementById('review-workspace');
    if (!workspace) return;

    try {
      const res = await API.get('/review/pending?limit=1');
      const total = res.total;
      document.getElementById('review-counter').innerHTML = `${total} Pending`;
      App.updateBadges();

      if (total === 0 || !res.data || res.data.length === 0) {
        workspace.innerHTML = `
          <div class="card empty-state mt-24">
            <div class="empty-state-icon">🎉</div>
            <h2 class="empty-state-title">Inbox Zero</h2>
            <p class="empty-state-text">There are no pending matches to review right now.</p>
            <button class="btn btn-outline mt-16" onclick="window.location.hash='#/resolution'">Go to Resolution Pipeline</button>
          </div>
        `;
        return;
      }

      const matchId = res.data[0].id;
      this.currentMatchId = matchId;
      await this.renderMatch(matchId);

    } catch (e) {
      workspace.innerHTML = `<div class="empty-state text-red">Error: ${e.message}</div>`;
    }
  },

  async renderMatch(id) {
    const workspace = document.getElementById('review-workspace');
    try {
      const res = await API.get(`/review/${id}`);
      if (!res.success) throw new Error(res.error);
      const m = res.data;

      const signals = m.signals || [];
      const confidencePct = Math.round(m.confidence * 100);

      workspace.innerHTML = `
        <!-- Signals Panel -->
        <div class="card mb-24">
          <div class="flex-between mb-16">
            <h3 class="card-title">Similarity Engine Explanation</h3>
            <div class="flex-center gap-12">
              <span class="text-sm font-medium">Confidence Score:</span>
              <div class="confidence-bar" style="width: 100px;">
                <div class="confidence-fill confidence-medium" style="width: ${confidencePct}%"></div>
              </div>
              <span class="font-mono font-bold text-amber">${confidencePct}%</span>
            </div>
          </div>
          <p class="text-sm mb-16">${m.explanation}</p>
          <div class="signal-list">
            ${signals.map(s => `
              <div class="signal-item">
                <div class="signal-type">${s.type}</div>
                <div class="signal-explanation">${s.explanation}</div>
                <div class="signal-score" style="color: ${s.score > 0.8 ? 'var(--accent-emerald)' : 'var(--text-primary)'}">
                  ${Math.round(s.score * 100)}%
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Side-by-side comparison -->
        <div class="comparison-grid">
          <!-- Record A -->
          <div class="comparison-panel">
            <div class="flex-between mb-24">
              <span class="badge badge-unknown">${m.dept_code_a}</span>
              <span class="text-sm text-muted">ID: ${m.record_a_id}</span>
            </div>
            
            <div class="field-row">
              <div class="field-label">Business Name</div>
              <div class="field-value">${m.name_a}</div>
            </div>
            <div class="field-row">
              <div class="field-label">PAN</div>
              <div class="field-value mono">${m.pan_a || '-'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">GSTIN</div>
              <div class="field-value mono">${m.gstin_a || '-'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Address</div>
              <div class="field-value">${m.addr_a || '-'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">District</div>
              <div class="field-value">${m.district_a || '-'}</div>
            </div>
          </div>

          <div class="comparison-vs">VS</div>

          <!-- Record B -->
          <div class="comparison-panel">
            <div class="flex-between mb-24">
              <span class="badge badge-unknown">${m.dept_code_b}</span>
              <span class="text-sm text-muted">ID: ${m.record_b_id}</span>
            </div>
            
            <div class="field-row">
              <div class="field-label">Business Name</div>
              <div class="field-value">${this.highlightDiff(m.name_b, m.name_a)}</div>
            </div>
            <div class="field-row">
              <div class="field-label">PAN</div>
              <div class="field-value mono ${m.pan_a && m.pan_b && m.pan_a !== m.pan_b ? 'text-red' : ''}">${m.pan_b || '-'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">GSTIN</div>
              <div class="field-value mono ${m.gstin_a && m.gstin_b && m.gstin_a !== m.gstin_b ? 'text-red' : ''}">${m.gstin_b || '-'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Address</div>
              <div class="field-value">${this.highlightDiff(m.addr_b || '-', m.addr_a || '-')}</div>
            </div>
            <div class="field-row">
              <div class="field-label">District</div>
              <div class="field-value">${m.district_b || '-'}</div>
            </div>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="card mt-24 flex-between">
          <div>
            <h3 style="font-size:16px; margin-bottom:4px">Decision</h3>
            <p class="text-sm text-muted" style="margin:0">Accepting creates a unified UBID.</p>
          </div>
          <div class="flex gap-12">
            <button class="btn btn-outline btn-lg" onclick="ReviewPage.decide('rejected')">
              <span class="text-red">✕</span> Reject Match
            </button>
            <button class="btn btn-primary btn-lg" onclick="ReviewPage.decide('accepted')">
              <span>✓</span> Accept Match
            </button>
          </div>
        </div>
      `;

    } catch (e) {
      workspace.innerHTML = `<div class="empty-state text-red">Error loading match: ${e.message}</div>`;
    }
  },

  async decide(decision) {
    if (!this.currentMatchId) return;
    
    try {
      const res = await API.post(`/review/${this.currentMatchId}/decide`, { decision, reason: 'Human review' });
      if (res.success) {
        showToast(res.message, decision === 'accepted' ? 'success' : 'info');
        await this.loadNext();
      } else {
        showToast(res.error, 'error');
      }
    } catch (e) {
      showToast('Error saving decision', 'error');
    }
  },

  // Simple string diff highlighter helper
  highlightDiff(str, target) {
    if (!str || !target || str === target) return str;
    
    // Very basic highlighting - just color the whole string amber if it's different
    // In a real app we'd use diff-match-patch for word-level highlighting
    return `<span class="field-partial">${str}</span>`;
  }
};
