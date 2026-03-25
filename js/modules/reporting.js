/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 2: REPORTING & PILOTAGE FINANCIER
═══════════════════════════════════════════════════════════ */

const ModuleReporting = (() => {
  let _selectedPeriod = 'rolling_12';

  function render() {
    const profile = Profile.get();
    const view = document.getElementById('module-reporting');
    if (!view) return;
    const kpi = NukunuData.kpi[profile] || {};
    const monthly = NukunuData.monthlyData();
    const summary = _periodSummary(monthly, _selectedPeriod);

    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Reporting & Pilotage</h1>
          <p class="module-subtitle">${_subtitle(profile)}</p>
        </div>
        <div class="module-actions">
          <select class="form-select" id="reporting-period" style="width:190px;height:36px">
            ${_periodOptions(monthly).map(option => `<option value="${option.value}" ${option.value === _selectedPeriod ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="ModuleReporting.exportReport('${profile}','pdf')"><i data-lucide="file-text"></i> PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="ModuleReporting.exportReport('${profile}','excel')"><i data-lucide="table"></i> Excel</button>
          <button class="btn btn-primary btn-sm" onclick="ModuleReporting.sendReport('${profile}')"><i data-lucide="send"></i> Envoyer rapport</button>
        </div>
      </div>

      ${_kpiRow(profile, kpi)}

      <div class="card fade-up" style="margin-bottom:var(--sp-4);padding:var(--sp-4)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3)">
          <div>
            <div style="font-size:var(--text-base);font-weight:700">Synthèse de période</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary)">${summary.label}</div>
          </div>
          <div style="display:flex;gap:var(--sp-4);flex-wrap:wrap">
            <div><div style="font-size:var(--text-xs);color:var(--text-muted)">Production</div><div style="font-weight:700">${App.fmt(summary.production,'kWh')}</div></div>
            <div><div style="font-size:var(--text-xs);color:var(--text-muted)">Revenus</div><div style="font-weight:700">${App.fmtEur(summary.revenue)}</div></div>
          </div>
        </div>
      </div>

      <div class="section-grid section-grid--2" style="gap:var(--sp-4);margin-bottom:var(--sp-4)">
        <div class="chart-card">
          <div class="chart-card__header">
            <span class="chart-card__title">Production mensuelle — 12 mois glissants</span>
            <div class="chart-card__legend">
              <span class="chart-legend-dot" style="--dot-color:var(--amber)">Production kWh</span>
              <span class="chart-legend-dot" style="--dot-color:var(--green)">Revenus €</span>
            </div>
          </div>
          <div class="chart-canvas-wrap"><canvas id="chart-monthly"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card__header">
            <span class="chart-card__title">${profile === 'fonds' ? 'OPEX par mois' : 'Flux financiers mensuels'}</span>
          </div>
          <div class="chart-canvas-wrap"><canvas id="chart-finance"></canvas></div>
        </div>
      </div>

      ${_esgBlock(profile)}
      ${_exportBlock(profile, summary)}`;

    _initMonthlyChart(monthly);
    _initFinanceChart(profile, monthly);
    _bindPeriodSelect();
  }

  function _subtitle(p) {
    const m = {
      installateur: 'Rapports clients · Suivi contrats O&M',
      fonds: 'Reporting investisseur · P50/P90 · Projection 12 mois',
      industriel: 'Facturation interne · Décret Tertiaire',
      particulier: 'Résumé mensuel · Attestation de production'
    };
    return m[p] || '';
  }

  function _periodOptions(monthly) {
    return [
      { value: 'rolling_12', label: '12 mois glissants' },
      ...(monthly.labels || []).map((label, index) => ({ value: `month_${index}`, label: `${label} 2026` })),
    ];
  }

  function _periodSummary(monthly, period) {
    if (period === 'rolling_12') {
      return {
        label: '12 mois glissants',
        production: (monthly.production || []).reduce((sum, value) => sum + value, 0),
        revenue: (monthly.revenue || []).reduce((sum, value) => sum + value, 0),
      };
    }

    const index = Number(String(period || '').replace('month_', ''));
    return {
      label: `${monthly.labels?.[index] || 'Période'} 2026`,
      production: monthly.production?.[index] || 0,
      revenue: monthly.revenue?.[index] || 0,
    };
  }

  function _bindPeriodSelect() {
    document.getElementById('reporting-period')?.addEventListener('change', event => {
      _selectedPeriod = event.target.value || 'rolling_12';
      render();
      lucide.createIcons();
    });
  }

  function _kpiRow(profile, kpi) {
    const rows = {
      installateur: [
        ['Production (mois)', App.fmt(kpi.production_month, 'kWh'), 'sun', 'amber'],
        ['CA Maintenance', App.fmtEur(kpi.revenue_month), 'receipt', 'green'],
        ['Sites actifs', kpi.sites, 'map-pin', 'blue'],
        ['Prochaines interv.', kpi.next_interventions, 'calendar', 'amber'],
      ],
      fonds: [
        ['Revenus YTD', App.fmtEur(kpi.revenue_ytd), 'euro', 'amber'],
        ['IRR moyen', `${kpi.irr}%`, 'trending-up', 'green'],
        ['PR Moyen', `${kpi.pr_avg}%`, 'gauge', 'blue'],
        ['CO₂ Évité', App.fmt(kpi.co2, 't'), 'leaf', 'green'],
      ],
      industriel: [
        ['Réduction facture', `${kpi.bill_reduction}%`, 'trending-down', 'green'],
        ['Économies YTD', App.fmtEur(kpi.savings_ytd), 'piggy-bank', 'amber'],
        ['Revenus injection', App.fmtEur(kpi.injection_ytd), 'zap', 'blue'],
        ['Taux autoconso', `${kpi.autoconso_pct}%`, 'home', 'green'],
      ],
      particulier: [
        ['Production (mois)', App.fmt(kpi.production_month, 'kWh'), 'sun', 'amber'],
        ['Économies (mois)', App.fmtEur(kpi.savings_month), 'piggy-bank', 'green'],
        ['Revente EDF OA', App.fmtEur(kpi.injection_revenue), 'euro', 'blue'],
        ['Batterie', `${kpi.battery_pct}%`, 'battery-charging', 'amber'],
      ],
    };
    const items = rows[profile] || [];
    return `<div class="kpi-grid stagger" style="margin-bottom:var(--sp-4)">
      ${items.map(([label, value, icon, color]) => `
        <div class="kpi-card kpi--${color} fade-up">
          <div class="kpi-card__header">
            <span class="kpi-card__label">${label}</span>
            <div class="kpi-card__icon"><i data-lucide="${icon}"></i></div>
          </div>
          <div class="kpi-card__value">${value}</div>
        </div>`).join('')}
    </div>`;
  }

  function _esgBlock(profile) {
    if (profile === 'particulier') return '';
    const values = (NukunuData.reportingData.esg || {})[profile] || { co2: '0', homes: '0', prod: '0' };
    return `
      <div class="card fade-up" style="margin-bottom:var(--sp-4)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-5)">
          <div>
            <div style="font-size:var(--text-base);font-weight:700">Indicateurs ESG</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary)">Impact environnemental et social — 2026 YTD</div>
          </div>
          <span class="badge badge--green">Taxonomie verte UE</span>
        </div>
        <div class="section-grid section-grid--3" style="gap:var(--sp-4)">
          <div style="text-align:center;padding:var(--sp-4);background:var(--green-bg);border:1px solid rgba(34,197,94,.15);border-radius:var(--r-md)">
            <div style="font-size:var(--text-3xl);font-weight:800;color:var(--green)">${values.co2}</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">tonnes CO₂ évitées</div>
          </div>
          <div style="text-align:center;padding:var(--sp-4);background:var(--blue-bg);border:1px solid rgba(59,130,246,.15);border-radius:var(--r-md)">
            <div style="font-size:var(--text-3xl);font-weight:800;color:var(--blue)">${values.homes}</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">foyers alimentés</div>
          </div>
          <div style="text-align:center;padding:var(--sp-4);background:var(--amber-bg);border:1px solid rgba(245,158,11,.15);border-radius:var(--r-md)">
            <div style="font-size:var(--text-3xl);font-weight:800;color:var(--amber)">${values.prod}</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">MWh produits</div>
          </div>
        </div>
      </div>`;
  }

  function _exportBlock(profile, summary) {
    const reports = NukunuData.reportingData.reports || {};
    const list = reports[profile] || [];
    return `
      <div class="table-wrapper fade-up">
        <div class="table-header">
          <span class="table-header__title">Rapports disponibles</span>
        </div>
        <table>
          <thead><tr><th>Rapport</th><th>Période</th><th>Format</th><th>Action</th></tr></thead>
          <tbody>
            ${list.map(report => `<tr>
              <td>${report}</td>
              <td style="color:var(--text-secondary)">${summary.label}</td>
              <td><span class="badge badge--blue">${report.toLowerCase().includes('excel') ? 'CSV' : 'PDF'}</span></td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="ModuleReporting.downloadAvailableReport('${report}','${profile}')">
                  <i data-lucide="download"></i> Télécharger
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _initMonthlyChart(data) {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas) return;
    const inst = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          { label: 'Production (kWh)', data: data.production, backgroundColor: 'rgba(245,158,11,0.5)', borderColor: '#F59E0B', borderWidth: 1.5, borderRadius: 4, yAxisID: 'y' },
          { label: 'Revenus (€)', data: data.revenue, type: 'line', borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 2, pointRadius: 3, tension: 0.4, fill: true, yAxisID: 'y1' }
        ]
      },
      options: _chartOpts()
    });
    App.registerChart('monthly', inst);
  }

  function _initFinanceChart(profile, data) {
    const canvas = document.getElementById('chart-finance');
    if (!canvas) return;
    const opex = NukunuData.opexValues;
    const inst = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: NukunuData.opexMonths,
        datasets: [{
          label: profile === 'fonds' ? 'OPEX (€)' : 'Économies (€)',
          data: profile === 'fonds' ? opex : data.revenue.map(value => value * 0.85),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.4,
          fill: true
        }]
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
            borderWidth: 1 
          } 
        },
        scales: {
          x: { grid: { color: _getThemeColors().grid }, ticks: { color: _getThemeColors().text, font: { size: 11 } } },
          y: { grid: { color: _getThemeColors().grid }, ticks: { color: _getThemeColors().text, font: { size: 11 } } }
        }
      }
    });
    App.registerChart('finance', inst);
  }

  function _chartOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { 
          backgroundColor: _getThemeColors().tooltipBg, 
          titleColor: _getThemeColors().tooltipText, 
          bodyColor: _getThemeColors().text, 
          borderColor: _getThemeColors().grid, 
          borderWidth: 1 
        }
      },
      scales: {
        x: { grid: { color: _getThemeColors().grid }, ticks: { color: _getThemeColors().text, font: { size: 11 } } },
        y: { position: 'left', grid: { color: _getThemeColors().grid }, ticks: { color: _getThemeColors().text, font: { size: 11 } } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: _getThemeColors().text, font: { size: 11 } } }
      }
    };
  }

  function exportReport(profile, format) {
    const monthly = NukunuData.monthlyData();
    const summary = _periodSummary(monthly, _selectedPeriod);

    if (format === 'pdf') {
      App.openPrintDocument(
        `reporting-${profile}.pdf`,
        `Rapport ${profile} — ${summary.label}`,
        `<div class="card">
          <div><strong>Profil:</strong> ${profile}</div>
          <div><strong>Période:</strong> ${summary.label}</div>
          <div><strong>Production:</strong> ${App.fmt(summary.production, 'kWh')}</div>
          <div><strong>Revenus:</strong> ${App.fmtEur(summary.revenue)}</div>
        </div>
        <table>
          <thead><tr><th>Mois</th><th>Production (kWh)</th><th>Revenus (€)</th></tr></thead>
          <tbody>${monthly.labels.map((label, index) => `<tr><td>${label}</td><td>${App.fmt(monthly.production[index], 'kWh')}</td><td>${App.fmtEur(monthly.revenue[index])}</td></tr>`).join('')}</tbody>
        </table>`
      );
      return;
    }

    App.exportTableLike(`reporting-${profile}.csv`, [
      ['Profil', 'Période', 'Production (kWh)', 'Revenus (€)'],
      [profile, summary.label, summary.production, summary.revenue],
      ...monthly.labels.map((label, index) => [profile, `${label} 2026`, monthly.production[index], monthly.revenue[index]]),
    ]);
  }

  function sendReport(profile) {
    App.openModal(
      'Envoyer le rapport',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group">
          <label class="form-label">Destinataires</label>
          <input class="form-input" id="report-recipients" value="direction@nukunu.solar; exploitation@nukunu.solar">
        </div>
        <div class="form-group">
          <label class="form-label">Message</label>
          <textarea class="form-textarea" id="report-message">Bonjour, veuillez trouver le rapport ${profile} prêt à être partagé.</textarea>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleReporting.confirmSendReport('${profile}')">Envoyer</button>`
    );
  }

  async function confirmSendReport(profile) {
    const recipients = document.getElementById('report-recipients')?.value || '';
    const message = document.getElementById('report-message')?.value || '';
    const summary = _periodSummary(NukunuData.monthlyData(), _selectedPeriod);
    await NukunuData.logActivity({
      title: `Rapport ${profile} préparé`,
      message: `Destinataires: ${recipients}`,
      module: 'reporting',
      actionLabel: 'Ouvrir le reporting',
    });
    App.openMailClient(recipients, `Rapport ${profile} — ${summary.label}`, message);
    App.closeModal();
    App.toast('Client email ouvert pour l’envoi du rapport', 'success');
  }

  function downloadAvailableReport(reportName, profile) {
    const summary = _periodSummary(NukunuData.monthlyData(), _selectedPeriod);
    App.openPrintDocument(
      `${reportName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.pdf`,
      reportName,
      `<div class="card">
        <div><strong>Profil:</strong> ${profile}</div>
        <div><strong>Période:</strong> ${summary.label}</div>
        <div><strong>Production:</strong> ${App.fmt(summary.production, 'kWh')}</div>
        <div><strong>Revenus:</strong> ${App.fmtEur(summary.revenue)}</div>
      </div>`
    );
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

  return { render, exportReport, sendReport, confirmSendReport, downloadAvailableReport };
})();
