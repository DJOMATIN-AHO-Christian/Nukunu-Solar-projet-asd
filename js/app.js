/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — APP.JS
   Router, navigation, onboarding, clock, modal, toasts
═══════════════════════════════════════════════════════════ */

const App = (() => {

  /* ── STATE ──────────────────────────────────────── */
  let _currentModule = 'monitoring';
  let _clockInterval = null;
  let _charts = {};
  let _eventsBound = false;
  let _apiBase = window.NUKUNU_API_BASE
    || localStorage.getItem('nukunu_api_base')
    || 'http://localhost:3002';

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    _apiBase = 'http://localhost:3002';
  }

  /* ── MODULE RENDERERS MAP ────────────────────────── */
  const _renderers = {
    monitoring:   () => ModuleMonitoring.render(),
    reporting:    () => ModuleReporting.render(),
    maintenance:  () => ModuleMaintenance.render(),
    facturation:  () => ModuleFacturation.render(),
    conformite:   () => ModuleConformite.render(),
    vente:        () => ModuleVente.render(),
    optimisation: () => ModuleOptimisation.render(),
    account:      () => ModuleAccount.render(),
    admin:        () => ModuleAdmin.render(),
  };

  const _moduleTitles = {
    monitoring:   'Monitoring & Alertes',
    reporting:    'Reporting & Pilotage',
    maintenance:  'Maintenance O&M',
    facturation:  'Facturation & Revenus',
    conformite:   'Conformité Réglementaire',
    vente:        'Vente & CRM',
    optimisation: 'Optimisation Énergie',
    account:      'Mon Compte',
    admin:        'Administration SaaS',
  };

  function getApiBase() {
    return _apiBase;
  }

  /* ── INIT ────────────────────────────────────────── */
  async function init() {
    console.log('☀️ Nukunu App Initializing...');
    _bindLanding();
    _bindAuth();
    _bindOnboarding();
    _initClock();
    _initTheme();
    _bindTheme();
    _syncLandingMetrics();

    /* Check saved session/profile */
    const hasSession = window.NukunuStore.get('nukunu_session');
    const token = window.NukunuStore.get('nukunu_token');

    if (hasSession && token) {
      const session = await _restoreSession();
      if (session) {
        document.getElementById('landing-page')?.classList.add('hidden');
        document.getElementById('auth-overlay').classList.add('hidden');
        _showApp();
        lucide.createIcons();
        return;
      }
    }

    lucide.createIcons();
  }

  function _bindLanding() {
    document.getElementById('landing-login-btn')?.addEventListener('click', () => showAuth('login'));
    document.getElementById('landing-start-btn')?.addEventListener('click', () => showAuth('login'));
    document.getElementById('landing-register-btn')?.addEventListener('click', () => showAuth('register'));
    document.getElementById('landing-demo-btn')?.addEventListener('click', () => _openLandingShowcase());
  }

  /* ── AUTH ────────────────────────────────────────── */
  function _bindAuth() {
    const card = document.getElementById('auth-card');
    const toReg = document.getElementById('to-register');
    const toLog = document.getElementById('to-login');
    const forgotPassword = document.getElementById('forgot-password-btn');

    if (toReg) toReg.addEventListener('click', e => {
      e.preventDefault();
      card.parentElement.classList.add('auth-mode-register');
    });
    if (toLog) toLog.addEventListener('click', e => {
      e.preventDefault();
      card.parentElement.classList.remove('auth-mode-register');
    });
    if (forgotPassword) {
      forgotPassword.addEventListener('click', e => {
        e.preventDefault();
        _openForgotPasswordModal();
      });
    }

    /* Submit handlers (API Integration) */
    ['login-form', 'register-form'].forEach(id => {
      const form = document.getElementById(id);
      if (form) {
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const btn = form.querySelector('button[type="submit"]');
          const originalText = btn.innerHTML;
          
          btn.disabled = true;
          btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Traitement...';
          lucide.createIcons();

          const isRegister = id === 'register-form';
          const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
          
          const payload = {};
          if (isRegister) {
            payload.name = document.getElementById('register-name').value;
            payload.email = document.getElementById('register-email').value;
            payload.password = document.getElementById('register-password').value;
            payload.role = document.getElementById('register-role').value;
          } else {
            payload.email = document.getElementById('login-email').value;
            payload.password = document.getElementById('login-password').value;
          }

          const errorContainer = document.getElementById(isRegister ? 'register-error' : 'login-error');
          if (errorContainer) errorContainer.classList.add('hidden');

          try {
            const res = await fetch(`${getApiBase()}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            
            if (!res.ok) throw new Error(data.error || 'Erreur inconnue');

            const remember = isRegister ? true : Boolean(document.getElementById('login-remember')?.checked);
            window.NukunuStore.setAuthState({
              nukunu_session: 'true',
              nukunu_token: data.token,
              nukunu_user_name: data.user.name,
              nukunu_user_email: data.user.email,
              nukunu_profile: data.user.role,
              nukunu_user_role: data.user.role,
              nukunu_user_id: String(data.user.id),
            }, remember);

            Profile.activate(data.user.role, false);
            if (isRegister) {
              _showOnboarding(data.user.role);
            } else {
              _hideAuthAndShowApp();
            }

          } catch (err) {
            _showAuthError(id, err.message);
            btn.disabled = false;
            btn.innerHTML = originalText;
            lucide.createIcons();
          }
        });
      }
    });
  }

  function _showAuthError(formId, message) {
    const isRegister = formId === 'register-form';
    const errorId = isRegister ? 'register-error' : 'login-error';
    const container = document.getElementById(errorId);
    const card = document.getElementById('auth-card');

    if (container) {
      container.querySelector('span').textContent = message;
      container.classList.remove('hidden');
    }

    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth; // Trigger reflow
      card.classList.add('shake');
    }
  }

  function _showOnboarding(profileHint = '') {
    const auth = document.getElementById('auth-overlay');
    const ob = document.getElementById('onboarding-overlay');

    document.querySelectorAll('.profile-card').forEach(card => {
      card.classList.toggle('selected', Boolean(profileHint) && card.dataset.profile === profileHint);
    });
    
    auth.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    auth.style.opacity = '0';
    auth.style.transform = 'scale(1.05)';
    
    setTimeout(() => {
      auth.classList.add('hidden');
      ob.classList.remove('hidden');
      lucide.createIcons();
    }, 500);
  }

  function _hideAuthAndShowApp() {
    const auth = document.getElementById('auth-overlay');
    auth.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    auth.style.opacity = '0';
    auth.style.transform = 'scale(1.05)';
    
    setTimeout(() => {
      auth.classList.add('hidden');
      _showApp();
    }, 500);
  }

  /* ── ONBOARDING ──────────────────────────────────── */
  function _bindOnboarding() {
    document.querySelectorAll('.profile-card').forEach(card => {
      card.addEventListener('click', () => {
        const profile = card.dataset.profile;
        const allowedRole = window.NukunuStore.get('nukunu_user_role');
        if (allowedRole && profile !== allowedRole) {
          toast(`Votre compte est configuré pour le profil ${allowedRole}.`, 'info');
          return;
        }
        document.querySelectorAll('.profile-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        setTimeout(() => {
          Profile.activate(profile);
          _showApp();
        }, 320);
      });
    });
  }

  async function _showApp() {
    const role = window.NukunuStore.get('nukunu_user_role');
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) {
      adminLink.classList.toggle('hidden', role !== 'super_admin');
    }

    document.getElementById('landing-page')?.classList.add('hidden');
    document.getElementById('onboarding-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    _bindAppEvents();
    await NukunuData.refreshDashboardData();
    _syncUserUI();
    _updateGlobalBadges();
    
    if (role === 'super_admin') {
      _currentModule = 'admin';
    }
    
    _navigateTo(_currentModule || 'monitoring');
    lucide.createIcons();
  }

  /* ── BIND EVENTS ─────────────────────────────────── */
  function _bindAppEvents() {
    if (_eventsBound) return;
    _eventsBound = true;

    /* Navigation */
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        _navigateTo(el.dataset.module);
      });
    });

    /* Sidebar collapse */
    const colBtn = document.getElementById('sidebar-collapse-btn');
    if (colBtn) colBtn.addEventListener('click', _toggleSidebar);

    /* Mobile menu toggle */
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) menuToggle.addEventListener('click', _toggleSidebar);

    /* Profile switcher → back to onboarding */
    const sw = document.getElementById('profile-switcher');
    if (sw) {
      sw.addEventListener('click', () => {
        _navigateTo('account');
      });
    }

    /* Avatar click -> Account page */
    const avatar = document.getElementById('avatar-btn');
    if (avatar) {
      avatar.addEventListener('click', () => _navigateTo('account'));
    }

    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        _openNotificationsCenter();
      });
    }

    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        _openHelpCenter();
      });
    }

    /* Modal close */
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  /* ── NAVIGATION ──────────────────────────────────── */
  function _navigateTo(module) {
    if (!module || !_renderers[module]) return;

    /* Hide all views */
    document.querySelectorAll('.module-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    /* Show target */
    const view = document.getElementById(`module-${module}`);
    const navEl = document.getElementById(`nav-${module}`);
    if (view) view.classList.add('active');
    if (navEl) navEl.classList.add('active');

    /* Update breadcrumb */
    const bc = document.getElementById('breadcrumb-current');
    if (bc) bc.textContent = _moduleTitles[module] || module;

    _currentModule = module;

    /* Render module (clear previous charts) */
    destroyCharts();
    if (view) {
      view.innerHTML = '';
      _renderers[module]();
    }

    _syncUserUI();
    if (window.innerWidth <= 768) {
      document.getElementById('app')?.classList.remove('mobile-open');
    }
    lucide.createIcons();
    _updateGlobalBadges();
    _renderAlertStrip();
  }

  /* ── SIDEBAR TOGGLE ──────────────────────────────── */
  function _toggleSidebar() {
    const app = document.getElementById('app');
    if (!app) return;
    if (window.innerWidth <= 768) {
      app.classList.toggle('mobile-open');
      return;
    }
    app.classList.toggle('sidebar-collapsed');
    lucide.createIcons();
  }

  /* ── ALERT STRIP ─────────────────────────────────── */
  /* ── THEME ────────────────────────────────────────── */
  function _initTheme() {
    const savedTheme = window.NukunuStore.get('nukunu_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    _updateThemeIcon(savedTheme);
  }

  function _bindTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      window.NukunuStore.set('nukunu_theme', next);
      _updateThemeIcon(next);
      _navigateTo(_currentModule, false);
    });
  }

  function _updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
  }

  function _renderAlertStrip() {
    const strip = document.getElementById('alert-strip');
    if (!strip) return;
    
    if (_currentModule !== 'monitoring') {
      strip.style.display = 'none';
      return;
    }
    strip.style.display = '';

    const profile = Profile.get();
    const alerts = (NukunuData.alerts[profile] || []).filter(a => a.level === 'critical').slice(0,2);
    if (!alerts.length) { strip.innerHTML=''; return; }
    strip.innerHTML = alerts.map(a => `
      <div class="alert-item alert--critical fade-in">
        <i data-lucide="alert-circle"></i>
        <div class="alert-item__content">
          <span class="alert-item__site">${a.site}</span>
          <span class="alert-item__msg">${a.msg}</span>
          <span class="alert-item__time">${a.time}</span>
        </div>
        <button class="btn btn-sm btn-danger alert-item__cta" onclick="App.openTicket('${a.id}')">
          <i data-lucide="wrench"></i> Créer ticket
        </button>
      </div>`).join('');
    lucide.createIcons();
  }

  function _updateGlobalBadges() {
    const profile = Profile.get() || window.NukunuStore.get('nukunu_user_role');
    const openTickets = NukunuData.getTickets().filter(ticket => ticket.status !== 'done').length;
    const criticalAlerts = (NukunuData.alerts[profile] || []).filter(alert => alert.level === 'critical').length;
    const notifications = NukunuData.getNotificationSummary();

    const monitoringBadge = document.getElementById('badge-monitoring');
    const maintenanceBadge = document.getElementById('badge-maintenance');
    const notifDot = document.getElementById('notif-dot');

    if (monitoringBadge) monitoringBadge.textContent = String(criticalAlerts);
    if (maintenanceBadge) maintenanceBadge.textContent = String(openTickets);
    if (notifDot) {
      notifDot.textContent = String(notifications.unread);
      notifDot.style.display = notifications.unread ? '' : 'none';
    }
  }

  /* ── CLOCK ───────────────────────────────────────── */
  function _initClock() {
    function tick() {
      const c = document.getElementById('topbar-clock');
      if (c) {
        const now = new Date();
        c.textContent = now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      }
    }
    tick();
    _clockInterval = setInterval(tick, 10000);
  }

  /* ── CHART REGISTRY ──────────────────────────────── */
  function registerChart(id, instance) { _charts[id] = instance; }
  function destroyCharts() {
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e){} });
    _charts = {};
  }

  /* ── MODAL ───────────────────────────────────────── */
  function openModal(title, bodyHTML, footerHTML='') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML  = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal-overlay').classList.remove('hidden');
    lucide.createIcons();
  }
  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  /* ── SESSION ─────────────────────────────────────── */
  function logout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      window.NukunuStore.clearAuth();
      document.getElementById('app')?.classList.add('hidden');
      document.getElementById('auth-overlay')?.classList.add('hidden');
      document.getElementById('onboarding-overlay')?.classList.add('hidden');
      document.getElementById('landing-page')?.classList.remove('hidden');
      _currentModule = 'monitoring';
      destroyCharts();
      closeModal();
      _syncLandingMetrics();
      toast('Session fermée', 'success');
    }
  }

  function showAuth(mode = 'login', options = {}) {
    const landing = document.getElementById('landing-page');
    const auth = document.getElementById('auth-overlay');
    const card = document.getElementById('auth-card');
    if (card?.parentElement) {
      card.parentElement.classList.toggle('auth-mode-register', mode === 'register');
    }
    if (options.role && mode === 'register') {
      const roleSelect = document.getElementById('register-role');
      if (roleSelect) roleSelect.value = options.role;
    }
    landing?.classList.add('hidden');
    auth?.classList.remove('hidden');
    lucide.createIcons();
  }

  /* ── TOAST ───────────────────────────────────────── */
  function toast(msg, type='info', duration=3500) {
    const icons = { success:'check-circle', error:'alert-circle', warning:'alert-triangle', info:'info' };
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<i data-lucide="${icons[type]||'info'}"></i><span>${msg}</span>`;
    container.appendChild(el);
    lucide.createIcons();
    setTimeout(() => el.remove(), duration);
  }

  /* ── HELPERS ─────────────────────────────────────── */
  function openTicket(alertId) {
    ModuleMaintenance.openNewTicket(alertId);
  }

  function getApiBase() {
    return _apiBase.replace(/\/$/, '');
  }

  function refreshCurrentModule() {
    _navigateTo(_currentModule);
  }

  function downloadFile(filename, content, mime='text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportTableLike(filename, rows) {
    const csv = rows
      .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadFile(filename, csv, 'text/csv;charset=utf-8');
    toast(`Export ${filename} généré`, 'success');
  }

  function openInfo(title, message) {
    openModal(title, `<p style="color:var(--text-secondary);line-height:1.6">${message}</p>`, `<button class="btn btn-primary" onclick="App.closeModal()">Fermer</button>`);
  }

  function _syncLandingMetrics() {
    const metrics = NukunuData.getLandingMetrics();
    const mapping = {
      'landing-metric-assets': `${Number(metrics.assetsMw || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWc`,
      'landing-metric-pr': `${Number(metrics.prAvg || 0).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
      'landing-metric-revenue': fmtEur(metrics.revenueYtd || 0),
      'landing-metric-tickets': String(metrics.openTickets || 0),
      'landing-metric-alerts': String(metrics.criticalAlerts || 0),
    };
    Object.entries(mapping).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  function _openLandingShowcase() {
    const profiles = Object.entries(Profile.PROFILES).map(([key, value]) => `
      <button class="btn btn-secondary" style="justify-content:flex-start" onclick="App.closeModal(); App.showAuth('register', { role: '${key}' })">
        <i data-lucide="${value.icon}"></i>${value.label}
      </button>
    `).join('');

    openModal(
      'Découvrir la plateforme',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-4)">
        <p style="color:var(--text-secondary);line-height:1.6">Nukunu Solar regroupe le monitoring, la maintenance, la conformité, la facturation, le CRM et l’optimisation dans un même cockpit. Choisis un profil pour préremplir l’inscription, ou explore les modules depuis la page d’accueil.</p>
        <div class="section-grid section-grid--2" style="gap:var(--sp-3)">
          <div class="card" style="padding:var(--sp-4)">
            <div style="font-weight:700;margin-bottom:var(--sp-2)">Modules clés</div>
            <div style="display:flex;flex-direction:column;gap:var(--sp-2);color:var(--text-secondary)">
              <span>Monitoring multi-sites et alertes contextualisées</span>
              <span>Maintenance avec tickets, planning et SLA</span>
              <span>Conformité documentaire et audits</span>
              <span>Facturation, reporting, CRM et optimisation</span>
            </div>
          </div>
          <div class="card" style="padding:var(--sp-4)">
            <div style="font-weight:700;margin-bottom:var(--sp-2)">Commencer avec un profil</div>
            <div style="display:flex;flex-direction:column;gap:var(--sp-2)">${profiles}</div>
          </div>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Fermer</button><button class="btn btn-primary" onclick="document.getElementById('landing-sections')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); App.closeModal();">Voir la page</button>`
    );
  }

  function _openHelpCenter() {
    openModal(
      'Centre d’aide',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-4)">
        <div class="card" style="padding:var(--sp-4)">
          <div style="font-weight:700;margin-bottom:var(--sp-2)">Navigation rapide</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2);color:var(--text-secondary)">
            <span>Le profil connecté détermine les modules visibles et les données autorisées.</span>
            <span>Le centre de notifications regroupe alertes, documents à corriger, tickets ouverts et brouillons.</span>
            <span>Les exports reporting/facturation utilisent maintenant des aperçus imprimables ou des CSV détaillés.</span>
          </div>
        </div>
        <div class="section-grid section-grid--2" style="gap:var(--sp-3)">
          <button class="btn btn-secondary" onclick="App.navigateTo('account'); App.closeModal();"><i data-lucide="user"></i>Mon compte</button>
          <button class="btn btn-secondary" onclick="App.navigateTo('monitoring'); App.closeModal();"><i data-lucide="activity"></i>Monitoring</button>
          <button class="btn btn-secondary" onclick="App.navigateTo('maintenance'); App.closeModal();"><i data-lucide="wrench"></i>Maintenance</button>
          <button class="btn btn-secondary" onclick="App.navigateTo('reporting'); App.closeModal();"><i data-lucide="bar-chart-2"></i>Reporting</button>
        </div>
      </div>`,
      `<button class="btn btn-primary" onclick="App.closeModal()">Fermer</button>`
    );
  }

  function _notificationFooter() {
    return `<button class="btn btn-ghost" onclick="App.closeModal()">Fermer</button><button class="btn btn-secondary" onclick="App.markAllNotificationsRead()">Tout marquer comme lu</button>`;
  }

  function _notificationItem(notification) {
    return `
      <div class="card" style="padding:var(--sp-4);border-color:${notification.read ? 'var(--border)' : 'rgba(245,158,11,.28)'}">
        <div style="display:flex;align-items:flex-start;gap:var(--sp-3)">
          <span class="badge badge--${notification.level === 'critical' ? 'red' : notification.level === 'warning' ? 'yellow' : 'blue'}">${notification.level.toUpperCase()}</span>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:4px">${notification.title}</div>
            <div style="color:var(--text-secondary);font-size:var(--text-sm);line-height:1.5">${notification.message}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-3)">
          <button class="btn btn-sm btn-ghost" onclick="App.dismissNotification('${notification.id}')"><i data-lucide="x"></i>Masquer</button>
          <button class="btn btn-sm btn-secondary" onclick="App.openNotification('${notification.id}')">${notification.actionLabel || 'Ouvrir'}</button>
        </div>
      </div>`;
  }

  function _openNotificationsCenter() {
    const notifications = NukunuData.getNotifications();
    openModal(
      'Notifications',
      notifications.length
        ? `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">${notifications.map(_notificationItem).join('')}</div>`
        : `<p style="color:var(--text-secondary)">Aucune notification active.</p>`,
      _notificationFooter()
    );
  }

  async function _restoreSession() {
    try {
      const token = window.NukunuStore.get('nukunu_token');
      if (!token) return false;
      const res = await fetch(`${getApiBase()}/api/account`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Session invalide');
      const data = await res.json().catch(() => ({}));
      const remember = window.NukunuStore.isRemembered();
      window.NukunuStore.setAuthState({
        nukunu_session: 'true',
        nukunu_token: token,
        nukunu_user_name: data.user.name,
        nukunu_user_email: data.user.email,
        nukunu_user_role: data.user.role,
        nukunu_user_id: String(data.user.id),
        nukunu_profile: data.user.role,
      }, remember);
      Profile.activate(data.user.role, false);
      return true;
    } catch (err) {
      window.NukunuStore.clearAuth();
      return false;
    }
  }

  function _syncUserUI() {
    const name = window.NukunuStore.get('nukunu_user_name') || 'Nukunu Solar';
    const initials = name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
    const avatar = document.getElementById('avatar-btn');
    if (avatar) avatar.textContent = initials || 'NS';
  }

  function fmt(n, unit='', decimals=0) {
    if (n === null || n === undefined) return '—';
    const val = Number(n).toLocaleString('fr-FR', { maximumFractionDigits: decimals });
    return unit ? `${val} ${unit}` : val;
  }

  function fmtEur(n) {
    return fmt(n, '€', 0);
  }

  function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  }

  function openPrintDocument(filename, title, bodyHtml) {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
    const documentHtml = `<!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
          h1 { margin-bottom: 8px; }
          .meta { color: #475569; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          th { background: #f8fafc; }
          .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">Généré le ${new Date().toLocaleString('fr-FR')}</div>
        ${bodyHtml}
      </body>
      </html>`;

    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(documentHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      toast(`${filename} prêt pour impression / PDF`, 'success');
      return;
    }

    downloadFile(filename.replace(/\.(pdf|html)$/i, '.html'), documentHtml, 'text/html;charset=utf-8');
  }

  function openMailClient(recipients, subject, body) {
    const normalizedRecipients = String(recipients || '').replace(/\s*;\s*/g, ',');
    const mailto = `mailto:${encodeURIComponent(normalizedRecipients)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  async function readFileAsDataUrl(file) {
    if (!file) return null;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function openNotification(id) {
    const notification = NukunuData.getNotifications().find(item => item.id === id);
    if (!notification) return;
    await NukunuData.markNotificationRead(id);
    closeModal();
    if (notification.actionKind === 'ticket') {
      openTicket(notification.actionValue);
      return;
    }
    if (notification.actionKind === 'prospect') {
      _navigateTo('vente');
      setTimeout(() => ModuleVente.relaunchProspect(notification.actionValue), 200);
      return;
    }
    _navigateTo(notification.module || notification.actionValue || 'monitoring');
  }

  async function dismissNotification(id) {
    await NukunuData.dismissNotification(id);
    _updateGlobalBadges();
    _openNotificationsCenter();
  }

  async function markAllNotificationsRead() {
    await NukunuData.markAllNotificationsRead();
    _updateGlobalBadges();
    _openNotificationsCenter();
  }

  function _openForgotPasswordModal(token = '') {
    openModal(
      'Réinitialiser le mot de passe',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group">
          <label class="form-label">Email du compte</label>
          <input class="form-input" id="forgot-email" type="email" value="${window.NukunuStore.get('nukunu_user_email') || ''}" placeholder="vous@exemple.com">
        </div>
        <div class="form-group">
          <label class="form-label">Token de réinitialisation</label>
          <input class="form-input" id="forgot-token" value="${token}" placeholder="Le token sera généré automatiquement en local">
        </div>
        <div class="form-group">
          <label class="form-label">Nouveau mot de passe</label>
          <input class="form-input" id="forgot-password-new" type="password" placeholder="Au moins 8 caractères">
        </div>
        <div class="form-group">
          <label class="form-label">Confirmer le mot de passe</label>
          <input class="form-input" id="forgot-password-confirm" type="password" placeholder="Répéter le mot de passe">
        </div>
        <p style="font-size:var(--text-xs);color:var(--text-muted)">En environnement local, le serveur génère directement un token temporaire pour terminer la réinitialisation dans cette fenêtre.</p>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Fermer</button><button class="btn btn-secondary" onclick="App.requestPasswordReset()">Générer le token</button><button class="btn btn-primary" onclick="App.resetPassword()">Mettre à jour</button>`
    );
  }

  async function requestPasswordReset() {
    const email = document.getElementById('forgot-email')?.value?.trim();
    if (!email) {
      toast('Merci de renseigner un email.', 'warning');
      return;
    }
    try {
      const response = await fetch(`${getApiBase()}/api/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erreur de réinitialisation');
      if (data.resetToken) {
        const tokenField = document.getElementById('forgot-token');
        if (tokenField) tokenField.value = data.resetToken;
      }
      toast(data.message || 'Token préparé.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function resetPassword() {
    const token = document.getElementById('forgot-token')?.value?.trim();
    const newPassword = document.getElementById('forgot-password-new')?.value || '';
    const confirmPassword = document.getElementById('forgot-password-confirm')?.value || '';
    try {
      const response = await fetch(`${getApiBase()}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Impossible de réinitialiser le mot de passe.');
      closeModal();
      toast('Mot de passe mis à jour. Tu peux te reconnecter.', 'success');
      showAuth('login');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  return {
    init,
    openModal,
    closeModal,
    toast,
    registerChart,
    destroyCharts,
    openTicket,
    fmt,
    fmtEur,
    logout,
    togglePassword,
    getApiBase,
    refreshCurrentModule,
    downloadFile,
    exportTableLike,
    openInfo,
    showAuth,
    navigateTo: _navigateTo,
    openPrintDocument,
    openMailClient,
    readFileAsDataUrl,
    openNotification,
    dismissNotification,
    markAllNotificationsRead,
    requestPasswordReset,
    resetPassword
  };
})();

/* ── BOOT ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());
