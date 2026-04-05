/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — PROFILE.JS
   Profile detection, persistence and UI adaptation
═══════════════════════════════════════════════════════════ */

const Profile = (() => {

  const PROFILES = {
    installateur: {
      label:      'Installateur',
      badge:      'INSTALLATEUR',
      icon:       'hard-hat',
      color:      '#3B82F6',
      navHide:    [],   /* all modules visible */
      modules:    ['monitoring','reporting','maintenance','facturation','conformite','vente','optimisation'],
    },
    fonds: {
      label:      'Fonds / Agrégateur',
      badge:      'FONDS',
      icon:       'trending-up',
      color:      '#8B5CF6',
      modules:    ['monitoring','reporting','maintenance','facturation','conformite','vente','optimisation'],
    },
    industriel: {
      label:      'Industriel',
      badge:      'INDUSTRIEL',
      icon:       'factory',
      color:      '#F59E0B',
      modules:    ['monitoring','reporting','maintenance','facturation','conformite','optimisation'],
      navHide:    ['vente'],
    },
    particulier: {
      label:      'Particulier',
      badge:      'PARTICULIER',
      icon:       'home',
      color:      '#22C55E',
      modules:    ['monitoring','reporting','maintenance','facturation','conformite','optimisation'],
      navHide:    ['vente'],
    },
    super_admin: {
      label:      'Administrateur SaaS',
      badge:      'SUPER-ADMIN',
      icon:       'shield-check',
      color:      '#F59E0B',
      modules:    ['admin','account'],
      navHide:    ['monitoring','reporting','maintenance','facturation','conformite','vente','optimisation'],
    },
  };

  let current = null;

  function _allowedRole() {
    return window.NukunuStore.get('nukunu_user_role');
  }

  /* ── INIT ──── */
  function init() {
    const saved = window.NukunuStore.get('nukunu_profile');
    if (saved && PROFILES[saved]) {
      activate(saved, false);
    }
  }

  /* ── ACTIVATE ── */
  function activate(key, animate = true) {
    if (!PROFILES[key]) return;
    const allowedRole = _allowedRole();
    if (allowedRole && key !== allowedRole) {
      key = allowedRole;
    }
    current = key;
    window.NukunuStore.set('nukunu_profile', key, window.NukunuStore.isRemembered());
    document.body.dataset.profile = key;
    _updateUI(key);
    if (animate) App.toast(`Profil ${PROFILES[key].label} activé`, 'success');
    return PROFILES[key];
  }

  /* ── GET ─── */
  function get() { return current; }
  function getData() { return PROFILES[current]; }
  function getConfig(key) { return PROFILES[key]; }

  /* ── UPDATE UI ─── */
  function _updateUI(key) {
    const p = PROFILES[key];

    /* Badge + icon in topbar */
    const badge  = document.getElementById('topbar-profile-badge');
    const icon   = document.getElementById('topbar-profile-icon');
    const label  = document.getElementById('topbar-profile-label');
    if (badge) { badge.dataset.profile = key; }
    if (label) label.textContent = p.badge;
    if (icon)  { icon.setAttribute('data-lucide', p.icon); lucide.createIcons(); }

    /* Sidebar profile switcher */
    const sw = document.getElementById('profile-switcher-label');
    const si = document.getElementById('profile-switcher-icon');
    if (sw) sw.textContent = p.label;
    if (si) { si.setAttribute('data-lucide', p.icon); lucide.createIcons(); }

    /* Hide nav items not relevant to this profile */
    const hideSet = new Set(p.navHide || []);
    document.querySelectorAll('.nav-item').forEach(el => {
      const mod = el.dataset.module;
      if (mod && hideSet.has(mod)) {
        el.style.display = 'none';
        el.classList.add('hidden'); // Add both for safety
      } else {
        el.style.display = '';
        el.classList.remove('hidden');
      }
    });

    /* Always hide specific section labels for super_admin */
    document.querySelectorAll('.nav-section-label').forEach(el => {
      const txt = el.textContent.trim().toLowerCase();
      const forbidden = ['supervision', 'opérations', 'développement', 'supervision', 'operations', 'developpement'];
      if (key === 'super_admin' && forbidden.includes(txt)) {
        el.style.setProperty('display', 'none', 'important');
      } else {
        el.style.display = '';
      }
    });

    /* Always hide specific section labels for super_admin */
    const isSuperAdmin = (key === 'super_admin');
    document.querySelectorAll('.nav-section-label').forEach(el => {
      el.style.display = isSuperAdmin ? 'none' : '';
    });
    
    lucide.createIcons();
  }

  return { init, activate, get, getData, getConfig, PROFILES };
})();
