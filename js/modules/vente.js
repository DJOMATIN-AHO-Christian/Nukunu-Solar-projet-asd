/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 6: VENTE & CRM
═══════════════════════════════════════════════════════════ */

const ModuleVente = (() => {

  let _simStep = 1;
  let _simState = {};
  let _loading = false;
  let _loadedFor = null;

  function render() {
    const profile = Profile.get();
    const view = document.getElementById('module-vente');
    if (!view) return;

    const scope = window.NukunuStore.get('nukunu_user_id') || window.NukunuStore.get('nukunu_user_email') || 'anonymous';
    if (!_loading && _loadedFor !== scope) {
      _loading = true;
      view.innerHTML = '<div class="card">Synchronisation CRM en cours...</div>';
      NukunuData.refreshProspects().finally(() => {
        _loadedFor = scope;
        _loading = false;
        render();
      });
      return;
    }

    _simStep = 1;
    _simState = {};

    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Vente & CRM Solaire</h1>
          <p class="module-subtitle">${_subtitle(profile)}</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="ModuleVente.openCRMGuide()"><i data-lucide="users"></i> CRM</button>
          <button class="btn btn-primary btn-sm" onclick="ModuleVente.openNewQuote()"><i data-lucide="file-plus"></i> Nouveau devis</button>
        </div>
      </div>

      <div class="section-grid section-grid--1-2" style="gap:var(--sp-4);margin-bottom:var(--sp-6)">
        ${_simulatorBlock(profile)}
        ${_pipelineBlock(profile)}
      </div>

      ${_crmTable()}
    `;
  }

  function _subtitle(p) {
    const m = {
      installateur:'Simulateur de production · Pipeline commercial · Devis en ligne',
      fonds:'Pré-due diligence · IRR prévisionnel · Comparatif portefeuille',
      industriel:'Simulation autoconsommation · Taux d\'autosuffisance optimal',
      particulier:'Simulateur 3 étapes · Économies estimées · Mise en relation',
    };
    return m[p]||'';
  }

  /* ── SIMULATOR ───────────────────────────────── */
  function _simulatorBlock(profile) {
    return `
      <div class="card" id="sim-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4)">
          <div style="font-weight:700;font-size:var(--text-base)">Simulateur de production</div>
          <span class="badge badge--amber">Étape ${_simStep}/3</span>
        </div>

        <div class="steps" id="sim-steps">
          <div class="step ${_simStep>=1?'active':''} ${_simStep>1?'done':''}">
            <div class="step__circle">${_simStep>1?'<i data-lucide="check" style="width:13px;height:13px"></i>':'1'}</div>
            <div class="step__label">Adresse</div>
            <div class="step__line"></div>
          </div>
          <div class="step ${_simStep>=2?'active':''} ${_simStep>2?'done':''}">
            <div class="step__circle">${_simStep>2?'<i data-lucide="check" style="width:13px;height:13px"></i>':'2'}</div>
            <div class="step__label">Système</div>
            <div class="step__line"></div>
          </div>
          <div class="step ${_simStep>=3?'active':''}">
            <div class="step__circle">3</div>
            <div class="step__label">Résultats</div>
          </div>
        </div>

        <div id="sim-body">${_simStep1()}</div>
      </div>`;
  }

  function _simStep1() {
    return `
      <div class="form-group">
        <label class="form-label">Adresse de l'installation</label>
        <input class="form-input" id="sim-address" placeholder="Ex: 12 Rue de la Paix, Lyon" value="18 Avenue Lumière, Lyon 69008">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Orientation</label>
          <select class="form-select" id="sim-orient">
            <option>Sud (optimal)</option><option>Sud-Est</option><option>Sud-Ouest</option><option>Est/Ouest</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Inclinaison</label>
          <select class="form-select" id="sim-tilt">
            <option>30° (optimal)</option><option>20°</option><option>40°</option><option>0° (plat)</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary w-full" onclick="ModuleVente.nextStep()">
        Continuer <i data-lucide="arrow-right"></i>
      </button>`;
  }

  function _simStep2() {
    return `
      <div class="form-group">
        <label class="form-label">Puissance installée (kWc)</label>
        <input class="form-input" id="sim-power" type="number" value="9" min="3" max="500" step="3">
      </div>
      <div class="form-group">
        <label class="form-label">Type de client</label>
        <select class="form-select" id="sim-type">
          <option>Résidentiel (≤36 kWc)</option>
          <option>Professionnel / PME</option>
          <option>Industriel / Grande toiture</option>
          <option>Au sol / Ferme solaire</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Option batterie</label>
        <select class="form-select" id="sim-battery">
          <option>Sans batterie</option>
          <option>Batterie 5 kWh</option>
          <option>Batterie 10 kWh</option>
          <option>Batterie 15 kWh</option>
        </select>
      </div>
      <div style="display:flex;gap:var(--sp-3)">
        <button class="btn btn-ghost" onclick="ModuleVente.prevStep()"><i data-lucide="arrow-left"></i> Retour</button>
        <button class="btn btn-primary" style="flex:1" onclick="ModuleVente.nextStep()">Lancer la simulation <i data-lucide="zap"></i></button>
      </div>`;
  }

  function _simStep3() {
    const power = Number(_simState.power || 9);
    const address = _simState.address || 'Lyon';
    const orientation = _simState.orientation || 'Sud (optimal)';
    const tilt = _simState.tilt || '30° (optimal)';
    const clientType = _simState.clientType || 'Résidentiel (≤36 kWc)';
    const battery = _simState.battery || 'Sans batterie';
    const orientationFactor = {
      'Sud (optimal)': 1,
      'Sud-Est': 0.95,
      'Sud-Ouest': 0.95,
      'Est/Ouest': 0.88,
    }[orientation] || 1;
    const tiltFactor = {
      '30° (optimal)': 1,
      '20°': 0.97,
      '40°': 0.96,
      '0° (plat)': 0.9,
    }[tilt] || 1;
    const batteryBonus = {
      'Sans batterie': 1,
      'Batterie 5 kWh': 1.04,
      'Batterie 10 kWh': 1.08,
      'Batterie 15 kWh': 1.12,
    }[battery] || 1;
    const clientFactor = {
      'Résidentiel (≤36 kWc)': 1,
      'Professionnel / PME': 1.03,
      'Industriel / Grande toiture': 1.06,
      'Au sol / Ferme solaire': 1.1,
    }[clientType] || 1;
    const prod  = Math.round(power * 1280 * orientationFactor * tiltFactor);
    const eco   = Math.round(prod * 0.65 * 0.2276);
    const inj   = Math.round(prod * 0.35 * 0.1269 * batteryBonus);
    const total = eco + inj;
    const cost  = Math.round(power * 1450 * clientFactor);
    const pb    = total > 0 ? (cost / total).toFixed(1) : '0.0';
    const tri   = (7.4 + (orientationFactor * tiltFactor * batteryBonus * clientFactor)).toFixed(1);
    const van   = Math.round(total*15 - cost);
    return `
      <div class="sim-result">
        <div class="sim-result__main">${App.fmt(prod,'kWh/an')}</div>
        <div class="sim-result__sub">Production annuelle estimée (${address} · ${orientation} · ${tilt} · ${clientType})</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin:var(--sp-4) 0">
        <div class="data-row"><div class="data-row__label">Économies annuelles</div><div class="data-row__value" style="color:var(--green)">${App.fmtEur(eco)}</div></div>
        <div class="data-row"><div class="data-row__label">Revenus revente OA</div><div class="data-row__value" style="color:var(--blue)">${App.fmtEur(inj)}</div></div>
        <div class="data-row"><div class="data-row__label">Gain total annuel</div><div class="data-row__value" style="color:var(--amber);font-size:var(--text-lg)">${App.fmtEur(total)}</div></div>
        <div class="data-row"><div class="data-row__label">Retour sur investissement</div><div class="data-row__value">${pb} ans</div></div>
        <div class="data-row"><div class="data-row__label">TRI</div><div class="data-row__value">${tri}%</div></div>
        <div class="data-row"><div class="data-row__label">VAN (25 ans)</div><div class="data-row__value" style="color:var(--green)">${App.fmtEur(van)}</div></div>
      </div>
      <div style="display:flex;gap:var(--sp-3)">
        <button class="btn btn-ghost btn-sm" onclick="ModuleVente.prevStep()"><i data-lucide="arrow-left"></i></button>
        <button class="btn btn-primary" style="flex:1" onclick="ModuleVente.exportQuote()">
          <i data-lucide="file-text"></i> Générer le devis PDF
        </button>
      </div>`;
  }

  function nextStep() {
    if (_simStep === 1) {
      _simState.address = document.getElementById('sim-address')?.value || _simState.address;
      _simState.orientation = document.getElementById('sim-orient')?.value || _simState.orientation;
      _simState.tilt = document.getElementById('sim-tilt')?.value || _simState.tilt;
    }
    if (_simStep === 2) {
      _simState.power = document.getElementById('sim-power')?.value || _simState.power;
      _simState.clientType = document.getElementById('sim-type')?.value || _simState.clientType;
      _simState.battery = document.getElementById('sim-battery')?.value || _simState.battery;
    }
    _simStep = Math.min(_simStep+1, 3);
    _refreshSim();
  }
  function prevStep() {
    _simStep = Math.max(_simStep-1, 1);
    _refreshSim();
  }
  function _refreshSim() {
    const body = document.getElementById('sim-body');
    const badge = document.querySelector('#sim-card .badge--amber');
    if(badge) badge.textContent = `Étape ${_simStep}/3`;
    if(body)  body.innerHTML = _simStep===1?_simStep1():_simStep===2?_simStep2():_simStep3();
    // update steps UI
    document.querySelectorAll('.step').forEach((el,i)=>{
      el.classList.toggle('active', i+1 === _simStep);
      el.classList.toggle('done', i+1 < _simStep);
    });
    lucide.createIcons();
  }

  /* ── PIPELINE BOARD ──────────────────────────── */
  function _pipelineBlock(profile) {
    const stages = [
      { key:'lead',        label:'Prospect',      color:'gray',   icon:'user-plus' },
      { key:'quote',       label:'Devis envoyé',  color:'blue',   icon:'send' },
      { key:'negotiation', label:'Négociation',   color:'amber',  icon:'handshake' },
      { key:'signed',      label:'Signé',         color:'green',  icon:'check-circle' },
    ];
    return `
      <div class="card" style="overflow-x:auto">
        <div style="font-weight:700;font-size:var(--text-base);margin-bottom:var(--sp-4)">Pipeline commercial</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sp-3);min-width:480px">
          ${stages.map(s=>{
            const prospects = NukunuData.getProspects().filter(p=>p.stage===s.key);
            return `
              <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden">
                <div style="padding:var(--sp-3);background:var(--bg-hover);display:flex;align-items:center;gap:var(--sp-2);border-bottom:1px solid var(--border)">
                  <i data-lucide="${s.icon}" style="width:14px;height:14px;color:var(--${s.color})"></i>
                  <span style="font-size:12px;font-weight:700">${s.label}</span>
                  <span style="margin-left:auto;font-size:11px;font-weight:700;background:var(--bg-card);padding:1px 7px;border-radius:99px;color:var(--text-secondary)">${prospects.length}</span>
                </div>
                <div style="padding:var(--sp-2);display:flex;flex-direction:column;gap:var(--sp-2)">
                  ${prospects.map(p=>`
                    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-base);padding:var(--sp-3);cursor:pointer"
                         onclick="ModuleVente.advanceProspect('${p.id}')">
                      <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-primary);margin-bottom:3px">${p.name}</div>
                      <div style="font-size:10px;color:var(--text-muted)">${p.power} kWc</div>
                      <div style="font-size:var(--text-xs);color:var(--amber);font-weight:700;margin-top:4px">${App.fmtEur(p.value)}</div>
                    </div>`).join('')}
                  ${!prospects.length?`<div style="padding:var(--sp-3);text-align:center;font-size:11px;color:var(--text-muted)">Aucun</div>`:''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  /* ── CRM TABLE ───────────────────────────────── */
  function _crmTable() {
    const stageBadge={lead:'gray',quote:'blue',negotiation:'amber',signed:'green'};
    const stageLabel={lead:'Prospect',quote:'Devis envoyé',negotiation:'Négociation',signed:'Signé'};
    return `
      <div class="table-wrapper fade-up">
        <div class="table-header">
          <span class="table-header__title">Tous les prospects</span>
          <div class="table-header__actions">
            <button class="btn btn-sm btn-ghost" onclick="ModuleVente.exportProspects()"><i data-lucide="download"></i> Export</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Prospect</th><th>Contact</th><th>Puissance</th><th>Montant</th><th>Statut</th><th>Dernier contact</th><th></th></tr></thead>
          <tbody>
            ${NukunuData.getProspects().map(p=>`
              <tr>
                <td>${p.name}</td>
                <td style="color:var(--text-secondary)">${p.contact}</td>
                <td>${p.power} kWc</td>
                <td style="color:var(--amber);font-weight:700">${App.fmtEur(p.value)}</td>
                <td><span class="badge badge--${stageBadge[p.stage]}">${stageLabel[p.stage]}</span></td>
                <td style="color:var(--text-secondary)">${p.lastContact}</td>
                <td>
                  <button class="btn btn-sm btn-ghost" onclick="ModuleVente.relaunchProspect('${p.id}')">
                    <i data-lucide="send"></i> Relancer
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function openCRMGuide() {
    const staleProspects = NukunuData.getProspects()
      .filter(prospect => {
        const lastContact = new Date(prospect.lastContact || Date.now());
        return (Date.now() - lastContact.getTime()) / 86400000 >= 5;
      })
      .slice(0, 5);

    App.openModal(
      'Vue CRM',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="data-row"><div class="data-row__label">Prospects actifs</div><div class="data-row__value">${NukunuData.getProspects().length}</div></div>
        <div class="data-row"><div class="data-row__label">À relancer</div><div class="data-row__value">${staleProspects.length}</div></div>
        <div class="card" style="padding:var(--sp-4)">
          <div style="font-weight:700;margin-bottom:var(--sp-2)">Relances prioritaires</div>
          ${staleProspects.length
            ? staleProspects.map(prospect => `<div style="display:flex;justify-content:space-between;gap:var(--sp-3);margin-bottom:var(--sp-2)"><span>${prospect.name}</span><button class="btn btn-sm btn-secondary" onclick="App.closeModal(); ModuleVente.relaunchProspect('${prospect.id}')">Relancer</button></div>`).join('')
            : `<div style="font-size:var(--text-sm);color:var(--text-secondary)">Aucun prospect en souffrance.</div>`}
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Fermer</button><button class="btn btn-primary" onclick="App.closeModal(); ModuleVente.openNewQuote();">Créer un devis</button>`
    );
  }

  function openNewQuote() {
    App.openModal(
      'Nouveau devis',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group"><label class="form-label">Prospect</label><input class="form-input" id="quote-name" placeholder="Nom du prospect"></div>
        <div class="form-group"><label class="form-label">Contact</label><input class="form-input" id="quote-contact" placeholder="Nom du contact"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Puissance (kWc)</label><input class="form-input" id="quote-power" type="number" value="36"></div>
          <div class="form-group"><label class="form-label">Montant (€)</label><input class="form-input" id="quote-value" type="number" value="18000"></div>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleVente.submitQuote()">Créer</button>`
    );
  }

  async function submitQuote() {
    const name = document.getElementById('quote-name')?.value?.trim();
    const contact = document.getElementById('quote-contact')?.value?.trim();
    const power = document.getElementById('quote-power')?.value;
    const value = document.getElementById('quote-value')?.value;
    if (!name || !contact) {
      App.toast('Merci de compléter le prospect et le contact', 'warning');
      return;
    }
    await NukunuData.createProspectRemote({ name, contact, power, value, stage: 'quote' });
    App.closeModal();
    App.toast('Devis créé et ajouté au pipeline', 'success');
    render();
    lucide.createIcons();
  }

  async function relaunchProspect(id) {
    const updated = await NukunuData.updateProspectRemote(id, { touch: true });
    if (updated) {
      App.toast(`Relance envoyée à ${updated.contact}`, 'success');
      render();
      lucide.createIcons();
    }
  }

  async function advanceProspect(id) {
    const prospect = NukunuData.getProspects().find(item => item.id === id);
    if (!prospect) return;
    const order = ['lead', 'quote', 'negotiation', 'signed'];
    const currentIndex = order.indexOf(prospect.stage);
    const nextStage = order[Math.min(currentIndex + 1, order.length - 1)];
    if (nextStage === prospect.stage) {
      App.toast(`${prospect.name} est déjà signé`, 'info');
      return;
    }
    await NukunuData.updateProspectRemote(id, { stage: nextStage });
    App.toast(`${prospect.name} passe à l'étape suivante`, 'success');
    render();
    lucide.createIcons();
  }

  function exportProspects() {
    const prospects = NukunuData.getProspects();
    App.exportTableLike('crm-prospects.csv', [
      ['ID', 'Prospect', 'Contact', 'Puissance', 'Montant', 'Statut', 'Dernier contact'],
      ...prospects.map(prospect => [prospect.id, prospect.name, prospect.contact, prospect.power, prospect.value, prospect.stage, prospect.lastContact])
    ]);
  }

  function exportQuote() {
    const simulatedValue = Math.round(Number(_simState.power || 9) * 1450);
    App.openModal(
      'Enregistrer et générer le devis',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group"><label class="form-label">Prospect</label><input class="form-input" id="sim-quote-name" placeholder="Nom du prospect"></div>
        <div class="form-group"><label class="form-label">Contact</label><input class="form-input" id="sim-quote-contact" placeholder="Nom du contact"></div>
        <div class="data-row"><div class="data-row__label">Montant estimatif</div><div class="data-row__value">${App.fmtEur(simulatedValue)}</div></div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleVente.finalizeQuoteExport()">Générer</button>`
    );
  }

  async function finalizeQuoteExport() {
    const power = Number(_simState.power || 9);
    const address = _simState.address || 'Adresse non renseignée';
    const orientation = _simState.orientation || 'Sud (optimal)';
    const tilt = _simState.tilt || '30° (optimal)';
    const clientType = _simState.clientType || 'Résidentiel (≤36 kWc)';
    const battery = _simState.battery || 'Sans batterie';
    const name = document.getElementById('sim-quote-name')?.value?.trim();
    const contact = document.getElementById('sim-quote-contact')?.value?.trim();
    if (!name || !contact) {
      App.toast('Merci de renseigner le prospect et le contact.', 'warning');
      return;
    }
    await NukunuData.createProspectRemote({
      name,
      contact,
      power,
      value: Math.round(power * 1450),
      stage: 'quote',
    });
    App.openPrintDocument(
      'devis-solaire.pdf',
      `Devis Nukunu Solar — ${name}`,
      `<div class="card">
        <div><strong>Prospect:</strong> ${name}</div>
        <div><strong>Contact:</strong> ${contact}</div>
        <div><strong>Adresse:</strong> ${address}</div>
        <div><strong>Puissance:</strong> ${power} kWc</div>
        <div><strong>Orientation:</strong> ${orientation}</div>
        <div><strong>Inclinaison:</strong> ${tilt}</div>
        <div><strong>Type de client:</strong> ${clientType}</div>
        <div><strong>Option batterie:</strong> ${battery}</div>
        <div><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>`
    );
    App.closeModal();
    App.toast('Devis généré et ajouté au pipeline', 'success');
    render();
    lucide.createIcons();
  }

  return { render, nextStep, prevStep, openCRMGuide, openNewQuote, submitQuote, relaunchProspect, advanceProspect, exportProspects, exportQuote, finalizeQuoteExport };
})();
