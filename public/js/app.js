/**
 * UBIX SPA Router & App Shell
 */

const App = {
  container: document.getElementById('page-container'),
  routes: {
    '/': 'dashboard',
    '/ingestion': 'ingestion',
    '/resolution': 'resolution',
    '/review': 'review',
    '/activity': 'activity',
    '/query': 'query'
  },
  pages: {}, // Populated by individual page scripts

  init() {
    // Register pages
    if (window.DashboardPage) this.pages.dashboard = window.DashboardPage;
    if (window.IngestionPage) this.pages.ingestion = window.IngestionPage;
    if (window.ResolutionPage) this.pages.resolution = window.ResolutionPage;
    if (window.ReviewPage) this.pages.review = window.ReviewPage;
    if (window.ActivityPage) this.pages.activity = window.ActivityPage;
    if (window.QueryPage) this.pages.query = window.QueryPage;

    // Setup routing
    window.addEventListener('hashchange', () => this.handleRoute());
    this.setupNavigation();
    
    // Initial route
    if (!window.location.hash) {
      window.location.hash = '#/';
    } else {
      this.handleRoute();
    }

    // Start background polling for badges
    this.updateBadges();
    setInterval(() => this.updateBadges(), 30000);
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        navItems.forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });
  },

  updateActiveNav(pageName) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(nav => {
      if (nav.dataset.page === pageName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });
  },

  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    // Handle sub-routes by taking the first part
    const path = hash.split('?')[0];
    const pageName = this.routes[path];

    if (!pageName) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">404</div>
          <h2 class="empty-state-title">Page Not Found</h2>
          <p class="empty-state-text">The requested view does not exist.</p>
        </div>
      `;
      return;
    }

    this.updateActiveNav(pageName);
    const page = this.pages[pageName];
    
    if (page) {
      this.container.innerHTML = '<div class="loading-container"><div class="spinner"></div><div>Loading data...</div></div>';
      try {
        await page.render(this.container);
      } catch (err) {
        console.error('Page render error:', err);
        showToast('Error loading page data', 'error');
        this.container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">❌</div>
            <h2 class="empty-state-title">Error Loading View</h2>
            <p class="empty-state-text">${err.message}</p>
          </div>
        `;
      }
    }
  },

  async updateBadges() {
    try {
      const stats = await API.get('/stats');
      if (stats.success && stats.data) {
        const reviewBadge = document.getElementById('review-badge');
        const pendingCount = stats.data.pending_reviews;
        
        if (pendingCount > 0) {
          reviewBadge.textContent = pendingCount > 99 ? '99+' : pendingCount;
          reviewBadge.style.display = 'inline-block';
        } else {
          reviewBadge.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('Failed to update badges', e);
    }
  },

  // Modal helper
  showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = html;
    overlay.classList.remove('hidden');
    
    // Close on click outside
    overlay.onclick = (e) => {
      if (e.target === overlay) this.closeModal();
    };
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => {
      document.getElementById('modal-content').innerHTML = '';
    }, 300);
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
