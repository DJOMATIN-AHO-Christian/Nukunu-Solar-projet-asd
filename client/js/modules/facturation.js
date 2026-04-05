/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 4: FACTURATION & REVENUS
═══════════════════════════════════════════════════════════ */

const ModuleFacturation = (() => {
  let _loading = false;
  let _loadedFor = null;
  let _settingsLoaded = false;
  const DEFAULT_FILTERS = { site: 'all', contract: 'all', status: 'all' };

  function render() {
    const profile = Profile.get();
    const view = document.getElementById('module-facturation');
    if (!view) return;

    const scope = window.NukunuStore.get('nukunu_user_id') || window.NukunuStore.get('nukunu_user_email') || 'anonymous';
    if (!_loading && _loadedFor !== scope) {
      _loading = true;
      view.innerHTML = '<div class="card">Synchronisation de la facturation en cours...</div>';
      NukunuData.refreshBilling().finally(() => {
        _loadedFor = scope;
        _loading = false;
        render();
      });
      return;
    }

    if (!_settingsLoaded) {
      view.innerHTML = '<div class="card">Chargement des préférences de facturation...</div>';
      NukunuData.refreshSetting('billing_filters', DEFAULT_FILTERS).finally(() => {
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
    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Mes revenus solaires</h1>
          <p class="module-subtitle">Mars 2026 · Installation ${d.power} kWc · Tarif OA en vigueur</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-primary btn-sm" onclick="ModuleFacturation.downloadAnnualCertificate()">
            <i data-lucide="download"></i> Attestation annuelle
          </button>
        </div>
      </div>

      <div class="hero-number fade-up">
        <div class="hero-number__kw">${App.fmtEur(d.savings_month + d.revenue_injection_month)}</div>
        <div class="hero-number__label">Gain net total ce mois (économies + revente)</div>
        <div class="hero-number__saving">
          <i data-lucide="piggy-bank"></i>
          Soit ${App.fmtEur((d.savings_month + d.revenue_injection_month) * 12)} projetés sur 12 mois
        </div>
      </div>

      <div class="kpi-grid stagger" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--sp-5)">
        ${_kpi('Économies facture', App.fmtEur(d.savings_month), 'Autoconsommation valorisée', 'trending-down', 'green')}
        ${_kpi('Revente EDF OA', App.fmtEur(d.revenue_injection_month), 'Surplus injecté sur le réseau', 'euro', 'blue')}
        ${_kpi('Production totale', App.fmt(NukunuData.kpi.particulier.production_month, 'kWh'), 'Ce mois', 'sun', 'amber')}
      </div>

      <div class="card fade-up">
        <div style="font-weight:700;font-size:var(--text-base);margin-bottom:var(--sp-4)">Détail mensuel — Mars 2026</div>
        <div class="data-row">
          <div class="data-row__label">Énergie produite</div>
          <div class="data-row__value">${App.fmt(NukunuData.kpi.particulier.production_month,'kWh')}</div>
        </div>
        <div class="data-row">
          <div class="data-row__label">Autoconsommée (valorisée à 0.2276 €/kWh)</div>
          <div class="data-row__value" style="color:var(--green)">${App.fmtEur(d.savings_month)}</div>
        </div>
        <div class="data-row">
          <div class="data-row__label">Injectée sur le réseau (tarif OA 0.1269 €/kWh)</div>
          <div class="data-row__value" style="color:var(--blue)">${App.fmtEur(d.revenue_injection_month)}</div>
        </div>
        <div class="data-row" style="border-top:2px solid var(--border-medium);padding-top:var(--sp-3);margin-top:var(--sp-2)">
          <div class="data-row__label" style="font-weight:700;color:var(--text-primary)">Gain net total</div>
          <div class="data-row__value" style="color:var(--amber);font-size:var(--text-xl)">${App.fmtEur(d.savings_month + d.revenue_injection_month)}</div>
        </div>
        <div style="margin-top:var(--sp-4);padding:var(--sp-3);background:var(--blue-bg);border:1px solid rgba(59,130,246,.15);border-radius:var(--r-base);font-size:var(--text-xs);color:var(--text-secondary)">
          <i data-lucide="info" style="width:13px;height:13px;color:var(--blue);vertical-align:middle"></i>
          EDF versera <strong style="color:var(--blue)">${App.fmtEur(d.revenue_injection_month)}</strong> sur votre compte dans les 30 prochains jours.
          Pour la déclaration d'impôts, téléchargez votre attestation annuelle.
        </div>
      </div>`;
  }

  /* ── INDUSTRIEL ──────────────────────────────── */
  function _renderIndustriel(view) {
    const d = NukunuData.sites.industriel;
    const entry = NukunuData.getBillingEntries()[0] || { energy_kwh: 0, gross_revenue: 0 };
    const breakdown = _buildIndustrialBreakdown(entry, d);
    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Facturation interne & Revenus</h1>
          <p class="module-subtitle">${d.name} · Ventilation des flux énergétiques</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="ModuleFacturation.exportFinance('industriel','rapport')"><i data-lucide="file-text"></i> Rapport comptable</button>
          <button class="btn btn-primary btn-sm" onclick="ModuleFacturation.exportFinance('industriel','fec')"><i data-lucide="download"></i> Export FEC</button>
        </div>
      </div>

      <div class="kpi-grid stagger" style="margin-bottom:var(--sp-5)">
        ${_kpi('Gain net (mois)',App.fmtEur(d.savings_month+d.revenue_injection_month),'Économies + Injection','trending-up','green')}
        ${_kpi('Économies autoconso',App.fmtEur(d.savings_month),'Tarif évité','home','amber')}
        ${_kpi('Revenus injection',App.fmtEur(d.revenue_injection_month),'Tarif CRE/Complément','zap','blue')}
        ${_kpi('Facture avant',App.fmtEur(d.bill_before),'Facture mensuelle avant solaire','receipt','red')}
        ${_kpi('Facture après',App.fmtEur(d.bill_after),'Facture mensuelle actuelle','check-circle','green')}
      </div>

      <div class="section-grid section-grid--2" style="gap:var(--sp-4);margin-bottom:var(--sp-4)">
        <div class="card">
          <div style="font-weight:700;font-size:var(--text-base);margin-bottom:var(--sp-4)">Ventilation par poste tarifaire</div>
          ${breakdown.map(([p,kwh,tarif,cout])=>`
            <div class="data-row">
              <div class="data-row__label">${p}</div>
              <div style="display:flex;align-items:center;gap:var(--sp-4)">
                <span style="font-size:var(--text-xs);color:var(--text-muted)">${kwh} · ${tarif}</span>
                <div class="data-row__value">${cout}</div>
              </div>
            </div>`).join('')}
          <div class="data-row" style="border-top:2px solid var(--border-medium);padding-top:var(--sp-3);margin-top:var(--sp-2)">
            <div class="data-row__label" style="font-weight:700;color:var(--text-primary)">Total facture</div>
            <div class="data-row__value" style="color:var(--amber);font-size:var(--text-xl)">${App.fmtEur(d.bill_after)}</div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:700;font-size:var(--text-base);margin-bottom:var(--sp-4)">Comparatif avant / après</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:var(--sp-2)">
                <span style="font-size:var(--text-xs);color:var(--text-secondary)">Facture avant installation</span>
                <span style="font-weight:700">${App.fmtEur(d.bill_before)}</span>
              </div>
              <div class="progress-bar" style="height:10px"><div class="progress-bar__fill progress-bar--red" style="width:100%"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:var(--sp-2)">
                <span style="font-size:var(--text-xs);color:var(--text-secondary)">Facture actuelle</span>
                <span style="font-weight:700;color:var(--green)">${App.fmtEur(d.bill_after)}</span>
              </div>
              <div class="progress-bar" style="height:10px"><div class="progress-bar__fill progress-bar--green" style="width:${Math.round(d.bill_after/d.bill_before*100)}%"></div></div>
            </div>
            <div style="padding:var(--sp-4);text-align:center;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--r-md)">
              <div style="font-size:var(--text-2xl);font-weight:800;color:var(--green)">−${Math.round((1-d.bill_after/d.bill_before)*100)}%</div>
              <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">Réduction de la facture énergétique</div>
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);text-align:center">Économies annuelles : <strong style="color:var(--green)">${App.fmtEur((d.bill_before-d.bill_after)*12)}</strong></div>
          </div>
        </div>
      </div>`;
  }

  /* ── PRO (INSTALLATEUR / FONDS) ──────────────── */
  function _renderPro(view, profile) {
    const isFonds = profile === 'fonds';
    const filters = NukunuData.getSetting('billing_filters', DEFAULT_FILTERS);
    const entries = NukunuData.getBillingEntries().filter(entry => {
      if (filters.site !== 'all' && entry.site !== filters.site) return false;
      if (filters.contract !== 'all' && entry.contract !== filters.contract) return false;
      if (filters.status !== 'all' && entry.payment_status !== filters.status) return false;
      return true;
    });
    const totalRevenue = entries.reduce((sum, entry) => sum + Number(entry.gross_revenue || 0), 0);
    const draftCount = entries.filter(entry => entry.payment_status === 'draft').length;
    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">${isFonds ? 'Réconciliation & Revenus du portefeuille' : 'Facturation Clients & Contrats'}</h1>
          <p class="module-subtitle">${isFonds ? 'Revenu brut · Trésorerie prévisionnelle · Multi-devises' : 'Contrats O&M · Interventions SAV · Garanties de production'}</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="ModuleFacturation.openFilters('${profile}')"><i data-lucide="filter"></i> Filtrer</button>
          <button class="btn btn-secondary btn-sm" onclick="ModuleFacturation.exportFinance('${profile}','excel')"><i data-lucide="table"></i> Export Excel</button>
          <button class="btn btn-primary btn-sm" onclick="ModuleFacturation.createContract('${profile}')"><i data-lucide="plus"></i> ${isFonds?'Nouvelle centrale':'Nouveau contrat'}</button>
        </div>
      </div>

      <div class="kpi-grid stagger" style="margin-bottom:var(--sp-5)">
        ${isFonds ? `
          ${_kpi('Revenus YTD', App.fmtEur(totalRevenue * 8), 'Chiffre d\'affaires 2026', 'euro', 'amber')}
          ${_kpi('Revenus (mars)', App.fmtEur(totalRevenue), 'Mois en cours', 'calendar', 'green')}
          ${_kpi('Trésorerie J+6m', App.fmtEur(totalRevenue * 5.8), 'Projection 6 mois glissants', 'trending-up', 'blue')}
          ${_kpi('Trésorerie J+12m', App.fmtEur(totalRevenue * 11.4), 'Projection 12 mois glissants', 'bar-chart-2', 'purple')}
        ` : `
          ${_kpi('CA Contrats O&M', App.fmtEur(totalRevenue), 'Facturé ce mois', 'receipt', 'amber')}
          ${_kpi('À facturer', App.fmtEur(entries.filter(entry => entry.payment_status !== 'paid').reduce((sum, entry) => sum + Number(entry.gross_revenue || 0), 0)), 'Interventions SAV non facturées', 'clock', 'red')}
          ${_kpi('Contrats actifs', String(entries.length), 'Sites sous contrat', 'file-check', 'green')}
          ${_kpi('Brouillons', String(draftCount), 'Contrats à compléter', 'check-circle', 'blue')}
        `}
      </div>

      <div class="table-wrapper fade-up">
        <div class="table-header">
          <span class="table-header__title">${isFonds ? 'Réconciliation mensuelle par centrale' : 'Contrats O&M — Facturation'}</span>
          <div class="table-header__actions">
            <button class="btn btn-sm btn-ghost" onclick="ModuleFacturation.exportTable('${profile}')"><i data-lucide="download"></i> CSV</button>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>Centrale / Site</th>
            <th>Contrat</th>
            <th>Énergie (mois)</th>
            <th>Tarif</th>
            <th>Revenus bruts</th>
            <th>Statut</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${entries.map(entry=>{
              return `<tr>
                <td>${entry.site}</td>
                <td><span class="badge badge--blue">${entry.contract || 'OA EDF'}</span></td>
                <td>${App.fmt(entry.energy_kwh,'kWh')}</td>
                <td style="color:var(--text-secondary)">${entry.tariff_label || '0.1269'}${entry.tariff_label && entry.tariff_label.includes('Spot') ? '' : ' €/kWh'}</td>
                <td style="color:var(--amber);font-weight:700">${App.fmtEur(entry.gross_revenue)}</td>
                <td><span class="badge badge--${entry.payment_status === 'draft' ? 'amber' : 'green'}">${entry.payment_status === 'draft' ? 'Brouillon' : 'Payé'}</span></td>
                <td>
                  <button class="btn btn-sm btn-ghost" onclick="ModuleFacturation.downloadInvoice('${encodeURIComponent(entry.site)}', ${entry.gross_revenue})">
                    <i data-lucide="file-text"></i>
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ── KPI HELPER ──────────────────────────────── */
  function _kpi(label, value, sub, icon, color) {
    return `
      <div class="kpi-card kpi--${color} fade-up">
        <div class="kpi-card__header">
          <span class="kpi-card__label">${label}</span>
          <div class="kpi-card__icon"><i data-lucide="${icon}"></i></div>
        </div>
        <div class="kpi-card__value">${value}</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${sub}</div>
      </div>`;
  }

  function exportFinance(profile, format) {
    const entries = NukunuData.getBillingEntries();
    if (format === 'rapport') {
      App.openPrintDocument(
        `facturation-${profile}.pdf`,
        `Rapport comptable — ${profile}`,
        `<table>
          <thead><tr><th>Site</th><th>Contrat</th><th>Énergie</th><th>Tarif</th><th>Revenus</th><th>Statut</th></tr></thead>
          <tbody>${entries.map(entry => `<tr><td>${entry.site}</td><td>${entry.contract}</td><td>${App.fmt(entry.energy_kwh,'kWh')}</td><td>${entry.tariff_label}</td><td>${App.fmtEur(entry.gross_revenue)}</td><td>${entry.payment_status}</td></tr>`).join('')}</tbody>
        </table>`
      );
      return;
    }
    App.exportTableLike(`facturation-${profile}-${format}.csv`, [
      ['Site', 'Contrat', 'Période', 'Énergie', 'Tarif', 'Revenus', 'Statut', 'Notes'],
      ...entries.map(entry => [entry.site, entry.contract, entry.period, entry.energy_kwh, entry.tariff_label, entry.gross_revenue, entry.payment_status, entry.notes || ''])
    ]);
  }

  function openFilters(profile) {
    const entries = NukunuData.getBillingEntries();
    const filters = NukunuData.getSetting('billing_filters', DEFAULT_FILTERS);
    const sites = [...new Set(entries.map(entry => entry.site))];
    const contracts = [...new Set(entries.map(entry => entry.contract))];
    App.openModal(
      'Filtrage de facturation',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group">
          <label class="form-label">Site</label>
          <select class="form-select" id="billing-filter-site">
            <option value="all" ${filters.site === 'all' ? 'selected' : ''}>Tous</option>
            ${sites.map(site => `<option value="${site}" ${filters.site === site ? 'selected' : ''}>${site}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Contrat</label>
          <select class="form-select" id="billing-filter-contract">
            <option value="all" ${filters.contract === 'all' ? 'selected' : ''}>Tous</option>
            ${contracts.map(contract => `<option value="${contract}" ${filters.contract === contract ? 'selected' : ''}>${contract}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Statut</label>
          <select class="form-select" id="billing-filter-status">
            <option value="all" ${filters.status === 'all' ? 'selected' : ''}>Tous</option>
            <option value="paid" ${filters.status === 'paid' ? 'selected' : ''}>Payé</option>
            <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>Brouillon</option>
          </select>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleFacturation.saveFilters('${profile}')">Appliquer</button>`
    );
  }

  async function saveFilters() {
    const payload = {
      site: document.getElementById('billing-filter-site')?.value || 'all',
      contract: document.getElementById('billing-filter-contract')?.value || 'all',
      status: document.getElementById('billing-filter-status')?.value || 'all',
    };
    await NukunuData.saveSetting('billing_filters', payload);
    App.closeModal();
    App.toast('Filtres de facturation enregistrés', 'success');
    render();
    lucide.createIcons();
  }

  function createContract(profile) {
    App.openModal(
      profile === 'fonds' ? 'Nouvelle centrale' : 'Nouveau contrat',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group"><label class="form-label">Site</label><input class="form-input" id="billing-site" placeholder="Saisir un site"></div>
        <div class="form-group"><label class="form-label">${profile === 'fonds' ? 'Nom de la centrale' : 'Nom du contrat'}</label><input class="form-input" id="billing-contract" placeholder="Saisir une valeur"></div>
        <div class="form-group"><label class="form-label">Commentaire</label><textarea class="form-textarea" id="billing-comment" placeholder="Informations complémentaires"></textarea></div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleFacturation.submitContract('${profile}')">Enregistrer</button>`
    );
  }

  async function submitContract(profile) {
    const site = document.getElementById('billing-site')?.value?.trim();
    const contractName = document.getElementById('billing-contract')?.value?.trim() || (profile === 'fonds' ? 'Nouvelle centrale' : 'Nouveau contrat');
    const notes = document.getElementById('billing-comment')?.value?.trim() || '';
    if (!site) {
      App.toast('Merci de renseigner le site', 'warning');
      return;
    }
    await NukunuData.createBillingContract({ site, contractName, notes });
    App.closeModal();
    App.toast('Contrat enregistré', 'success');
    render();
    lucide.createIcons();
  }

  function downloadInvoice(encodedSite, amount) {
    const site = decodeURIComponent(encodedSite);
    App.openPrintDocument(
      `facture-${site.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      `Facture — ${site}`,
      `<div class="card">
        <div><strong>Site:</strong> ${site}</div>
        <div><strong>Montant:</strong> ${App.fmtEur(amount)}</div>
        <div><strong>Date d’émission:</strong> ${new Date().toLocaleDateString('fr-FR')}</div>
        <div><strong>Émetteur:</strong> Nukunu Solar</div>
      </div>`
    );
    App.toast(`Facture exportée pour ${site}`, 'success');
  }

  function exportTable(profile) {
    const rows = NukunuData.getBillingEntries().map(entry => [
      entry.id,
      entry.site,
      entry.contract,
      entry.energy_kwh,
      entry.tariff_label,
      entry.gross_revenue,
      entry.payment_status,
    ]);
    App.exportTableLike(`facturation-${profile}.csv`, [['ID', 'Site', 'Contrat', 'Energie', 'Tarif', 'Revenus', 'Statut'], ...rows]);
  }

  function downloadAnnualCertificate() {
    App.openPrintDocument(
      'attestation-annuelle.pdf',
      'Attestation annuelle de production',
      `<div class="card">
        <div><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</div>
        <div><strong>Émetteur:</strong> Nukunu Solar</div>
        <div><strong>Objet:</strong> Synthèse annuelle de production et de revenus.</div>
      </div>`
    );
    App.toast('Attestation téléchargée', 'success');
  }

  function _buildIndustrialBreakdown(entry, site) {
    const totalEnergy = Number(entry.energy_kwh || 0);
    const hp = Math.round(totalEnergy * 0.46);
    const hc = Math.round(totalEnergy * 0.27);
    const hpe = Math.round(totalEnergy * 0.12);
    const baseTariff = Number(entry.tariff_rate || 0.118);
    const turpe = Math.round(site.bill_after * 0.21);
    const subscription = Math.round(site.bill_after * 0.04);
    return [
      ['Heures Pleines (HP)', `${hp.toLocaleString('fr-FR')} kWh`, `${(baseTariff + 0.114).toFixed(4)} €/kWh`, `${Math.round(hp * (baseTariff + 0.114)).toLocaleString('fr-FR')} €`],
      ['Heures Creuses (HC)', `${hc.toLocaleString('fr-FR')} kWh`, `${(baseTariff + 0.05).toFixed(4)} €/kWh`, `${Math.round(hc * (baseTariff + 0.05)).toLocaleString('fr-FR')} €`],
      ['Pointe (HPE)', `${hpe.toLocaleString('fr-FR')} kWh`, `${(baseTariff + 0.167).toFixed(4)} €/kWh`, `${Math.round(hpe * (baseTariff + 0.167)).toLocaleString('fr-FR')} €`],
      ['TURPE (réseau)', '—', '—', `${turpe.toLocaleString('fr-FR')} €`],
      ['Abonnement', '—', '—', `${subscription.toLocaleString('fr-FR')} €`],
    ];
  }

  return { render, exportFinance, openFilters, saveFilters, createContract, submitContract, downloadInvoice, exportTable, downloadAnnualCertificate };
})();
