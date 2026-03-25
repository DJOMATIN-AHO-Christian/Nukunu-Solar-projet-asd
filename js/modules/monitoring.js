/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 1: MONITORING & ALERTES
═══════════════════════════════════════════════════════════ */

const ModuleMonitoring = (() => {
  let _settingsLoaded = false;
  let _searchTerm = '';

  const DEFAULT_FILTERS = { site: 'all', status: 'all', alertLevel: 'all' };
  const DEFAULT_ALERTS = { channel: 'email_dashboard', critical: 'immediate', warning: 'daily_digest' };

  function render() {
    const profile = Profile.get();
    const view = document.getElementById('module-monitoring');
    if (!view) return;
    if (!_settingsLoaded) {
      view.innerHTML = '<div class="card">Chargement des préférences de monitoring...</div>';
      Promise.all([
        NukunuData.refreshSetting('monitoring_filters', DEFAULT_FILTERS),
        NukunuData.refreshSetting('monitoring_alerts', DEFAULT_ALERTS),
      ]).finally(() => {
        _settingsLoaded = true;
        render();
      });
      return;
    }

    if (profile === 'particulier') { _renderParticulier(view); }
    else if (profile === 'industriel') { _renderIndustriel(view); }
    else { _renderPro(view, profile); }
  }

  /* ── PARTICULIER ─────────────────────────────── */
  function _renderParticulier(view) {
    const d = NukunuData.sites.particulier;
    const live = d.live;
    const chartData = NukunuData.productionChart('particulier');
    const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Mon Installation</h1>
          <p class="module-subtitle">${d.name} · ${d.location} · ${d.power} kWc</p>
        </div>
        <div class="module-actions">
          <span class="badge badge--green"><span class="badge__dot"></span>Tout est OK</span>
          ${_renderLiveSyncBadge(live)}
        </div>
      </div>

      <div class="hero-number fade-up">
        <div class="hero-number__kw">${d.production_day}<span class="hero-number__unit">kWh</span></div>
        <div class="hero-number__label">produits aujourd'hui — ${todayLabel}</div>
        <div class="hero-number__saving">
          <i data-lucide="trending-down"></i>
          ${App.fmtEur(d.savings_day)} économisés sur votre facture EDF aujourd'hui
        </div>
      </div>

      ${_renderLiveWeatherStrip(live)}

      <div class="kpi-grid stagger" style="grid-template-columns:repeat(3,1fr)">
        ${_kpi('Ce mois','savings_month', App.fmtEur(d.savings_month), 'Economies réalisées','piggy-bank','green','+12%','up')}
        ${_kpi('Revente EDF','injection', App.fmtEur(d.revenue_injection_month), 'Revenus OA ce mois','euro','blue',null,null)}
        ${_kpi('Batterie','battery', d.battery_pct+'%', 'Charge actuelle','battery-charging','amber',null,null)}
      </div>

      <div class="chart-card fade-up">
        <div class="chart-card__header">
          <span class="chart-card__title">Production aujourd'hui</span>
          <div class="chart-card__legend">
            <span class="chart-legend-dot" style="--dot-color:var(--amber)">Réelle</span>
            <span class="chart-legend-dot" style="--dot-color:var(--blue-bg)">Théorique</span>
          </div>
        </div>
        <div class="chart-canvas-wrap"><canvas id="chart-prod"></canvas></div>
      </div>`;

    _initProductionChart(chartData, 'particulier');
  }

  /* ── INDUSTRIEL ──────────────────────────────── */
  function _renderIndustriel(view) {
    const d = NukunuData.sites.industriel;
    const live = d.live;
    const chartData = NukunuData.productionChart('industriel');
    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Tableau de bord énergie</h1>
          <p class="module-subtitle">${d.name} · ${d.location} · ${d.power} kWc installés</p>
        </div>
        <div class="module-actions">
          <span class="badge badge--green"><span class="badge__dot"></span>Fonctionnement normal — PR ${d.pr}%</span>
          ${_renderLiveSyncBadge(live)}
          <button class="btn btn-secondary btn-sm" onclick="ModuleMonitoring.exportSnapshot('industriel')"><i data-lucide="download"></i>Exporter</button>
        </div>
      </div>

      ${_renderLiveWeatherStrip(live)}

      <div class="kpi-grid stagger">
        ${_kpi('Production du jour','prod',App.fmt(d.production_day,'kWh'),'Energie totale produite','sun','amber','+3%','up')}
        ${_kpi('Autoconsommée','autoconso',App.fmt(d.autoconso_day,'kWh'),'Part autoconsommée ('+d.autoconso_pct+'%)','home','green',null,null)}
        ${_kpi('Injectée réseau','inject',App.fmt(d.injection_day,'kWh'),'Surplus vendu à Enedis','zap','blue',null,null)}
        ${_kpi('Facture évitée','saving',App.fmtEur(d.savings_day),'Économie journalière','trending-down','green','+8%','up')}
      </div>

      <div class="section-grid section-grid--2-1" style="gap:var(--sp-4)">
        <div class="chart-card">
          <div class="chart-card__header">
            <span class="chart-card__title">Production vs Consommation</span>
            <div class="chart-card__legend">
              <span class="chart-legend-dot" style="--dot-color:var(--amber)">Production</span>
              <span class="chart-legend-dot" style="--dot-color:var(--blue)">Théorique</span>
            </div>
          </div>
          <div class="chart-canvas-wrap"><canvas id="chart-prod"></canvas></div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;gap:var(--sp-4)">
          <div style="font-size:var(--text-base);font-weight:700;">Flux énergétiques</div>
          <div class="data-row">
            <div class="data-row__label">Autoconsommation</div>
            <div class="data-row__value" style="color:var(--green)">${d.autoconso_pct}%</div>
          </div>
          <div class="progress-bar progress-bar--green"><div class="progress-bar__fill" style="width:${d.autoconso_pct}%"></div></div>
          <div class="data-row">
            <div class="data-row__label">Performance Ratio</div>
            <div class="data-row__value">${d.pr}%</div>
          </div>
          <div class="progress-bar progress-bar--blue"><div class="progress-bar__fill" style="width:${d.pr}%"></div></div>
          <div class="data-row">
            <div class="data-row__label">Économies ce mois</div>
            <div class="data-row__value" style="color:var(--green)">${App.fmtEur(d.savings_month)}</div>
          </div>
          <div class="data-row">
            <div class="data-row__label">Revenus injection</div>
            <div class="data-row__value" style="color:var(--blue)">${App.fmtEur(d.revenue_injection_month)}</div>
          </div>
          <div class="data-row">
            <div class="data-row__label">Réduction facture</div>
            <div class="data-row__value" style="color:var(--amber)">−${App.fmtEur(d.bill_before - d.bill_after)}/mois</div>
          </div>
        </div>
      </div>`;
    _initProductionChart(chartData, 'industriel');
  }

  /* ── PRO (INSTALLATEUR / FONDS) ──────────────── */
  function _renderPro(view, profile) {
    const filters = NukunuData.getSetting('monitoring_filters', DEFAULT_FILTERS);
    const allSites = NukunuData.sites[profile] || [];
    const sites = allSites.filter(site => {
      if (filters.site !== 'all' && site.name !== filters.site) return false;
      if (filters.status !== 'all' && site.status !== filters.status) return false;
      const search = _searchTerm.trim().toLowerCase();
      if (search) {
        const haystack = [site.name, site.location, site.client].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
    const kpi   = NukunuData.kpi[profile] || {};
    const alerts = (NukunuData.alerts[profile] || []).filter(alert => filters.alertLevel === 'all' || alert.level === filters.alertLevel);
    const chartData = NukunuData.productionChart(profile);
    const liveSummary = ((NukunuData.optimisationData || {}).liveProfiles || {})[profile] || null;

    const isFonds = profile === 'fonds';

    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">${isFonds ? 'Portefeuille — Vue Monitoring' : 'Monitoring Multi-Sites'}</h1>
          <p class="module-subtitle">${isFonds ? kpi.sites+' centrales · '+kpi.mw+' MWc gérés' : kpi.sites+' sites actifs · '+kpi.alerts_critical+' alertes critiques'}</p>
        </div>
        <div class="module-actions">
          ${_renderLivePortfolioBadge(liveSummary)}
          <select class="form-select" id="monitoring-site-quick" style="width:180px;height:36px">
            <option value="all" ${filters.site === 'all' ? 'selected' : ''}>Tous les sites</option>
            ${allSites.map(s=>`<option value="${s.name}" ${filters.site === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="ModuleMonitoring.openFilters('${profile}')"><i data-lucide="filter"></i>Filtrer</button>
          <button class="btn btn-primary btn-sm" onclick="ModuleMonitoring.configureAlerts('${profile}')"><i data-lucide="bell-plus"></i>Config alertes</button>
        </div>
      </div>

      ${_renderAlertBanner(alerts)}

      <div class="kpi-grid stagger">
        ${isFonds ? `
          ${_kpi('Portefeuille','mw',kpi.mw+' MWc','Puissance totale gérée','zap','amber',null,null)}
          ${_kpi('PR Moyen','pr',kpi.pr_avg+'%','Performance Ratio moyen','gauge','blue','+1.2%','up')}
          ${_kpi('Production YTD','prod',App.fmt(kpi.production_ytd,'MWh'),'Energie produite (2026)','sun','green','+4%','up')}
          ${_kpi('Revenus YTD','rev',App.fmtEur(kpi.revenue_ytd),'Chiffre d\'affaires 2026','euro','amber',null,null)}
          ${_kpi('CO₂ Évité','co2',App.fmt(kpi.co2,'t'),'Depuis début d\'année','leaf','green',null,null)}
        ` : `
          ${_kpi('Sites actifs','sites',kpi.sites,'Installations gérées','map-pin','blue',null,null)}
          ${_kpi('Alertes critiques','crit',kpi.alerts_critical,'Interventions requises','alert-circle','red',null,'down')}
          ${_kpi('PR Moyen','pr',kpi.pr_avg+'%','Performance Ratio moyen','gauge','amber',null,null)}
          ${_kpi('Production (mois)','prod',App.fmt(kpi.production_month,'kWh'),'Energie du mois en cours','sun','green',null,null)}
          ${_kpi('CA Maintenance','ca',App.fmtEur(kpi.revenue_month),'Contrats O&M facturés','receipt','blue',null,null)}
        `}
      </div>

      <div class="section-grid section-grid--2-1" style="gap:var(--sp-4);margin-bottom:var(--sp-4)">
        <div class="chart-card">
          <div class="chart-card__header">
            <span class="chart-card__title">Production agrégée — Aujourd'hui</span>
            <div class="chart-card__legend">
              <span class="chart-legend-dot" style="--dot-color:var(--amber)">Réelle</span>
              <span class="chart-legend-dot" style="--dot-color:rgba(59,130,246,.4)">Théorique</span>
            </div>
          </div>
          <div class="chart-canvas-wrap"><canvas id="chart-prod"></canvas></div>
        </div>
        <div class="card">
          <div style="font-size:var(--text-base);font-weight:700;margin-bottom:var(--sp-4)">Statut par site</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
            ${sites.map(s => `
              <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) 0;border-bottom:1px solid var(--border)">
                <span class="badge badge--${s.status==='ok'?'green':s.status==='critical'?'red':'yellow'}" style="font-size:10px;min-width:58px;justify-content:center">
                  ${s.status==='ok'?'OK':s.status==='critical'?'CRITIQUE':'ATTENTION'}
                </span>
                <span style="flex:1;font-size:var(--text-sm);font-weight:500;color:var(--text-primary)">${s.name}</span>
                <span style="font-size:var(--text-xs);color:var(--text-secondary)">${isFonds?s.power+' kWc':s.power+' kWc'}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="table-wrapper fade-up">
        <div class="table-header">
          <span class="table-header__title">${isFonds ? 'Classement des actifs par Performance Ratio' : 'Tableau des sites'}</span>
          <div class="table-header__actions">
            <input class="form-input" id="monitoring-search" style="width:220px;height:34px" placeholder="Rechercher un site..." value="${_searchTerm}">
            <button class="btn btn-secondary btn-sm" onclick="ModuleMonitoring.exportSnapshot('${profile}')"><i data-lucide="download"></i>Exporter CSV</button>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>Site</th>
            <th>${isFonds?'Localisation':'Client'}</th>
            <th>Puissance</th>
            <th>PR %</th>
            <th>Production (j)</th>
            <th>Statut</th>
            <th>Action</th>
          </tr></thead>
          <tbody>
            ${sites.map(s=>`
              <tr>
                <td>${s.name}</td>
                <td style="color:var(--text-secondary)">${isFonds?s.location:(s.client||s.location)}</td>
                <td>${s.power} kWc</td>
                <td>
                  <div class="pr-bar">
                    <div class="pr-bar__bg"><div class="pr-bar__fill ${s.pr<75?'pr-bar__fill--bad':s.pr<85?'pr-bar__fill--warn':''}" style="width:${Math.min(s.pr,100)}%"></div></div>
                    <span class="pr-bar__val">${s.pr}%</span>
                  </div>
                </td>
                <td>${App.fmt(isFonds?s.production_day:s.production_day,'kWh')}</td>
                <td><span class="badge badge--${s.status==='ok'?'green':s.status==='critical'?'red':'yellow'}">
                  ${s.status==='ok'?'OK':s.status==='critical'?'CRITIQUE':'ATTENTION'}
                </span></td>
                <td>
                  ${s.status!=='ok'
                    ? `<button class="btn btn-sm btn-danger" onclick="App.openModal('Ticket — ${s.name}', ModuleMaintenance.ticketFormHTML('${s.id}'), ModuleMaintenance.ticketFormFooter())"><i data-lucide="wrench"></i>Ticket</button>`
                    : `<button class="btn btn-sm btn-ghost" onclick="ModuleMonitoring.openSiteDetail('${s.id}','${profile}')"><i data-lucide="external-link"></i>Détail</button>`
                  }
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    _initProductionChart(chartData, profile);
    _bindProControls(profile);
  }

  /* ── ALERT BANNER ────────────────────────────── */
  function _renderAlertBanner(alerts) {
    if (!alerts.length) return '';
    return `<div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-bottom:var(--sp-5)">
      ${alerts.map(a=>`
        <div class="alert-item alert--${a.level==='critical'?'critical':a.level==='warning'?'warning':'ok'} fade-in">
          <i data-lucide="${a.level==='critical'?'alert-circle':a.level==='warning'?'alert-triangle':'check-circle'}"></i>
          <div class="alert-item__content">
            <span class="alert-item__site">${a.site}</span>
            <span class="alert-item__msg">${a.msg}</span>
            <span class="alert-item__time">${a.time}</span>
          </div>
          ${a.level!=='ok'?`<button class="btn btn-sm btn-${a.level==='critical'?'danger':'secondary'} alert-item__cta" onclick="App.openTicket('${a.id}')">
            <i data-lucide="wrench"></i> Créer ticket
          </button>`:''}
        </div>`).join('')}
    </div>`;
  }

  function exportSnapshot(profile) {
    const filters = NukunuData.getSetting('monitoring_filters', DEFAULT_FILTERS);
    const sourceSites = Array.isArray(NukunuData.sites[profile])
      ? NukunuData.sites[profile]
      : [NukunuData.sites[profile]].filter(Boolean);
    const rows = [
      ['Profil', 'Site', 'Localisation / Client', 'Puissance kWc', 'PR', 'Production jour (kWh)', 'Statut', 'Temp live (°C)', 'Irradiance live (W/m²)', 'Prévision J+1', 'Source live'],
      ...sourceSites
        .filter(site => {
          if (filters.site !== 'all' && site.name !== filters.site) return false;
          if (filters.status !== 'all' && site.status !== filters.status) return false;
          const search = _searchTerm.trim().toLowerCase();
          if (!search) return true;
          return [site.name, site.location, site.client].filter(Boolean).join(' ').toLowerCase().includes(search);
        })
        .map(site => [
          profile,
          site.name,
          site.client || site.location,
          site.power,
          site.pr,
          site.production_day,
          site.status,
          site.live?.temperatureC ?? '',
          site.live?.irradianceNowWm2 ?? '',
          site.live?.forecastTomorrowLabel ?? '',
          site.live?.source ?? '',
        ]),
    ];
    App.exportTableLike(`monitoring-${profile}.csv`, rows);
  }

  function _bindProControls(profile) {
    document.getElementById('monitoring-site-quick')?.addEventListener('change', async event => {
      const nextFilters = {
        ...NukunuData.getSetting('monitoring_filters', DEFAULT_FILTERS),
        site: event.target.value || 'all',
      };
      await NukunuData.saveSetting('monitoring_filters', nextFilters);
      render();
      lucide.createIcons();
    });

    document.getElementById('monitoring-search')?.addEventListener('input', event => {
      _searchTerm = event.target.value || '';
      render();
      lucide.createIcons();
    });
  }

  function openSiteDetail(siteId, profile) {
    const site = (NukunuData.sites[profile] || []).find(item => item.id === siteId);
    if (!site) return;
    const relatedAlerts = (NukunuData.alerts[profile] || []).filter(alert => alert.siteId === siteId);
    const liveCard = _renderSiteLiveCard(site.live);
    App.openModal(
      `Site — ${site.name}`,
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="data-row"><div class="data-row__label">Client / localisation</div><div class="data-row__value">${site.client || site.location}</div></div>
        <div class="data-row"><div class="data-row__label">Puissance</div><div class="data-row__value">${site.power} kWc</div></div>
        <div class="data-row"><div class="data-row__label">Performance Ratio</div><div class="data-row__value">${site.pr}%</div></div>
        <div class="data-row"><div class="data-row__label">Production du jour</div><div class="data-row__value">${App.fmt(site.production_day,'kWh')}</div></div>
        <div class="data-row"><div class="data-row__label">Statut</div><div class="data-row__value">${site.status}</div></div>
        ${liveCard}
        <div class="card" style="padding:var(--sp-4)">
          <div style="font-weight:700;margin-bottom:var(--sp-2)">Alertes associées</div>
          ${relatedAlerts.length
            ? relatedAlerts.map(alert => `<div style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--sp-2)">${alert.msg} · ${alert.time}</div>`).join('')
            : `<div style="font-size:var(--text-sm);color:var(--text-muted)">Aucune alerte active sur ce site.</div>`}
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Fermer</button>${site.status !== 'ok' ? `<button class="btn btn-primary" onclick="App.openTicket('${relatedAlerts[0]?.id || ''}')">Créer un ticket</button>` : ''}`
    );
  }

  function openFilters(profile) {
    const filters = NukunuData.getSetting('monitoring_filters', DEFAULT_FILTERS);
    const sites = NukunuData.sites[profile] || [];
    App.openModal(
      'Filtres monitoring',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group">
          <label class="form-label">Site</label>
          <select class="form-select" id="monitoring-filter-site">
            <option value="all" ${filters.site === 'all' ? 'selected' : ''}>Tous les sites</option>
            ${sites.map(site => `<option value="${site.name}" ${filters.site === site.name ? 'selected' : ''}>${site.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Statut</label>
          <select class="form-select" id="monitoring-filter-status">
            <option value="all" ${filters.status === 'all' ? 'selected' : ''}>Tous</option>
            <option value="ok" ${filters.status === 'ok' ? 'selected' : ''}>OK</option>
            <option value="warning" ${filters.status === 'warning' ? 'selected' : ''}>Attention</option>
            <option value="critical" ${filters.status === 'critical' ? 'selected' : ''}>Critique</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Niveau d'alerte</label>
          <select class="form-select" id="monitoring-filter-alert">
            <option value="all" ${filters.alertLevel === 'all' ? 'selected' : ''}>Toutes</option>
            <option value="critical" ${filters.alertLevel === 'critical' ? 'selected' : ''}>Critiques</option>
            <option value="warning" ${filters.alertLevel === 'warning' ? 'selected' : ''}>Warnings</option>
          </select>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleMonitoring.saveFilters()">Enregistrer</button>`
    );
  }

  function configureAlerts(profile) {
    const settings = NukunuData.getSetting('monitoring_alerts', DEFAULT_ALERTS);
    App.openModal(
      'Configuration des alertes',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="data-row"><div class="data-row__label">Profil</div><div class="data-row__value">${profile}</div></div>
        <div class="form-group">
          <label class="form-label">Canal</label>
          <select class="form-select" id="monitoring-alert-channel">
            <option value="email_dashboard" ${settings.channel === 'email_dashboard' ? 'selected' : ''}>Email + tableau de bord</option>
            <option value="dashboard_only" ${settings.channel === 'dashboard_only' ? 'selected' : ''}>Tableau de bord uniquement</option>
            <option value="email_only" ${settings.channel === 'email_only' ? 'selected' : ''}>Email uniquement</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Alertes critiques</label>
          <select class="form-select" id="monitoring-alert-critical">
            <option value="immediate" ${settings.critical === 'immediate' ? 'selected' : ''}>Immédiat</option>
            <option value="hourly_digest" ${settings.critical === 'hourly_digest' ? 'selected' : ''}>Digest horaire</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Alertes warning</label>
          <select class="form-select" id="monitoring-alert-warning">
            <option value="daily_digest" ${settings.warning === 'daily_digest' ? 'selected' : ''}>Résumé quotidien</option>
            <option value="immediate" ${settings.warning === 'immediate' ? 'selected' : ''}>Immédiat</option>
            <option value="disabled" ${settings.warning === 'disabled' ? 'selected' : ''}>Désactivé</option>
          </select>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleMonitoring.saveAlertSettings()">Enregistrer</button>`
    );
  }

  async function saveFilters() {
    const payload = {
      site: document.getElementById('monitoring-filter-site')?.value || 'all',
      status: document.getElementById('monitoring-filter-status')?.value || 'all',
      alertLevel: document.getElementById('monitoring-filter-alert')?.value || 'all',
    };
    await NukunuData.saveSetting('monitoring_filters', payload);
    App.closeModal();
    App.toast('Filtres monitoring enregistrés', 'success');
    render();
    lucide.createIcons();
  }

  async function saveAlertSettings() {
    const payload = {
      channel: document.getElementById('monitoring-alert-channel')?.value || 'email_dashboard',
      critical: document.getElementById('monitoring-alert-critical')?.value || 'immediate',
      warning: document.getElementById('monitoring-alert-warning')?.value || 'daily_digest',
    };
    await NukunuData.saveSetting('monitoring_alerts', payload);
    App.closeModal();
    App.toast('Configuration des alertes enregistrée', 'success');
  }

  function _renderLiveSyncBadge(live) {
    if (!live || live.status !== 'ok') return '';
    return `<span class="badge badge--blue"><span class="badge__dot"></span>Live ${_formatLiveStamp(live.updatedAt || live.observedAt)}</span>`;
  }

  function _renderLivePortfolioBadge(summary) {
    if (!summary?.sitesSynced) return '';
    return `<span class="badge badge--blue"><span class="badge__dot"></span>${summary.sitesSynced} site(s) sync live</span>`;
  }

  function _renderLiveWeatherStrip(live) {
    if (!live || live.status !== 'ok') return '';
    return `
      <div class="card fade-up" style="margin-bottom:var(--sp-4);display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--sp-4)">
        <div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px">Température live</div>
          <div style="font-size:var(--text-xl);font-weight:800;color:var(--text-primary)">${live.temperatureC}°C</div>
          <div style="font-size:var(--text-xs);color:var(--text-secondary)">${live.weatherLabel}</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px">Irradiance panneaux</div>
          <div style="font-size:var(--text-xl);font-weight:800;color:var(--amber)">${live.irradianceNowWm2} W/m²</div>
          <div style="font-size:var(--text-xs);color:var(--text-secondary)">Nuages ${live.cloudCoverPct}%</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px">Prévision J+1</div>
          <div style="font-size:var(--text-xl);font-weight:800;color:var(--green)">${live.forecastTomorrowLabel}</div>
          <div style="font-size:var(--text-xs);color:var(--text-secondary)">Pluie max ${live.precipitationProbabilityMax}%</div>
        </div>
        <div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px">Sources</div>
          <div style="font-size:var(--text-base);font-weight:700;color:var(--text-primary)">${live.source}</div>
          <div style="font-size:var(--text-xs);color:var(--text-secondary)">Maj ${_formatLiveStamp(live.updatedAt || live.observedAt)}</div>
        </div>
      </div>`;
  }

  function _renderSiteLiveCard(live) {
    if (!live) return '';
    if (live.status !== 'ok') {
      return `
        <div class="card" style="padding:var(--sp-4)">
          <div style="font-weight:700;margin-bottom:var(--sp-2)">Données live</div>
          <div style="font-size:var(--text-sm);color:var(--text-secondary)">
            Synchronisation indisponible${live.reason ? ` : ${live.reason}` : '.'}
          </div>
        </div>`;
    }

    return `
      <div class="card" style="padding:var(--sp-4)">
        <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:center;margin-bottom:var(--sp-3)">
          <div style="font-weight:700">Données live</div>
          <span class="badge badge--blue"><span class="badge__dot"></span>${live.source}</span>
        </div>
        <div class="data-row"><div class="data-row__label">Température</div><div class="data-row__value">${live.temperatureC}°C · ${live.weatherLabel}</div></div>
        <div class="data-row"><div class="data-row__label">Irradiance panneaux</div><div class="data-row__value">${live.irradianceNowWm2} W/m²</div></div>
        <div class="data-row"><div class="data-row__label">Nuages / vent</div><div class="data-row__value">${live.cloudCoverPct}% · ${live.windSpeedKmh} km/h</div></div>
        <div class="data-row"><div class="data-row__label">Prévision J+1</div><div class="data-row__value" style="color:var(--green)">${live.forecastTomorrowLabel}</div></div>
        <div class="data-row"><div class="data-row__label">Lever / coucher</div><div class="data-row__value">${_formatClock(live.sunrise)} · ${_formatClock(live.sunset)}</div></div>
        <div class="data-row"><div class="data-row__label">Mise à jour</div><div class="data-row__value">${_formatLiveStamp(live.updatedAt || live.observedAt)}</div></div>
      </div>`;
  }

  function _formatLiveStamp(value) {
    if (!value) return 'n/a';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function _formatClock(value) {
    if (!value) return 'n/a';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value).slice(11, 16) || String(value);
    }
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  /* ── KPI HELPER ──────────────────────────────── */
  function _kpi(label, id, value, sub, icon, color, delta, dir) {
    return `
      <div class="kpi-card kpi--${color} fade-up">
        <div class="kpi-card__header">
          <span class="kpi-card__label">${label}</span>
          <div class="kpi-card__icon"><i data-lucide="${icon}"></i></div>
        </div>
        <div class="kpi-card__value">${value}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2)">
          <span style="font-size:var(--text-xs);color:var(--text-muted)">${sub}</span>
          ${delta?`<span class="kpi-card__delta kpi-card__delta--${dir}">
            <i data-lucide="${dir==='up'?'trending-up':'trending-down'}"></i>${delta}
          </span>`:''}
        </div>
      </div>`;
  }

  /* ── PRODUCTION CHART ────────────────────────── */
  function _initProductionChart(data, profile) {
    const canvas = document.getElementById('chart-prod');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const isSmall = profile === 'particulier';
    const instance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Production réelle',
            data:  data.actual,
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245,158,11,0.08)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: '#F59E0B',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Courbe théorique',
            data:  data.theory,
            borderColor: 'rgba(59,130,246,0.5)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5,4],
            borderSkipped: false,
            pointRadius: 0,
            tension: 0.4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: _getThemeColors().tooltipBg,
            titleColor: _getThemeColors().tooltipText,
            bodyColor: _getThemeColors().text,
            borderColor: _getThemeColors().grid,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${isSmall?'kWh':'kWh'}`
            }
          }
        },
        scales: {
          x: { grid:{ color:_getThemeColors().grid }, ticks:{ color:_getThemeColors().text, font:{size:11} } },
          y: { grid:{ color:_getThemeColors().grid }, ticks:{ color:_getThemeColors().text, font:{size:11} },
               title:{ display:true, text:'kWh', color:_getThemeColors().text, font:{size:11} } }
        }
      }
    });
    App.registerChart('prod', instance);
  }

  function _getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      grid: style.getPropertyValue('--border-medium').trim(),
      text: style.getPropertyValue('--text-muted').trim(),
      tooltipBg: style.getPropertyValue('--bg-panel').trim(),
      tooltipText: style.getPropertyValue('--text-primary').trim()
    };
  }

  return { render, exportSnapshot, openFilters, configureAlerts, saveFilters, saveAlertSettings, openSiteDetail };
})();
