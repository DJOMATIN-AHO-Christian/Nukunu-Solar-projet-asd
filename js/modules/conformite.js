/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE 5: CONFORMITÉ & RÉGLEMENTAIRE
═══════════════════════════════════════════════════════════ */

const ModuleConformite = (() => {
  let _loading = false;
  let _loadedFor = null;
  let _searchTerm = '';
  let _statusFilter = 'all';

  function render() {
    const profile = Profile.get();
    const view = document.getElementById('module-conformite');
    if (!view) return;

    const scope = window.NukunuStore.get('nukunu_user_id') || window.NukunuStore.get('nukunu_user_email') || 'anonymous';
    if (!_loading && _loadedFor !== scope) {
      _loading = true;
      view.innerHTML = '<div class="card">Synchronisation documentaire en cours...</div>';
      NukunuData.refreshDocuments().finally(() => {
        _loadedFor = scope;
        _loading = false;
        render();
      });
      return;
    }

    const docs = NukunuData.getDocuments();
    const filteredDocs = docs.filter(doc => {
      if (_statusFilter !== 'all' && doc.status !== _statusFilter) return false;
      const search = _searchTerm.trim().toLowerCase();
      if (!search) return true;
      return [doc.name, doc.site, doc.file_name].filter(Boolean).join(' ').toLowerCase().includes(search);
    });
    const missing = docs.filter(d=>d.status==='missing').length;
    const expired = docs.filter(d=>d.status==='expired').length;
    const warning = docs.filter(d=>d.status==='warning').length;

    view.innerHTML = `
      <div class="module-header">
        <div class="module-header__left">
          <h1 class="module-title">Conformité Réglementaire</h1>
          <p class="module-subtitle">${_subtitle(profile)}</p>
        </div>
        <div class="module-actions">
          <button class="btn btn-secondary btn-sm" onclick="ModuleConformite.openImportModal()"><i data-lucide="upload"></i> Importer documents</button>
          <button class="btn btn-primary btn-sm" onclick="ModuleConformite.runAudit()"><i data-lucide="shield-check"></i> Audit complet</button>
        </div>
      </div>

      ${_deadlines()}

      <div class="kpi-grid stagger" style="margin-bottom:var(--sp-5)">
        <div class="kpi-card kpi--green fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">Valides</span><div class="kpi-card__icon"><i data-lucide="check-circle"></i></div></div>
          <div class="kpi-card__value">${docs.filter(d=>d.status==='valid').length}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">Documents à jour</div>
        </div>
        <div class="kpi-card kpi--amber fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">À renouveler</span><div class="kpi-card__icon"><i data-lucide="alert-triangle"></i></div></div>
          <div class="kpi-card__value">${warning}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">Expiration proche</div>
        </div>
        <div class="kpi-card kpi--red fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">Manquants</span><div class="kpi-card__icon"><i data-lucide="file-x"></i></div></div>
          <div class="kpi-card__value">${missing}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">Documents requis</div>
        </div>
        <div class="kpi-card kpi--red fade-up">
          <div class="kpi-card__header"><span class="kpi-card__label">Expirés</span><div class="kpi-card__icon"><i data-lucide="clock"></i></div></div>
          <div class="kpi-card__value">${expired}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">Renouvellement urgent</div>
        </div>
      </div>

      <div class="table-wrapper fade-up" style="margin-bottom:var(--sp-4)">
        <div class="table-header">
          <span class="table-header__title">Coffre-fort documentaire</span>
          <div class="table-header__actions">
            <input class="form-input" id="document-search" style="width:220px;height:34px" placeholder="Rechercher un document..." value="${_searchTerm}">
            <select class="form-select" id="document-status-filter" style="width:160px;height:34px">
              <option value="all" ${_statusFilter === 'all' ? 'selected' : ''}>Tous statuts</option>
              <option value="valid" ${_statusFilter === 'valid' ? 'selected' : ''}>Valide</option>
              <option value="missing" ${_statusFilter === 'missing' ? 'selected' : ''}>Manquant</option>
              <option value="expired" ${_statusFilter === 'expired' ? 'selected' : ''}>Expiré</option>
              <option value="warning" ${_statusFilter === 'warning' ? 'selected' : ''}>À renouveler</option>
            </select>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>Document</th><th>Site</th><th>Date document</th><th>Expiration</th><th>Statut</th><th>Action</th>
          </tr></thead>
          <tbody>
            ${filteredDocs.map(d=>`
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:var(--sp-2)">
                    <i data-lucide="${d.status==='valid'?'file-check':d.status==='missing'?'file-x':'file-warning'}"
                       style="width:15px;height:15px;color:var(--${d.status==='valid'?'green':d.status==='missing'?'red':'amber'})"></i>
                    ${d.name}
                  </div>
                </td>
                <td style="color:var(--text-secondary)">${d.site}</td>
                <td style="color:var(--text-secondary)">${d.date||'—'}</td>
                <td style="color:${d.expiry?'var(--amber)':'var(--text-muted)'}">${d.expiry||'—'}</td>
                <td>
                  <span class="badge badge--${d.status==='valid'?'green':d.status==='missing'?'red':'amber'}">
                    ${d.status==='valid'?'VALIDE':d.status==='missing'?'MANQUANT':d.status==='expired'?'EXPIRÉ':'À RENOUVELER'}
                  </span>
                </td>
                <td>
                  ${d.status==='valid'
                    ? `<button class="btn btn-sm btn-ghost" onclick="ModuleConformite.downloadDocument('${d.id}')"><i data-lucide="download"></i></button>`
                    : `<button class="btn btn-sm btn-danger" onclick="ModuleConformite.openUploadModal('${encodeURIComponent(d.name)}','${encodeURIComponent(d.site)}')"><i data-lucide="upload"></i> Ajouter</button>`
                  }
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      ${_checklistBlock(profile)}
    `;
    _bindFilters();
  }

  function _subtitle(p) {
    const m = {
      installateur:'Checklist mise en service · Dossiers Enedis · Suivi conformité chantiers',
      fonds:'Reporting ESG · Taxonomie verte UE · Due diligence technique',
      industriel:'Décret Tertiaire · Bilan carbone · DPEF · Audits énergétiques',
      particulier:'Déclaration IRPPro · Relevé Enedis · Statut installation'
    };
    return m[p]||'';
  }

  function _deadlines() {
    const deadlines = NukunuData.conformiteData.deadlines || [];
    return `
      <div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-bottom:var(--sp-5)">
        <div style="font-size:var(--text-sm);font-weight:700;margin-bottom:var(--sp-2);color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em">Échéances réglementaires</div>
        ${deadlines.map(e=>`
          <div class="alert-item alert--${e.level==='red'?'critical':e.level==='amber'?'warning':'ok'} fade-in">
            <i data-lucide="${e.level==='red'?'alarm-clock':e.level==='amber'?'clock':'calendar'}"></i>
            <div class="alert-item__content">
              <span class="alert-item__site">${e.label}</span>
              <span class="alert-item__time">Échéance : ${e.date}</span>
            </div>
            <span class="badge badge--${e.level==='red'?'red':e.level==='amber'?'yellow':'green'}">J−${e.days}</span>
          </div>`).join('')}
      </div>`;
  }

  function _checklistBlock(profile) {
    const items = (NukunuData.conformiteData.checklist || {})[profile] || [];
    const done = items.filter(i=>i.done).length;
    return `
      <div class="card fade-up">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4)">
          <div style="font-weight:700;font-size:var(--text-base)">Checklist de conformité</div>
          <span class="badge badge--${done===items.length?'green':'amber'}">${done}/${items.length} complété</span>
        </div>
        <div class="progress-bar" style="margin-bottom:var(--sp-5)">
          <div class="progress-bar__fill ${done===items.length?'progress-bar--green':''}" style="width:${Math.round(done/items.length*100)}%"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
          ${items.map(i=>`
            <div style="display:flex;align-items:center;gap:var(--sp-3)">
              <div style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;
                background:${i.done?'var(--green-bg)':'var(--bg-hover)'};border:2px solid ${i.done?'var(--green)':'var(--border-medium)'};
                color:${i.done?'var(--green)':'var(--text-muted)'}">
                <i data-lucide="${i.done?'check':'circle'}" style="width:12px;height:12px"></i>
              </div>
              <span style="font-size:var(--text-sm);color:${i.done?'var(--text-secondary)':'var(--text-primary)'};
                text-decoration:${i.done?'line-through':'none'}">${i.item}</span>
              ${!i.done?`<span class="badge badge--amber" style="margin-left:auto;font-size:10px">À faire</span>`:''}
            </div>`).join('')}
        </div>
      </div>`;
  }

  function openImportModal() {
    const siteOptions = NukunuData.allSiteOptions();
    App.openModal(
      'Importer un document',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="form-group">
          <label class="form-label">Nom du document</label>
          <input class="form-input" id="doc-name" placeholder="Ex: Attestation CONSUEL">
        </div>
        <div class="form-group">
          <label class="form-label">Site</label>
          <select class="form-select" id="doc-site">${siteOptions.map(site => `<option value="${site.name}">${site.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Date du document</label>
          <input class="form-input" id="doc-date" type="date" value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="form-group">
          <label class="form-label">Fichier</label>
          <input class="form-input" id="doc-file" type="file">
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleConformite.submitImport()">Importer</button>`
    );
  }

  async function submitImport() {
    const name = document.getElementById('doc-name')?.value?.trim();
    const site = document.getElementById('doc-site')?.value;
    const date = document.getElementById('doc-date')?.value;
    if (!name || !site) {
      App.toast('Merci de renseigner le document et le site', 'warning');
      return;
    }
    const file = document.getElementById('doc-file')?.files?.[0] || null;
    if (!file) {
      App.toast('Merci de sélectionner un fichier à importer.', 'warning');
      return;
    }
    const fileContent = await App.readFileAsDataUrl(file);
    await NukunuData.addDocumentRemote({
      name,
      site,
      date,
      status: 'valid',
      file_name: file?.name || null,
      file_mime_type: file?.type || null,
      file_content: fileContent,
    });
    App.closeModal();
    App.toast('Document importé avec succès', 'success');
    App.refreshCurrentModule();
  }

  function openUploadModal(encodedName, encodedSite) {
    const name = decodeURIComponent(encodedName);
    const site = decodeURIComponent(encodedSite);
    App.openModal(
      `Ajouter le document — ${name}`,
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="data-row"><div class="data-row__label">Site</div><div class="data-row__value">${site}</div></div>
        <div class="form-group">
          <label class="form-label">Fichier justificatif</label>
          <input class="form-input" id="missing-doc-file" type="file">
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="ModuleConformite.uploadDocument('${encodedName}','${encodedSite}')">Enregistrer</button>`
    );
  }

  async function uploadDocument(encodedName, encodedSite) {
    const name = decodeURIComponent(encodedName);
    const site = decodeURIComponent(encodedSite);
    const file = document.getElementById('missing-doc-file')?.files?.[0] || null;
    if (!file) {
      App.toast('Merci de sélectionner un fichier justificatif.', 'warning');
      return;
    }
    const fileContent = await App.readFileAsDataUrl(file);
    const payload = {
      file_name: file?.name || null,
      file_mime_type: file?.type || null,
      file_content: fileContent,
    };
    const updated = await NukunuData.markDocumentUploadedRemote(name, site, payload);
    if (updated) {
      App.toast(`${name} ajouté pour ${site}`, 'success');
      App.refreshCurrentModule();
      return;
    }
    await NukunuData.addDocumentRemote({ name, site, status: 'valid', ...payload });
    App.toast(`${name} ajouté pour ${site}`, 'success');
    App.refreshCurrentModule();
  }

  function downloadDocument(id) {
    const documentItem = NukunuData.getDocuments().find(doc => doc.id === id);
    if (!documentItem) return;
    if (documentItem.file_content) {
      const link = document.createElement('a');
      link.href = documentItem.file_content;
      link.download = documentItem.file_name || `${documentItem.name}.bin`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      App.toast(`Téléchargement prêt pour ${documentItem.name}`, 'success');
      return;
    }
    App.downloadFile(
      `${documentItem.name.toLowerCase().replace(/\s+/g, '-')}.txt`,
      `Document: ${documentItem.name}\nSite: ${documentItem.site}\nExporté depuis Nukunu Solar le ${new Date().toLocaleDateString('fr-FR')}`
    );
    App.toast(`Téléchargement prêt pour ${documentItem.name}`, 'success');
  }

  function runAudit() {
    const documents = NukunuData.getDocuments();
    const invalidDocuments = documents.filter(document => document.status === 'missing' || document.status === 'expired' || document.status === 'warning');
    App.openModal(
      'Audit de conformité',
      `<div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        <div class="data-row"><div class="data-row__label">Documents analysés</div><div class="data-row__value">${documents.length}</div></div>
        <div class="data-row"><div class="data-row__label">Éléments à corriger</div><div class="data-row__value">${invalidDocuments.length}</div></div>
        <div class="data-row"><div class="data-row__label">Statut</div><div class="data-row__value">${invalidDocuments.length ? 'Actions requises' : 'Conforme'}</div></div>
        <div class="card" style="padding:var(--sp-4)">
          <div style="font-weight:700;margin-bottom:var(--sp-2)">Plan d’action</div>
          ${invalidDocuments.length
            ? invalidDocuments.map(document => `<div style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--sp-2)">• ${document.name} (${document.site}) — ${document.status}</div>`).join('')
            : `<div style="font-size:var(--text-sm);color:var(--text-secondary)">Aucune action corrective n’est nécessaire.</div>`}
        </div>
      </div>`,
      `<button class="btn btn-primary" onclick="App.closeModal()">Fermer</button>`
    );
  }

  function _bindFilters() {
    document.getElementById('document-search')?.addEventListener('input', event => {
      _searchTerm = event.target.value || '';
      render();
      lucide.createIcons();
    });
    document.getElementById('document-status-filter')?.addEventListener('change', event => {
      _statusFilter = event.target.value || 'all';
      render();
      lucide.createIcons();
    });
  }

  return { render, openImportModal, submitImport, openUploadModal, uploadDocument, downloadDocument, runAudit };
})();
