/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 7: OPTIMISATION ÉNERGIE
═══════════════════════════════════════════════════════════ */

const ModuleOptimisation = (() => {
  const MODE_KEY = 'nukunu_optimisation_mode';
  let _rulesLoaded = false;
  const DEFAULT_RULES = { mode: 'auto', chargeOffPeak: true, dischargePeak: true, sellSurplus: true };

  function render() {
    const profile = Profile.get();
    const view = document.getElementById('module-optimisation');
    if (!view) return;

    if (!_rulesLoaded) {
      view.innerHTML = '<div class="card">Chargement des règles d’optimisation...</div>';
      NukunuData.refreshSetting('optimisation_rules', DEFAULT_RULES).finally(() => {
        _rulesLoaded = true;
        render();
      });
      return;
    }

    const rules = NukunuData.getSetting('optimisation_rules', DEFAULT_RULES);
    const currentMode = rules.mode || localStorage.getItem(MODE_KEY) || 'auto';
    const optimisationData = NukunuData.optimisationData;
    const batteryConfig = (optimisationData.batteryConfig || {})[profile] || { pct: 72, capacity: 10, nextCharge: '22h00 → 06h00' };
    const battPct = batteryConfig.pct;
    const epex    = optimisationData.epexHours || NukunuData.epexHours;
    const maxPrice= Math.max(...epex.map(e=>e.price));
    const marketLive = optimisationData.marketLive || null;
    const liveProfile = ((optimisationData.liveProfiles || {})[profile]) || null;
    const forecastLabel = liveProfile?.forecastLabel || (optimisationData.forecast || {})[profile] || '28.6 kWh';
    const forecastSubtitle = liveProfile?.sitesSynced
      ? `${liveProfile.source} · ${liveProfile.averageCloudCoverPct}% nuages · maj ${_formatLiveStamp(liveProfile.updatedAt)}`
      : 'Prévision solaire disponible après synchronisation live';
    const marketSubtitle = marketLive?.status === 'ok'
      ? `${marketLive.source} · ${marketLive.targetDate}`
      : marketLive?.status === 'disabled'
        ? 'Courbe locale de secours · token ENTSO-E absent'
        : 'Courbe locale de secours · API marché indisponible';
    const plan = _buildOptimisationPlan(profile, rules, optimisationData, batteryConfig, liveProfile);

    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Optimisation Énergie</h1>
          <p class="module-subtitle">${_subtitle(profile)}</p>
        </div>
        <div class="module-actions">
          <span class="badge badge--${currentMode === 'stop' ? 'red' : currentMode === 'manual' ? 'amber' : 'green'}"><span class="badge__dot"></span>${currentMode === 'stop' ? 'Pilotage arrêté' : currentMode === 'manual' ? 'Mode manuel actif' : 'Optimisation automatique active'}</span>
          ${liveProfile?.sitesSynced ? `<span class="badge badge--blue"><span class="badge__dot"></span>${liveProfile.sitesSynced} site(s) sync live</span>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="ModuleOptimisation.openRules()"><i data-lucide="settings"></i> Règles</button>
        </div>
      </div>

      <div class="kpi-grid stagger" style="margin-bottom:var(--sp-5)">
        <div class="kpi-card kpi--green fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">Batterie</span><div class="kpi-card__icon"><i data-lucide="battery-charging"></i></div></div>
          <div class="kpi-card__value">${battPct}<span>%</span></div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">Charge actuelle · ${App.fmt((battPct/100*batteryConfig.capacity).toFixed(1),'kWh',1)} disponibles</div>
        </div>
        <div class="kpi-card kpi--amber fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">Prix spot actuel</span><div class="kpi-card__icon"><i data-lucide="euro"></i></div></div>
          <div class="kpi-card__value">${plan.currentPrice}<span>€/MWh</span></div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">${marketSubtitle}</div>
        </div>
        <div class="kpi-card kpi--blue fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">Gain optimisation</span><div class="kpi-card__icon"><i data-lucide="trending-up"></i></div></div>
          <div class="kpi-card__value">${App.fmtEur((optimisationData.gainMonthly || {})[profile] ?? 124)}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">vs stratégie passive (mois)</div>
        </div>
        <div class="kpi-card kpi--green fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">Prévision J+1</span><div class="kpi-card__icon"><i data-lucide="cloud-sun"></i></div></div>
          <div class="kpi-card__value">${forecastLabel}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">${forecastSubtitle}</div>
        </div>
      </div>

      <div class="section-grid section-grid--2" style="gap:var(--sp-4);margin-bottom:var(--sp-4)">
        <!-- Battery Widget -->
        <div class="card" style="display:flex;gap:var(--sp-6);align-items:center">
          <div class="battery-widget" style="border:none;padding:0">
            <div class="battery-outer">
              <div class="battery-fill" style="height:${battPct}%"></div>
            </div>
            <div class="battery-pct">${battPct}%</div>
          </div>
          <div style="flex:1">
            <div style="font-size:var(--text-base);font-weight:700;margin-bottom:var(--sp-4)">État de la batterie</div>
            <div class="data-row"><div class="data-row__label">Capacité totale</div><div class="data-row__value">${App.fmt(batteryConfig.capacity,'kWh')}</div></div>
            <div class="data-row"><div class="data-row__label">Disponible</div><div class="data-row__value" style="color:var(--green)">${App.fmt((battPct/100*batteryConfig.capacity).toFixed(1),'kWh',1)}</div></div>
            <div class="data-row"><div class="data-row__label">Mode actif</div><div class="data-row__value"><span class="badge badge--${currentMode === 'stop' ? 'red' : currentMode === 'manual' ? 'amber' : 'green'}">${currentMode === 'stop' ? 'Arrêt' : currentMode === 'manual' ? 'Manuel' : 'Optimisation auto'}</span></div></div>
            <div class="data-row"><div class="data-row__label">Prochaine charge HC</div><div class="data-row__value">${batteryConfig.nextCharge}</div></div>
            <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-2)">
              <button class="btn btn-sm btn-green" onclick="ModuleOptimisation.setMode('auto')"><i data-lucide="zap"></i> Auto</button>
              <button class="btn btn-sm btn-secondary" onclick="ModuleOptimisation.setMode('manual')"><i data-lucide="sliders"></i> Manuel</button>
              <button class="btn btn-sm btn-danger" onclick="ModuleOptimisation.setMode('stop')"><i data-lucide="power"></i> Stop</button>
            </div>
          </div>
        </div>

        <!-- EPEX Heatmap -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4)">
            <div style="font-size:var(--text-base);font-weight:700">Prix EPEX SPOT — Aujourd'hui (€/MWh)</div>
            <div style="display:flex;align-items:center;gap:var(--sp-3);font-size:var(--text-xs);color:var(--text-muted)">
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(34,197,94,.4);display:inline-block"></span>Bas</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(245,158,11,.6);display:inline-block"></span>Moyen</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:rgba(239,68,68,.5);display:inline-block"></span>Pic</span>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            ${Array.from({length:12},(_,i)=>`<span style="font-size:9px;color:var(--text-muted);width:calc(100%/12);text-align:center">${i*2}h</span>`).join('')}
          </div>
          <div class="heatmap">
            ${epex.map(e=>{
              const pct = e.price / maxPrice;
              const cls = pct < 0.4 ? 'heatmap-cell--low' : pct < 0.7 ? 'heatmap-cell--mid' : pct < 0.9 ? 'heatmap-cell--high' : 'heatmap-cell--peak';
              const h = e.hour===new Date().getHours()?'box-shadow:0 0 0 2px var(--amber);':'';
              return `<div class="heatmap-cell ${cls}" title="${e.hour}h — ${e.price} €/MWh" style="${h}"></div>`;
            }).join('')}
          </div>
          <div style="margin-top:var(--sp-4);padding:var(--sp-3);background:var(--amber-bg);border:1px solid rgba(245,158,11,.2);border-radius:var(--r-base);font-size:var(--text-xs);color:var(--text-secondary)">
            <i data-lucide="lightbulb" style="width:13px;height:13px;color:var(--amber);vertical-align:middle"></i>
            <strong style="color:var(--amber)">Conseil Nukunu :</strong> ${plan.advice}
          </div>
          ${liveProfile?.sitesSynced ? `
            <div style="margin-top:var(--sp-3);font-size:var(--text-xs);color:var(--text-secondary)">
              Prévision solaire J+1 alimentée par ${liveProfile.source} · irradiance moyenne ${liveProfile.averageIrradianceWm2} W/m².
            </div>` : ''}
        </div>
      </div>

      <!-- Charge/Discharge Chart -->
      <div class="chart-card fade-up" style="margin-bottom:var(--sp-4)">
        <div class="chart-card__header">
          <span class="chart-card__title">Plan de charge/décharge — Décision algorithmique J+1</span>
          <div class="chart-card__legend">
            <span class="chart-legend-dot" style="--dot-color:var(--green)">Charge batterie</span>
            <span class="chart-legend-dot" style="--dot-color:var(--red)">Décharge / Revente</span>
            <span class="chart-legend-dot" style="--dot-color:var(--amber)">Production</span>
          </div>
        </div>
        <div class="chart-canvas-wrap"><canvas id="chart-opti"></canvas></div>
      </div>

      ${profile !== 'particulier' ? _flexBlock(profile) : ''}
    `;

    _initOptiChart(plan);
  }

  function _subtitle(p) {
    const m = {
      installateur:'Configuration batterie par client · Règles d\'optimisation',
      fonds:'Arbitrage spot EPEX · FCR · aFRR · Gain mensuel vs stratégie passive',
      industriel:'Effacement des pics · Réduction TURPE · Flexibilité réseau',
      particulier:'Pilotage batterie · Tarif Tempo/EJP · Autoconsommation collective'
    };
    return m[p]||'';
  }

  function _formatLiveStamp(value) {
    if (!value) return 'n/a';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function _flexBlock(profile) {
    const isFonds = profile === 'fonds';
    return `
      <div class="card fade-up">
        <div style="font-weight:700;font-size:var(--text-base);margin-bottom:var(--sp-4)">
          ${isFonds?'Services système & Marchés de capacité':'Effacement & Flexibilité réseau'}
        </div>
        <div class="section-grid section-grid--3" style="gap:var(--sp-4)">
          ${(((NukunuData.optimisationData.flex || {})[profile]) || ((NukunuData.optimisationData.flex || {})[isFonds ? 'fonds' : 'industriel']) || []).map(([name,status,value,icon,color])=>`
            <div style="padding:var(--sp-4);background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--r-md)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3)">
                <div style="display:flex;align-items:center;gap:var(--sp-2);color:var(--${color})">
                  <i data-lucide="${icon}" style="width:16px;height:16px"></i>
                  <span style="font-size:var(--text-xs);font-weight:700">${name}</span>
                </div>
                <span class="badge badge--${color==='green'?'green':color==='blue'?'blue':'amber'}" style="font-size:10px">${status}</span>
              </div>
              <div style="font-size:var(--text-xl);font-weight:800;color:var(--text-primary)">${value}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function _initOptiChart(plan) {
    const c = document.getElementById('chart-opti');
    if (!c) return;
    const inst = new Chart(c.getContext('2d'), {
      type:'bar',
      data:{
        labels:plan.hours,
        datasets:[
          { label:'Production (kWh)', data:plan.production, backgroundColor:'rgba(245,158,11,0.5)', borderColor:'#F59E0B', borderWidth:1, borderRadius:4, type:'line', tension:0.4, fill:true, yAxisID:'y' },
          { label:'Charge batterie (kWh)', data:plan.charge, backgroundColor:'rgba(34,197,94,0.5)', borderColor:'#22C55E', borderWidth:1, borderRadius:4, yAxisID:'y' },
          { label:'Décharge / Revente (kWh)', data:plan.discharge, backgroundColor:'rgba(239,68,68,0.5)', borderColor:'#EF4444', borderWidth:1, borderRadius:4, yAxisID:'y' },
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{ 
            backgroundColor: _getThemeColors().tooltipBg, 
            titleColor: _getThemeColors().tooltipText, 
            bodyColor: _getThemeColors().text, 
            borderColor: _getThemeColors().grid, 
            borderWidth: 1 
          }
        },
        scales:{
          x:{ grid:{color:_getThemeColors().grid}, ticks:{color:_getThemeColors().text,font:{size:11}} },
          y:{ grid:{color:_getThemeColors().grid}, ticks:{color:_getThemeColors().text,font:{size:11}}, title:{display:true,text:'kWh',color:_getThemeColors().text,font:{size:11}} }
        }
      }
    });
    App.registerChart('opti', inst);
  }

  function _buildOptimisationPlan(profile, rules, optimisationData, batteryConfig, liveProfile) {
    const hours = Array.from({ length: 24 }, (_, index) => `${index}h`);
    const prices = optimisationData.epexHours || NukunuData.epexHours;
    const productionScale = { particulier: 1, installateur: 2.2, industriel: 9.4, fonds: 28 }[profile] || 1;
    const solarBase = [0,0,0,0,0,0,0.2,0.7,1.8,3.1,4.1,4.8,5.0,4.9,4.2,3.4,2.1,1.0,0.2,0,0,0,0,0];
    const production = Array.isArray(liveProfile?.hourlyProduction) && liveProfile.hourlyProduction.length === 24
      ? liveProfile.hourlyProduction.map(value => Number(Number(value || 0).toFixed(2)))
      : solarBase.map(value => Number((value * productionScale).toFixed(2)));
    const lowThreshold = [...prices].sort((left, right) => left.price - right.price)[5]?.price || 30;
    const highThreshold = [...prices].sort((left, right) => right.price - left.price)[5]?.price || 80;
    const charge = Array.from({ length: 24 }, () => 0);
    const discharge = Array.from({ length: 24 }, () => 0);
    const mode = rules.mode || 'auto';
    const maxStep = Math.max(0.4, Number((batteryConfig.capacity / 12).toFixed(2)));

    prices.forEach(slot => {
      if (mode === 'stop') return;
      const gentleFactor = mode === 'manual' ? 0.55 : 1;
      if (rules.chargeOffPeak && slot.price <= lowThreshold) {
        charge[slot.hour] = Number((maxStep * gentleFactor).toFixed(2));
      }
      if (rules.dischargePeak && slot.price >= highThreshold) {
        const dischargeStep = rules.sellSurplus ? maxStep : maxStep * 0.45;
        discharge[slot.hour] = Number((-dischargeStep * gentleFactor).toFixed(2));
      }
    });

    const highestSlots = prices.filter(slot => slot.price >= highThreshold).map(slot => slot.hour).slice(0, 3);
    const lowestSlots = prices.filter(slot => slot.price <= lowThreshold).map(slot => slot.hour).slice(0, 3);
    const formatHours = list => list.map(hour => `${hour}h`).join(', ');
    const advice = mode === 'stop'
      ? 'Le pilotage est arrêté: la batterie reste en mode sécurité, sans arbitrage automatique.'
      : `Charge recommandée autour de ${formatHours(lowestSlots)} et décharge autour de ${formatHours(highestSlots)} selon les règles actives.${liveProfile?.forecastLabel ? ` Prévision J+1: ${liveProfile.forecastLabel}.` : ''}`;

    return {
      hours,
      production,
      charge,
      discharge,
      advice,
      currentPrice: prices[new Date().getHours()]?.price ?? prices[0]?.price ?? 0,
    };
  }

  function openRules() {
    const rules = NukunuData.getSetting('optimisation_rules', DEFAULT_RULES);
    App.openModal(
      'Règles d’optimisation',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group">
          <label class="form-label">Mode par défaut</label>
          <select class="form-select" id="opti-rule-mode">
            <option value="auto" ${rules.mode === 'auto' ? 'selected' : ''}>Automatique</option>
            <option value="manual" ${rules.mode === 'manual' ? 'selected' : ''}>Manuel</option>
            <option value="stop" ${rules.mode === 'stop' ? 'selected' : ''}>Arrêt</option>
          </select>
        </div>
        <label class="data-row"><span class="data-row__label">Charge heures creuses</span><input id="opti-charge" type="checkbox" ${rules.chargeOffPeak ? 'checked' : ''}></label>
        <label class="data-row"><span class="data-row__label">Décharge en pointe</span><input id="opti-discharge" type="checkbox" ${rules.dischargePeak ? 'checked' : ''}></label>
        <label class="data-row"><span class="data-row__label">Revente surplus</span><input id="opti-sell" type="checkbox" ${rules.sellSurplus ? 'checked' : ''}></label>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleOptimisation.saveRules()">Valider</button>`
    );
  }

  async function setMode(mode) {
    const nextRules = {
      ...NukunuData.getSetting('optimisation_rules', DEFAULT_RULES),
      mode,
    };
    localStorage.setItem(MODE_KEY, mode);
    await NukunuData.saveSetting('optimisation_rules', nextRules);
    App.toast(
      mode === 'auto' ? 'Mode optimisation activé' : mode === 'manual' ? 'Mode manuel activé' : 'Pilotage batterie arrêté',
      mode === 'stop' ? 'warning' : 'success'
    );
    render();
    lucide.createIcons();
  }

  async function saveRules() {
    const payload = {
      mode: document.getElementById('opti-rule-mode')?.value || 'auto',
      chargeOffPeak: Boolean(document.getElementById('opti-charge')?.checked),
      dischargePeak: Boolean(document.getElementById('opti-discharge')?.checked),
      sellSurplus: Boolean(document.getElementById('opti-sell')?.checked),
    };
    localStorage.setItem(MODE_KEY, payload.mode);
    await NukunuData.saveSetting('optimisation_rules', payload);
    App.closeModal();
    App.toast('Règles confirmées', 'success');
    render();
    lucide.createIcons();
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

  return { render, openRules, setMode, saveRules };
})();
