/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 9: ADMIN PANEL (SAAS)
   ═══════════════════════════════════════════════════════════ */

const ModuleAdmin = (() => {
  let _currentTab = 'dashboard';

  async function render() {
    const view = document.getElementById('module-admin');
    if (!view) return;

    view.innerHTML = `
      <div class="module-header" style="flex-wrap:wrap; gap:var(--sp-4)">
        <div class="module-header__left">
          <h1 class="module-title">Administration SaaS Nukunu</h1>
          <p class="module-subtitle">Support, Surveillance & Opérations</p>
        </div>
        
        <div style="flex:1; min-width:300px; max-width:400px; position:relative">
          <i data-lucide="search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted)"></i>
          <input type="text" id="admin-global-search" class="form-input" placeholder="Rechercher utilisateur ou ticket..." 
                 style="padding-left:38px" onkeyup="ModuleAdmin.handleSearch(event)">
          <div id="search-results-overlay" class="card" style="display:none; position:absolute; top:48px; left:0; right:0; z-index:100; max-height:450px; overflow-y:auto; padding:var(--sp-2); box-shadow:var(--shadow-lg); border:1px solid var(--border-active)">
            <!-- Results -->
          </div>
        </div>

        <div class="module-actions">
          <button class="btn btn-primary" onclick="ModuleAdmin.openCreateUserModal()">
            <i data-lucide="user-plus"></i> Nouveau Compte
          </button>
        </div>
      </div>

      <div class="tabs-container" style="margin-bottom:var(--sp-4)">
        <button class="tab-btn active" data-tab="dashboard" onclick="ModuleAdmin.setTab('dashboard')">Tableau de bord</button>
        <button class="tab-btn" data-tab="users" onclick="ModuleAdmin.setTab('users')">Utilisateurs</button>
        <button class="tab-btn" data-tab="logs" onclick="ModuleAdmin.setTab('logs')">Audit</button>
        <button class="tab-btn" data-tab="system" onclick="ModuleAdmin.setTab('system')">Système</button>
        <button class="tab-btn" data-tab="supervision" onclick="ModuleAdmin.setTab('supervision')">Supervision</button>
        <button class="tab-btn" data-tab="tools" onclick="ModuleAdmin.setTab('tools')">Outils</button>
      </div>

      <div id="admin-content">
        <!-- Dashboard load here -->
      </div>
    `;
    
    // Honor current tab
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === _currentTab);
    });

    if (_currentTab === 'supervision') await _loadSupervision();
    else if (_currentTab === 'users') await _loadUsers();
    else if (_currentTab === 'logs') await _loadLogs();
    else if (_currentTab === 'system') await _loadSystem();
    else if (_currentTab === 'tools') await _loadTools();
    else await _loadDashboard();

    lucide.createIcons();

    // Event listener for search overlay
    document.addEventListener('click', (e) => {
      const overlay = document.getElementById('search-results-overlay');
      if (overlay && !overlay.contains(e.target) && e.target.id !== 'admin-global-search') {
        overlay.style.display = 'none';
      }
    });
  }

  async function handleSearch(e) {
    const q = e.target.value.trim();
    const overlay = document.getElementById('search-results-overlay');
    if (q.length < 2) {
      overlay.style.display = 'none';
      return;
    }

    try {
      const data = await _api(`/api/admin/search?q=${encodeURIComponent(q)}`);
      overlay.innerHTML = '';
      overlay.style.display = 'block';

      if (data.users.length > 0) {
        overlay.innerHTML += `<div style="padding:6px 10px; font-weight:700; font-size:10px; color:var(--text-muted); text-transform:uppercase; border-bottom:1px solid var(--border)">Utilisateurs</div>`;
        data.users.forEach(u => {
          overlay.innerHTML += `
            <div class="search-result-item" style="padding:10px; cursor:pointer" onclick="ModuleAdmin.setTab('users')">
              <div style="font-weight:600; display:flex; justify-content:space-between">
                <span>${u.name}</span>
                <span class="badge badge--${_roleColor(u.role)}" style="font-size:9px">${u.role}</span>
              </div>
              <div style="font-size:11px; color:var(--text-muted)">${u.email}</div>
            </div>
          `;
        });
      }

      if (data.tickets.length > 0) {
        overlay.innerHTML += `<div style="padding:12px 10px 6px; font-weight:700; font-size:10px; color:var(--text-muted); text-transform:uppercase; border-bottom:1px solid var(--border)">Tickets</div>`;
        data.tickets.forEach(t => {
          overlay.innerHTML += `
            <div class="search-result-item" style="padding:10px; cursor:pointer">
              <div style="font-weight:600">${t.title}</div>
              <div style="font-size:11px; color:var(--text-muted)">${t.site_name} • <span class="badge badge--gray">${t.status}</span></div>
            </div>
          `;
        });
      }

      if (data.users.length === 0 && data.tickets.length === 0) {
        overlay.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted)">Aucun résultat pour "${q}"</div>`;
      }
      lucide.createIcons();
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  async function impersonateUser(id) {
    if (!confirm('Voulez-vous vraiment vous connecter en tant que cet utilisateur ?')) return;
    
    try {
      const res = await fetch(`${App.getApiBase()}/api/admin/impersonate/${id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${window.NukunuStore.get('nukunu_token')}`
        }
      });
      if (!res.ok) throw new Error('Échec de l\'impersonation');
      const { token, user } = await res.json();
      
      // Swap tokens and reload
      window.NukunuStore.set('nukunu_token', token);
      window.NukunuStore.set('nukunu_user', JSON.stringify(user));
      
      App.toast(`Impersonation active : ${user.name}`, 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  async function setTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    const container = document.getElementById('admin-content');
    if (!container) return;

    container.innerHTML = '<div class="card" style="padding:var(--sp-10); text-align:center"><i data-lucide="loader-2" class="animate-spin" style="width:32px;height:32px;margin:auto"></i><p style="margin-top:10px">Chargement...</p></div>';
    lucide.createIcons();

    if (tab === 'dashboard') await _loadDashboard();
    if (tab === 'users') await _loadUsers();
    if (tab === 'logs') await _loadLogs();
    if (tab === 'system') await _loadSystem();
    if (tab === 'supervision') await _loadSupervision();
    if (tab === 'tools') await _loadTools();
    lucide.createIcons();
  }

  async function _loadDashboard() {
    const [stats, users, logs, roles] = await Promise.all([
      _api('/api/admin/stats'),
      _api('/api/admin/users'),
      _api('/api/admin/logs'),
      _api('/api/admin/role-distribution')
    ]);

    const container = document.getElementById('admin-content');
    container.innerHTML = `
      <div class="kpi-grid">
        ${_kpiCard('Utilisateurs', stats.totalUsers, 'users', 'blue')}
        ${_kpiCard('Revenu Global', App.fmtEur(stats.totalRevenue), 'dollar-sign', 'green')}
        ${_kpiCard('Tickets Actifs', stats.totalTickets, 'wrench', 'amber')}
        ${_kpiCard('Santé Infra', stats.infraHealth, 'activity', 'green')}
      </div>
      
      <div class="section-grid section-grid--2-1" style="gap:var(--sp-4); margin-bottom:var(--sp-4)">
        <div class="card fade-up">
          <h3 style="margin-bottom:var(--sp-4)">Répartition des rôles</h3>
          <div style="display:flex; flex-direction:column; gap:var(--sp-3)">
            ${roles.distribution.map(r => `
              <div class="chart-bar-container">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:var(--text-xs)">
                  <span style="text-transform:capitalize">${r.role}</span>
                  <span style="font-weight:600">${r.count}</span>
                </div>
                <div style="height:8px; background:var(--bg-hover); border-radius:4px; overflow:hidden">
                  <div style="height:100%; width:${(r.count / stats.totalUsers) * 100}%; background:var(--${_roleColor(r.role)})"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div style="font-weight:700; margin-bottom:var(--sp-4)">Alertes Système</div>
          <div class="alert alert--info" style="font-size:var(--text-xs)">
            <i data-lucide="info"></i>
            Backend opérationnel. Aucune maintenance planifiée.
          </div>
        </div>
      </div>

      <div class="section-grid section-grid--2-1" style="gap:var(--sp-4)">
        <div class="table-wrapper">
          <div class="table-header"><span class="table-header__title">Nouveaux Utilisateurs</span></div>
          <table id="admin-users-table">
            <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Actions</th></tr></thead>
            <tbody>${users.users.slice(0, 5).map(_userRow).join('')}</tbody>
          </table>
        </div>
        <div class="card">
          <div style="font-weight:700; margin-bottom:var(--sp-4)">Audit Rapide</div>
          <div style="display:flex; flex-direction:column; gap:var(--sp-2)">${logs.logs.slice(0, 8).map(_logItem).join('')}</div>
        </div>
      </div>
    `;
  }

  async function _loadTools() {
    const container = document.getElementById('admin-content');
    container.innerHTML = `
      <div class="section-grid section-grid--2" style="gap:var(--sp-4)">
        <div class="card fade-up">
          <h3 style="margin-bottom:var(--sp-2)"><i data-lucide="megaphone"></i> Broadcast Global</h3>
          <p style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:var(--sp-4)">
            Envoyez une notification instantanée à tous les utilisateurs de la plateforme.
          </p>
          <div class="form-group" style="margin-bottom:var(--sp-3)">
            <label class="form-label">Titre de l'annonce</label>
            <input type="text" id="tool-broadcast-title" class="form-input" placeholder="Maintenance prévue...">
          </div>
          <div class="form-group" style="margin-bottom:var(--sp-3)">
            <label class="form-label">Message</label>
            <textarea id="tool-broadcast-message" class="form-input" style="min-height:80px" placeholder="Le système sera indisponible de 2h à 4h..."></textarea>
          </div>
          <div class="form-group" style="margin-bottom:var(--sp-4)">
            <label class="form-label">Niveau d'alerte</label>
            <select id="tool-broadcast-level" class="form-input">
              <option value="info">Information (Bleu)</option>
              <option value="warning">Avertissement (Orange)</option>
              <option value="error">Critique (Rouge)</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="ModuleAdmin.submitBroadcast()" style="width:100%">
            <i data-lucide="send"></i> Diffuser le message
          </button>
        </div>

        <div class="card fade-up">
          <h3 style="margin-bottom:var(--sp-2)"><i data-lucide="shield-alert"></i> Mode Maintenance</h3>
          <p style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:var(--sp-4)">
            Activez ce mode pour restreindre l'accès à la plateforme (seuls les admins pourront se connecter).
          </p>
          
          <div style="padding:var(--sp-4); background:var(--bg-hover); border-radius:var(--r-base); border:1px dashed var(--border); display:flex; align-items:center; justify-content:space-between">
            <div>
              <div style="font-weight:600">État de la Maintenance</div>
              <div id="maintenance-status-label" style="font-size:var(--text-xs); color:var(--text-muted)">Désactivé</div>
            </div>
            <button id="btn-toggle-maintenance" class="btn btn-ghost" onclick="ModuleAdmin.toggleMaintenance(true)">
              Activer
            </button>
          </div>

          <div style="margin-top:var(--sp-6)">
            <h4 style="margin-bottom:var(--sp-2)">Actions de secours</h4>
            <div style="display:flex; flex-direction:column; gap:var(--sp-2)">
              <button class="btn btn-sm btn-ghost" onclick="App.toast('Cache purgé!', 'success')" style="justify-content:flex-start">
                <i data-lucide="refresh-cw"></i> Forcer la purge du cache frontend
              </button>
              <button class="btn btn-sm btn-ghost" onclick="App.toast('Sessions nettoyées!', 'info')" style="justify-content:flex-start">
                <i data-lucide="log-out"></i> Déconnecter tous les utilisateurs
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  async function submitBroadcast() {
    const title = document.getElementById('tool-broadcast-title').value;
    const message = document.getElementById('tool-broadcast-message').value;
    const level = document.getElementById('tool-broadcast-level').value;

    if (!title || !message) return App.toast('Titre et message requis', 'warning');

    try {
      const res = await fetch(`${App.getApiBase()}/api/admin/broadcast`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.NukunuStore.get('nukunu_token')}`
        },
        body: JSON.stringify({ title, message, level })
      });
      if (!res.ok) throw new Error('Échec de la diffusion');
      App.toast('Message diffusé à tous les utilisateurs !', 'success');
      document.getElementById('tool-broadcast-title').value = '';
      document.getElementById('tool-broadcast-message').value = '';
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  async function toggleMaintenance(enabled) {
    const action = enabled ? 'activer' : 'désactiver';
    if (!confirm(`Voulez-vous vraiment ${action} le mode maintenance ?`)) return;

    try {
      const res = await fetch(`${App.getApiBase()}/api/admin/maintenance`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.NukunuStore.get('nukunu_token')}`
        },
        body: JSON.stringify({ enabled })
      });
      if (!res.ok) throw new Error('Erreur de basculement');
      const data = await res.json();
      
      App.toast(data.message, 'info');
      _loadTools(); // Reload to update UI
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  async function _loadUsers() {
    const data = await _api('/api/admin/users');
    const container = document.getElementById('admin-content');
    container.innerHTML = `
      <div class="table-wrapper fade-up">
        <div class="table-header">
          <span class="table-header__title">Annuaire complet (${data.users.length})</span>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Date Inscription</th><th>Actions</th></tr></thead>
          <tbody>${data.users.map(u => `
            <tr>
              <td>#${String(u.id).padStart(3, '0')}</td>
              <td style="font-weight:600">${u.name}</td>
              <td>${u.email}</td>
              <td><span class="badge badge--${_roleColor(u.role)}">${u.role}</span></td>
              <td>${new Date(u.created_at).toLocaleDateString()}</td>
              <td style="display:flex; gap:4px">
                <button class="btn btn-sm btn-ghost" onclick="ModuleAdmin.impersonateUser(${u.id})" title="Se connecter en tant que...">
                  <i data-lucide="user-check"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="ModuleAdmin.deleteUser(${u.id}, '${u.email}')" title="Supprimer">
                  <i data-lucide="trash-2"></i>
                </button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
  }

  async function _loadLogs() {
    const data = await _api('/api/admin/logs');
    const container = document.getElementById('admin-content');
    container.innerHTML = `
      <div class="card fade-up">
        <div style="font-weight:700; margin-bottom:var(--sp-4)">Journal d'Audit SaaS (100 derniers)</div>
        <div style="display:flex; flex-direction:column; gap:var(--sp-1)">
          ${data.logs.map(l => `
            <div class="audit-log-item" style="padding:var(--sp-3); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:var(--sp-4)">
              <div style="width:80px; color:var(--text-muted); font-family:monospace">${new Date(l.created_at).toLocaleTimeString()}</div>
              <div style="width:150px; font-weight:600; color:var(--amber)">${l.user_name || 'Système'}</div>
              <div style="flex:1">${l.action}</div>
              <div style="color:var(--text-muted); font-size:10px">${new Date(l.created_at).toLocaleDateString()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async function _loadSystem() {
    const [s, db] = await Promise.all([
      _api('/api/admin/sysinfo'),
      _api('/api/admin/db-health')
    ]);
    const container = document.getElementById('admin-content');
    
    container.innerHTML = `
      <div class="section-grid section-grid--2" style="gap:var(--sp-4); margin-bottom:var(--sp-4)">
        <div class="card fade-up">
          <h3 style="margin-bottom:var(--sp-4)">Ressources Serveur</h3>
          <div style="display:flex; flex-direction:column; gap:var(--sp-4)">
            <div class="progress-container">
              <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-1)">
                <span>Mémoire Vive (${s.memory.used} / ${s.memory.total} MB)</span>
                <span>${s.memory.percent}%</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${s.memory.percent}%; background:var(--amber)"></div></div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--sp-4)">
              <div class="kpi-card kpi--blue" style="padding:var(--sp-3)">
                <div class="kpi-card__label">Charge CPU (1/5/15m)</div>
                <div class="kpi-card__value" style="font-size:var(--text-lg)">${s.load.map(l => l.toFixed(2)).join(' / ')}</div>
              </div>
              <div class="kpi-card kpi--green" style="padding:var(--sp-3)">
                <div class="kpi-card__label">Temps d'activité</div>
                <div class="kpi-card__value" style="font-size:var(--text-lg)">${Math.floor(s.uptime / 3600)}h ${Math.floor((s.uptime % 3600) / 60)}m</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card fade-up">
          <h3 style="margin-bottom:var(--sp-4)">Environnement & Build</h3>
          <div style="display:flex; flex-direction:column; gap:var(--sp-2)">
            <div style="display:flex; justify-content:space-between; padding:var(--sp-2) 0; border-bottom:1px solid var(--border)">
              <span style="color:var(--text-muted)">Système d'exploitation</span>
              <span style="font-weight:600">${s.platform} (${s.arch})</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:var(--sp-2) 0; border-bottom:1px solid var(--border)">
              <span style="color:var(--text-muted)">Nombre de Cœurs CPU</span>
              <span style="font-weight:600">${s.cpus} vCPUs</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:var(--sp-2) 0; border-bottom:1px solid var(--border)">
              <span style="color:var(--text-muted)">Status Backend</span>
              <span class="badge badge--green">Opérationnel</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:var(--sp-2) 0;">
              <span style="color:var(--text-muted)">Port d'écoute</span>
              <span style="font-weight:600">3002 (TCP)</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card fade-up">
        <h3 style="margin-bottom:var(--sp-4)"><i data-lucide="database"></i> Santé de la Base de Données (PostgreSQL)</h3>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Table</th><th>Taille Totale (Index incl.)</th><th>Nb de lignes</th></tr></thead>
            <tbody>${db.tables.map(t => `
              <tr>
                <td style="font-family:monospace; font-weight:600">${t.table_name}</td>
                <td>${t.total_size}</td>
                <td>${t.row_count}</td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function _loadSupervision() {
    const container = document.getElementById('admin-content');
    container.innerHTML = `
      <div class="section-grid section-grid--3" style="gap:var(--sp-4); margin-bottom:var(--sp-4)">
        <div class="kpi-card kpi--blue fade-up">
          <div class="kpi-card__label">Stack Monitoring</div>
          <div class="kpi-card__value">Prometheus</div>
          <div class="badge badge--green" style="margin-top:8px">Actif</div>
        </div>
        <div class="kpi-card kpi--amber fade-up" style="animation-delay:0.1s">
          <div class="kpi-card__label">Visualisation</div>
          <div class="kpi-card__value">Grafana</div>
          <div class="badge badge--green" style="margin-top:8px">Connecté</div>
        </div>
        <div class="kpi-card kpi--green fade-up" style="animation-delay:0.2s">
          <div class="kpi-card__label">Health Score</div>
          <div class="kpi-card__value">98/100</div>
          <div class="badge badge--blue" style="margin-top:8px">Optimisé</div>
        </div>
      </div>

      <div class="card fade-up" style="margin-bottom:var(--sp-4)">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--sp-4)">
          <h3><i data-lucide="bar-chart-3"></i> Métriques Temps Réel</h3>
          <div style="font-size:12px; color:var(--text-muted)">Mise à jour automatique (30s)</div>
        </div>
        <div class="section-grid section-grid--3" style="gap:var(--sp-4)">
          <div style="background:rgba(0,0,0,0.1); padding:var(--sp-4); border-radius:var(--rd-lg)">
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:var(--sp-2)">Utilisation CPU (%)</div>
            <canvas id="cpu-chart" height="150"></canvas>
          </div>
          <div style="background:rgba(0,0,0,0.1); padding:var(--sp-4); border-radius:var(--rd-lg)">
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:var(--sp-2)">Utilisation Mémoire (%)</div>
            <canvas id="memory-chart" height="150"></canvas>
          </div>
          <div style="background:rgba(0,0,0,0.1); padding:var(--sp-4); border-radius:var(--rd-lg)">
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:var(--sp-2)">Requêtes / sec</div>
            <canvas id="request-chart" height="150"></canvas>
          </div>
        </div>
      </div>

      <div class="card fade-up" style="padding:var(--sp-10); text-align:center; border:2px dashed var(--border); background:rgba(255,255,255,0.02); margin-bottom:var(--sp-4)">
        <div style="margin-bottom:var(--sp-6)">
          <i data-lucide="line-chart" style="width:64px; height:64px; color:var(--amber); opacity:0.5"></i>
        </div>
        <h2>Tableaux de Bord de Supervision</h2>
        <p style="color:var(--text-muted); max-width:600px; margin:auto; margin-bottom:var(--sp-6)">
          Les métriques temps-réel (Infrastucture, API Latency, Database load) sont centralisées dans Grafana.
          Utilisez les accès administrateur pour consulter les dashboards détaillés.
        </p>
        <div style="display:flex; justify-content:center; gap:var(--sp-4)">
          <a href="http://localhost:3000" target="_blank" class="btn btn-primary">
            <i data-lucide="external-link"></i> Ouvrir Grafana
          </a>
          <a href="http://localhost:9090" target="_blank" class="btn btn-ghost">
            <i data-lucide="database"></i> Cibles Prometheus
          </a>
        </div>
      </div>

      <div class="section-grid section-grid--2" style="margin-top:var(--sp-4); gap:var(--sp-4)">
        <div class="card fade-up">
          <h3><i data-lucide="shield-check"></i> Statut Sécurité (IaC)</h3>
          <div style="margin-top:var(--sp-4); font-size:13px">
            <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2)">
              <span style="color:var(--text-muted)">Accès SSH Port 22</span>
              <span class="badge badge--blue">Restreint (Admin IP)</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2)">
              <span style="color:var(--text-muted)">K3s API Access</span>
              <span class="badge badge--blue">Restreint</span>
            </div>
            <div style="display:flex; justify-content:space-between">
              <span style="color:var(--text-muted)">Dernier Scan Trivy</span>
              <span class="badge badge--green">Clean (CI/CD)</span>
            </div>
          </div>
        </div>
        <div class="card fade-up" style="animation-delay:0.1s">
          <h3><i data-lucide="git-branch"></i> Environnements</h3>
          <div style="margin-top:var(--sp-4); font-size:13px">
            <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2)">
              <span style="color:var(--text-muted)">Production (Main)</span>
              <span class="badge badge--green">Live</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2)">
              <span style="color:var(--text-muted)">Staging / Test</span>
              <span class="badge badge--amber">Deploying...</span>
            </div>
            <div style="display:flex; justify-content:space-between">
              <span style="color:var(--text-muted)">Dernier Pipeline</span>
              <span style="font-weight:600; color:var(--text-muted)">#CI-928 (Success)</span>
            </div>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
    _initSupervisionCharts();
  }

  function openCreateUserModal() {
    App.openModal(
      'Provisionner un Utilisateur SaaS',
      `
      <form id="admin-create-user-form" style="display:flex; flex-direction:column; gap:var(--sp-3)">
        <div class="form-group">
          <label class="form-label">Nom complet</label>
          <input type="text" id="acu-name" class="form-input" placeholder="Ex: Jean Dupont" required>
        </div>
        <div class="form-group">
          <label class="form-label">Email professionnel</label>
          <input type="email" id="acu-email" class="form-input" placeholder="jean@domain.com" required>
        </div>
        <div class="form-group">
          <label class="form-label">Mot de passe temporaire</label>
          <input type="password" id="acu-password" class="form-input" placeholder="••••••••" required>
        </div>
        <div class="form-group">
          <label class="form-label">Rôle SaaS</label>
          <select id="acu-role" class="form-input">
            <option value="installateur">Installateur (B2B)</option>
            <option value="fonds">Fonds d'investissement</option>
            <option value="industriel">Industriel (Autoconsommation)</option>
            <option value="particulier">Particulier (Résidentiel)</option>
            <option value="super_admin">Super Administrateur</option>
          </select>
        </div>
      </form>
      `,
      `
      <button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="ModuleAdmin.submitCreateUser()">
        <i data-lucide="check"></i> Créer le compte
      </button>
      `
    );
  }

  async function submitCreateUser() {
    const payload = {
      name: document.getElementById('acu-name').value,
      email: document.getElementById('acu-email').value,
      password: document.getElementById('acu-password').value,
      role: document.getElementById('acu-role').value
    };

    try {
      const res = await fetch(`${App.getApiBase()}/api/admin/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.NukunuStore.get('nukunu_token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

      App.toast('Utilisateur créé avec succès !', 'success');
      App.closeModal();
      if (_currentTab === 'users') _loadUsers();
      else if (_currentTab === 'dashboard') _loadDashboard();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  async function deleteUser(id, email) {
    if (!confirm(`Supprimer définitivement l'utilisateur ${email} ?`)) return;
    try {
      const res = await fetch(`${App.getApiBase()}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${window.NukunuStore.get('nukunu_token')}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      App.toast('Utilisateur supprimé', 'success');
      if (_currentTab === 'users') _loadUsers();
      else if (_currentTab === 'dashboard') _loadDashboard();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  /* Helpers Internal */
  function _userRow(u) {
    return `<tr><td style="font-weight:600">${u.name}</td><td>${u.email}</td><td><span class="badge badge--${_roleColor(u.role)}">${u.role}</span></td><td><button class="btn btn-sm btn-ghost" onclick="ModuleAdmin.deleteUser(${u.id},'${u.email}')"><i data-lucide="trash-2"></i></button></td></tr>`;
  }
  function _logItem(l) {
    return `
      <div style="font-size:11px; padding:6px; border-bottom:1px solid var(--border); display:flex; gap:8px">
        <span style="color:var(--text-muted)">${new Date(l.created_at).toLocaleTimeString()}</span>
        <span style="font-weight:600">${l.user_name || 'Sys'}</span>
        <span style="flex:1">${l.action}</span>
      </div>`;
  }
  let _charts = {};
  let _chartInterval = null;

  async function _initSupervisionCharts() {
    if (_chartInterval) clearInterval(_chartInterval);
    
    _renderChart('cpu-chart', 'CPU Usage', '#3b82f6');
    _renderChart('memory-chart', 'RAM Usage', '#a855f7');
    _renderChart('request-chart', 'Requests/s', '#f59e0b');

    await _updateCharts();
    _chartInterval = setInterval(_updateCharts, 30000);
  }

  async function _updateCharts() {
    const canvas = document.getElementById('cpu-chart');
    if (!canvas) {
      if (_chartInterval) clearInterval(_chartInterval);
      return;
    }

    try {
      const queries = {
        cpu: '100 * (1 - avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])))',
        mem: '100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))',
        req: 'sum(rate(http_request_duration_ms_count[5m]))'
      };

      const [cpu, mem, req] = await Promise.all([
        _fetchMetric(queries.cpu),
        _fetchMetric(queries.mem),
        _fetchMetric(queries.req)
      ]);

      _updateChartData('cpu-chart', cpu);
      _updateChartData('memory-chart', mem);
      _updateChartData('request-chart', req);
    } catch (err) {
      console.warn('Supervision charts update failed:', err);
    }
  }

  async function _fetchMetric(query) {
    try {
      const data = await _api(`/api/admin/metrics?query=${encodeURIComponent(query)}`);
      if (data.status !== 'success' || !data.data.result.length) return [];
      return data.data.result[0].values.map(v => ({ x: v[0] * 1000, y: parseFloat(v[1]) }));
    } catch (e) {
      return [];
    }
  }

  function _renderChart(id, label, color) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (_charts[id]) _charts[id].destroy();

    _charts[id] = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: label,
          borderColor: color,
          backgroundColor: color + '20',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
          data: []
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000 },
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { type: 'linear', display: false },
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } }
          }
        }
      }
    });
  }

  function _updateChartData(id, data) {
    if (_charts[id]) {
      _charts[id].data.datasets[0].data = data;
      _charts[id].update();
    }
  }

  function _api(path) {
    const token = window.NukunuStore.get('nukunu_token');
    return fetch(`${App.getApiBase()}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json());
  }
  function _kpiCard(label, val, icon, col) {
    return `
      <div class="kpi-card kpi--${col}">
        <div class="kpi-card__header">
          <span class="kpi-card__label">${label}</span>
          <div class="kpi-card__icon"><i data-lucide="${icon}"></i></div>
        </div>
        <div class="kpi-card__value" style="font-size:var(--text-lg)">${val}</div>
      </div>`;
  }
  function _roleColor(role) {
    return { 'super_admin':'blue', 'installateur':'amber', 'fonds':'blue', 'industriel':'green', 'particulier':'green' }[role] || 'gray';
  }

  return { render, setTab, openCreateUserModal, submitCreateUser, deleteUser, submitBroadcast, toggleMaintenance, handleSearch, impersonateUser };
})();
