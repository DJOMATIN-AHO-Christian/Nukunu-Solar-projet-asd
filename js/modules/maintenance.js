/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 3: MAINTENANCE & O&M
═══════════════════════════════════════════════════════════ */

const ModuleMaintenance = (() => {
  let _loading = false;
  let _loadedFor = null;

  function render() {
    const profile = Profile.get();
    const view = document.getElementById('module-maintenance');
    if (!view) return;

    const scope = window.NukunuStore.get('nukunu_user_id') || window.NukunuStore.get('nukunu_user_email') || 'anonymous';
    if (!_loading && _loadedFor !== scope) {
      _loading = true;
      view.innerHTML = '<div class="card">Synchronisation des tickets en cours...</div>';
      NukunuData.refreshTickets().finally(() => {
        _loadedFor = scope;
        _loading = false;
        render();
      });
      return;
    }

    const tickets = NukunuData.getTickets();
    const todo       = tickets.filter(t=>t.status==='todo');
    const inprogress = tickets.filter(t=>t.status==='inprogress');
    const done       = tickets.filter(t=>t.status==='done');

    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Maintenance & O&M</h1>
          <p class="module-subtitle">${_subtitle(profile)}</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="ModuleMaintenance.openPlanning()"><i data-lucide="calendar"></i> Planning</button>
          <button class="btn btn-primary btn-sm" onclick="App.openModal('Nouveau ticket', ModuleMaintenance.ticketFormHTML(), ModuleMaintenance.ticketFormFooter())">
            <i data-lucide="plus"></i> Nouveau ticket
          </button>
        </div>
      </div>

      ${_kpiRow(profile)}

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4)">
        <div style="font-size:var(--text-base);font-weight:700">Tickets d'intervention</div>
        <div style="display:flex;gap:var(--sp-2)">
          <span class="badge badge--red">${todo.length} À faire</span>
          <span class="badge badge--amber">${inprogress.length} En cours</span>
          <span class="badge badge--green">${done.length} Résolus</span>
        </div>
      </div>

      <div class="kanban-board" style="margin-bottom:var(--sp-6)">
        ${_kanbanCol('À faire','red','alert-circle',todo)}
        ${_kanbanCol('En cours','amber','loader',inprogress)}
        ${_kanbanCol('Résolu','green','check-circle',done)}
      </div>

      ${_warrantiesBlock()}
    `;
  }

  function _subtitle(p) {
    const m={
      installateur:'Tickets SAV · Kanban techniciens · SLA',
      fonds:'OPEX consolidé · Coûts O&M par MW',
      industriel:'Contrat O&M annuel · Visites préventives',
      particulier:'Rappels de maintenance · Mise en relation technicien'
    };
    return m[p]||'';
  }

  function _kpiRow(profile) {
    const t = NukunuData.getTickets();
    const critical = t.filter(x=>x.priority==='critical'&&x.status!=='done').length;
    const costNp = t.filter(x=>x.status!=='done').reduce((a,b)=>a+(b.cost_np||0),0);
    const items = [
      ['Tickets ouverts',t.filter(x=>x.status!=='done').length,'wrench','amber'],
      ['Critiques',critical,'alert-circle','red'],
      ['Coût non-prod.',App.fmtEur(costNp)+'/j','trending-down','red'],
      ['Résolus (30j)',t.filter(x=>x.status==='done').length,'check-circle','green'],
    ];
    return `<div class="kpi-grid stagger" style="margin-bottom:var(--sp-5)">
      ${items.map(([label,value,icon,color])=>`
        <div class="kpi-card kpi--${color} fade-up">
          <div class="kpi-card__header">
            <span class="kpi-card__label">${label}</span>
            <div class="kpi-card__icon"><i data-lucide="${icon}"></i></div>
          </div>
          <div class="kpi-card__value">${value}</div>
        </div>`).join('')}
    </div>`;
  }

  function _kanbanCol(title, color, icon, items) {
    return `
      <div class="kanban-col">
        <div class="kanban-col__header">
          <div class="kanban-col__title">
            <i data-lucide="${icon}" style="width:15px;height:15px;color:var(--${color})"></i>
            ${title}
          </div>
          <span class="kanban-col__count">${items.length}</span>
        </div>
        <div class="kanban-col__body">
          ${items.map(t=>_kanbanCard(t)).join('')}
          ${items.length===0?`<div style="padding:var(--sp-4);text-align:center;color:var(--text-muted);font-size:var(--text-xs)">Aucun ticket</div>`:''}
        </div>
      </div>`;
  }

  function _kanbanCard(t) {
    const pc = t.priority==='critical'?'red':t.priority==='warning'?'amber':'gray';
    const costHtml = t.cost_np?`<span style="font-size:10px;color:var(--red);font-weight:700">−${t.cost_np} €/h</span>`:'';
    return `
      <div class="kanban-card" onclick="App.openModal('Ticket ${t.id}', ModuleMaintenance.ticketDetailHTML('${t.id}'), ModuleMaintenance.ticketDetailFooter('${t.id}'))">
        <div class="kanban-card__top">
          <span style="font-size:10px;color:var(--text-muted);font-weight:600">${t.id}</span>
          <span class="badge badge--${pc}" style="font-size:10px">${t.priority==='critical'?'CRITIQUE':t.priority==='warning'?'ATTENTION':'NORMAL'}</span>
        </div>
        <div class="kanban-card__title">${t.title}</div>
        <div class="kanban-card__footer">
          <div class="kanban-card__site"><i data-lucide="map-pin"></i>${t.site}</div>
          ${costHtml}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:var(--sp-2)">
          <span style="font-size:10px;color:var(--text-muted)">
            <i data-lucide="user" style="width:11px;height:11px"></i> ${t.tech}
          </span>
          <span style="font-size:10px;color:var(--text-muted)">Échéance: ${t.due}</span>
        </div>
      </div>`;
  }

  function _warrantiesBlock() {
    const w = NukunuData.warranties;
    return `
      <div class="table-wrapper fade-up">
        <div class="table-header">
          <span class="table-header__title">Suivi des garanties fabricants</span>
          <div class="table-header__actions">
            <span class="badge badge--amber"><i data-lucide="alert-triangle" style="width:11px;height:11px"></i> 1 garantie <50% restante</span>
          </div>
        </div>
        <table>
          <thead><tr><th>Composant</th><th>Site</th><th>Début</th><th>Durée</th><th>Progression</th><th>Statut</th></tr></thead>
          <tbody>
            ${w.map(g=>{
              const used=g.pct;
              const left=100-used;
              const color=used>80?'red':used>50?'amber':'green';
              return `<tr>
                <td>${g.name}</td>
                <td style="color:var(--text-secondary)">${g.site}</td>
                <td style="color:var(--text-secondary)">${g.start}</td>
                <td style="color:var(--text-secondary)">${g.years} ans</td>
                <td style="min-width:140px">
                  <div class="pr-bar">
                    <div class="pr-bar__bg"><div class="pr-bar__fill pr-bar__fill--${color==='green'?'':color==='amber'?'warn':'bad'}" style="width:${used}%"></div></div>
                    <span class="pr-bar__val">${left}% restant</span>
                  </div>
                </td>
                <td>
                  <span class="badge badge--${color}">${g.warn?'À surveiller':color==='green'?'OK':'Attention'}</span>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ── PUBLIC : TICKET FORM ──────────────────── */
  function ticketFormHTML(siteId='') {
    const sites = NukunuData.allSiteOptions();
    return `
      <div class="form-group">
        <label class="form-label">Site</label>
        <select class="form-select" id="ticket-site">
          <option value="">— Choisir un site —</option>
          ${sites.map(s=>`<option value="${s.name}" ${s.id===siteId?'selected':''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type d'intervention</label>
          <select class="form-select" id="ticket-type">
            <option value="Correctif urgent">Correctif urgent</option><option value="Correctif planifié">Correctif planifié</option>
            <option value="Préventif">Préventif</option><option value="Audit">Audit</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priorité</label>
          <select class="form-select" id="ticket-priority">
            <option value="critical">Critique</option><option value="warning">Attention</option><option value="normal">Normal</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Technicien assigné</label>
        <select class="form-select" id="ticket-tech">
          <option value="A. Martin">A. Martin</option><option value="L. Dupont">L. Dupont</option><option value="M. Lefevre">M. Lefevre</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="ticket-description" placeholder="Décrivez le problème constaté..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date d'intervention</label>
          <input type="date" class="form-input" id="ticket-due" value="2026-03-25">
        </div>
        <div class="form-group">
          <label class="form-label">SLA (heures)</label>
          <input type="number" class="form-input" id="ticket-sla" value="24">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Coût de non-production estimé (€/h)</label>
        <input type="number" class="form-input" id="ticket-cost" value="0" min="0">
      </div>`;
  }

  function ticketFormFooter() {
    return `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button>
            <button class="btn btn-primary" onclick="ModuleMaintenance.submitTicketForm()">
              <i data-lucide="save"></i> Créer le ticket
            </button>`;
  }

  function ticketDetailHTML(id) {
    const t = NukunuData.getTicket(id);
    if(!t) return '<p>Ticket introuvable.</p>';
    const pc=t.priority==='critical'?'red':t.priority==='warning'?'amber':'gray';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4)">
        <span class="badge badge--${pc}">${t.priority.toUpperCase()}</span>
        <span style="font-size:var(--text-sm);color:var(--text-muted)">${t.id}</span>
      </div>
      <div class="data-row"><div class="data-row__label">Site</div><div class="data-row__value">${t.site}</div></div>
      <div class="data-row"><div class="data-row__label">Technicien</div><div class="data-row__value">${t.tech}</div></div>
      <div class="data-row"><div class="data-row__label">Créé le</div><div class="data-row__value">${t.created}</div></div>
      <div class="data-row"><div class="data-row__label">Échéance</div><div class="data-row__value">${t.due}</div></div>
      <div class="data-row"><div class="data-row__label">Statut</div><div class="data-row__value">${_statusLabel(t.status)}</div></div>
      ${t.cost_np?`<div class="data-row"><div class="data-row__label">Coût non-prod.</div><div class="data-row__value" style="color:var(--red)">−${t.cost_np} €/h</div></div>`:''}
      <div style="margin-top:var(--sp-4);font-size:var(--text-sm);color:var(--text-secondary)">${t.description || t.title}</div>`;
  }

  function ticketDetailFooter(id) {
    const t = NukunuData.getTicket(id);
    if (!t) return '';
    const actions = [];
    if (t.status === 'todo') {
      actions.push(`<button class="btn btn-secondary" onclick="ModuleMaintenance.updateTicketStatus('${id}','inprogress')"><i data-lucide="play"></i> Démarrer</button>`);
    }
    if (t.status !== 'done') {
      actions.push(`<button class="btn btn-primary" onclick="ModuleMaintenance.updateTicketStatus('${id}','done')"><i data-lucide="check-circle"></i> Marquer résolu</button>`);
    }
    actions.push(`<button class="btn btn-ghost" onclick="App.closeModal()">Fermer</button>`);
    return actions.join('');
  }

  async function submitTicketForm() {
    const site = document.getElementById('ticket-site')?.value;
    const type = document.getElementById('ticket-type')?.value;
    const priority = document.getElementById('ticket-priority')?.value;
    const tech = document.getElementById('ticket-tech')?.value;
    const description = document.getElementById('ticket-description')?.value?.trim();
    const due = document.getElementById('ticket-due')?.value;
    const sla = document.getElementById('ticket-sla')?.value;
    const cost = document.getElementById('ticket-cost')?.value;

    if (!site || !description) {
      App.toast('Merci de sélectionner un site et de décrire le problème', 'warning');
      return;
    }

    const created = await NukunuData.createTicketRemote({
      site,
      type,
      title: description.slice(0, 60),
      priority,
      tech,
      description,
      due,
      sla,
      cost_np: cost,
    });

    App.closeModal();
    App.toast(`Ticket ${created.id} créé avec succès`, 'success');
    App.refreshCurrentModule();
  }

  async function updateTicketStatus(id, status) {
    const updated = await NukunuData.updateTicketStatusRemote(id, status);
    if (!updated) {
      App.toast('Ticket introuvable', 'error');
      return;
    }
    App.closeModal();
    App.toast(`Ticket ${updated.id} mis à jour`, 'success');
    App.refreshCurrentModule();
  }

  function openPlanning() {
    const openTickets = NukunuData.getTickets()
      .filter(ticket => ticket.status !== 'done')
      .sort((a, b) => a.due.localeCompare(b.due));
    App.openModal(
      'Planning des interventions',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">${openTickets.map(ticket => `
        <div class="data-row">
          <div>
            <div style="font-weight:700;color:var(--text-primary)">${ticket.site}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted)">${ticket.tech} · ${ticket.title}</div>
          </div>
          <div class="data-row__value">${ticket.due}</div>
        </div>`).join('')}</div>`,
      `<button class="btn btn-primary" onclick="App.closeModal()">Fermer</button>`
    );
  }

  function openNewTicket(alertId) {
    const alert = NukunuData.findAlert(alertId);
    App.navigateTo('maintenance');
    setTimeout(()=>{
      App.openModal('Nouveau ticket', ticketFormHTML(alert?.siteId || ''), ticketFormFooter());
      if (alert) {
        const description = document.getElementById('ticket-description');
        if (description) description.value = `${alert.site} — ${alert.msg}`;
      }
    },200);
  }

  function _statusLabel(status) {
    return { todo:'À faire', inprogress:'En cours', done:'Résolu' }[status] || status;
  }

  return {
    render,
    ticketFormHTML,
    ticketFormFooter,
    ticketDetailHTML,
    ticketDetailFooter,
    submitTicketForm,
    updateTicketStatus,
    openPlanning,
    openNewTicket
  };
})();
