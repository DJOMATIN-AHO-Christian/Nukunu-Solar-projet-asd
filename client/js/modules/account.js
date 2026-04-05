/* ════════════════════════════════════════════════════════════
   NUKUNU SOLAR — MODULE ACCOUNT
   Manage profile, settings, and session with API integration
   ════════════════════════════════════════════════════════════ */

const ModuleAccount = (() => {

  async function render() {
    const container = document.getElementById('module-account');
    if (!container) return;
    
    container.innerHTML = `
      <div class="module-header fade-up">
        <div class="module-header__left">
          <h1 class="module-title">Mon Compte</h1>
          <p class="module-subtitle">Chargement de vos informations...</p>
        </div>
      </div>
    `;

    try {
      const token = window.NukunuStore.get('nukunu_token');
      if (!token) throw new Error('Non authentifié');

      const res = await fetch(`${App.getApiBase()}/api/account`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      const user = data.user;
      const roleDetails = data.roleDetails || {};
      const init = user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
      
      const roleFieldConfigs = {
        installateur: [
          { key: 'company_name', label: 'Entreprise', type: 'text', placeholder: 'SolarTech Solutions' },
          { key: 'qualipv_id', label: 'ID Certificat QualiPV', type: 'text', placeholder: 'PV-202X' },
          { key: 'managed_sites', label: 'Nombre de sites', type: 'number', placeholder: '0' }
        ],
        fonds: [
          { key: 'management_company', label: 'Société de gestion', type: 'text', placeholder: 'EcoCapital' },
          { key: 'managed_volume_mwp', label: 'Volume géré (MWp)', type: 'number', placeholder: '0' },
          { key: 'active_assets', label: 'Actifs gérés', type: 'number', placeholder: '0' }
        ],
        industriel: [
          { key: 'site_name', label: 'Site industriel', type: 'text', placeholder: 'Usine Nord' },
          { key: 'roof_surface_m2', label: 'Surface toiture (m²)', type: 'number', placeholder: '0' },
          { key: 'annual_consumption_kwh', label: 'Conso. annuelle (kWh)', type: 'number', placeholder: '0' }
        ],
        particulier: [
          { key: 'installation_address', label: 'Adresse installation', type: 'text', placeholder: 'Ex: 12 rue...' },
          { key: 'peak_power_kwp', label: 'Puissance crête (kWp)', type: 'number', placeholder: '0' },
          { key: 'connection_type', label: 'Type de raccordement', type: 'text', placeholder: 'Autoconsommation...' }
        ]
      };

      const extraFields = roleFieldConfigs[user.role] || [];
      const roleTitle = {
        installateur: 'Détails Professionnels',
        fonds: 'Gestion d\'Actifs',
        industriel: 'Détails du Site',
        particulier: 'Mon Installation'
      }[user.role] || 'Détails Complémentaires';

      container.innerHTML = `
        <div class="module-header fade-up">
          <div class="module-header__left">
            <h1 class="module-title">Mon Compte</h1>
            <p class="module-subtitle">Gérez vos informations personnelles et professionnelles</p>
          </div>
          <div class="module-actions">
            <button class="btn btn-secondary" onclick="App.logout()">
              <i data-lucide="log-out"></i> Déconnexion
            </button>
          </div>
        </div>

        <div class="section-grid section-grid--1-2 fade-up" style="animation-delay: 0.1s">
          <div class="card" style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-4);">
            <div class="user-avatar" style="width: 80px; height: 80px; font-size: var(--text-2xl);">${init}</div>
            <div>
              <h3 style="font-size: var(--text-lg); font-weight: 700;">${user.name}</h3>
              <p style="color: var(--text-secondary); font-size: var(--text-sm);">${user.email}</p>
            </div>
            <div class="badge badge--amber">${user.role.toUpperCase()}</div>
            
            <div style="width: 100%; margin-top: var(--sp-4); text-align: left;">
              <div class="data-row">
                <span class="data-row__label">ID Utilisateur</span>
                <span class="data-row__value">#${user.id.toString().padStart(4, '0')}</span>
              </div>
              <div class="data-row">
                <span class="data-row__label">Depuis</span>
                <span class="data-row__value">${new Date(user.created_at).toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}</span>
              </div>
              <div class="data-row">
                <span class="data-row__label">Email</span>
                <span class="data-row__value">${user.email_verified ? 'Vérifié' : 'À confirmer'}</span>
              </div>
            </div>
          </div>

          <form id="account-form" style="display: flex; flex-direction: column; gap: var(--sp-4);">
            <div class="card">
              <h3 style="font-size: var(--text-base); font-weight: 700; margin-bottom: var(--sp-4);">Informations Personnelles</h3>
              <div class="form-group">
                <label class="form-label">Nom complet</label>
                <input type="text" class="form-input" id="acc-name" value="${user.name}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="acc-email" value="${user.email}" required>
              </div>
            </div>

            <div class="card fade-up" style="animation-delay: 0.2s">
              <h3 style="font-size: var(--text-base); font-weight: 700; margin-bottom: var(--sp-4); color: var(--amber);">${roleTitle}</h3>
              ${extraFields.map(f => `
                <div class="form-group">
                  <label class="form-label">${f.label}</label>
                  <input type="${f.type}" class="form-input" id="role-${f.key}" value="${roleDetails[f.key] || ''}" placeholder="${f.placeholder}">
                </div>
              `).join('')}
              <p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--sp-4);">
                <i data-lucide="info" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                Ces informations sont liées à votre profil <strong>${user.role}</strong> et sauvegardées dans la base de données.
              </p>
            </div>

            <div class="card fade-up" style="animation-delay: 0.25s">
              <h3 style="font-size: var(--text-base); font-weight: 700; margin-bottom: var(--sp-4);">Sécurité</h3>
              <div class="form-group">
                <label class="form-label">Mot de passe actuel</label>
                <input type="password" class="form-input" id="acc-current-password" placeholder="Mot de passe actuel">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Nouveau mot de passe</label>
                  <input type="password" class="form-input" id="acc-new-password" placeholder="Au moins 8 caractères">
                </div>
                <div class="form-group">
                  <label class="form-label">Confirmation</label>
                  <input type="password" class="form-input" id="acc-confirm-password" placeholder="Répéter le nouveau mot de passe">
                </div>
              </div>
              <button type="button" class="btn btn-secondary" id="change-password-btn">Mettre à jour le mot de passe</button>
            </div>

            <div class="card fade-up" style="animation-delay: 0.3s; border-color: rgba(239,68,68,.22);">
              <h3 style="font-size: var(--text-base); font-weight: 700; margin-bottom: var(--sp-2); color: var(--danger);">Zone sensible</h3>
              <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--sp-4);">La suppression du compte efface aussi les tickets, documents, prospects et données associées.</p>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Mot de passe actuel</label>
                  <input type="password" class="form-input" id="acc-delete-password" placeholder="Confirmer avec votre mot de passe">
                </div>
                <div class="form-group">
                  <label class="form-label">Tapez SUPPRIMER</label>
                  <input type="text" class="form-input" id="acc-delete-confirm" placeholder="SUPPRIMER">
                </div>
              </div>
              <button type="button" class="btn btn-danger" id="delete-account-btn">Supprimer mon compte</button>
            </div>

            <button type="submit" class="btn btn-primary" id="save-account-btn" style="align-self: flex-start;">Enregistrer les modifications</button>
          </form>
        </div>
      `;

      lucide.createIcons();

      // Bind submit
      document.getElementById('account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-account-btn');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Sauvegarde...';
        btn.disabled = true;
        lucide.createIcons();

        const payload = {
          name: document.getElementById('acc-name').value,
          email: document.getElementById('acc-email').value,
          roleDetails: {}
        };

        extraFields.forEach(f => {
          let val = document.getElementById(`role-${f.key}`).value;
          if (f.type === 'number') val = val === '' ? null : Number(val);
          payload.roleDetails[f.key] = val;
        });

        try {
          const upRes = await fetch(`${App.getApiBase()}/api/account`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          
          const updated = await upRes.json();
          if (!upRes.ok) throw new Error(updated.error || 'Erreur lors de la sauvegarde');
          
          App.toast('Profil mis à jour avec succès', 'success');
          
          // Update local cache
          window.NukunuStore.setAuthState({
            nukunu_session: 'true',
            nukunu_token: updated.token || token,
            nukunu_user_name: updated.user.name,
            nukunu_user_email: updated.user.email,
            nukunu_user_role: updated.user.role,
            nukunu_profile: updated.user.role,
            nukunu_user_id: String(updated.user.id),
          }, window.NukunuStore.isRemembered());

          // Re-render UI
          setTimeout(render, 500);

        } catch (err) {
          App.toast(err.message, 'error');
          btn.innerHTML = origText;
          btn.disabled = false;
        }
      });

      document.getElementById('change-password-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('change-password-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Mise à jour...';

        try {
          const response = await fetch(`${App.getApiBase()}/api/auth/change-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${window.NukunuStore.get('nukunu_token')}`
            },
            body: JSON.stringify({
              currentPassword: document.getElementById('acc-current-password')?.value || '',
              newPassword: document.getElementById('acc-new-password')?.value || '',
              confirmPassword: document.getElementById('acc-confirm-password')?.value || '',
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Impossible de modifier le mot de passe.');
          App.toast('Mot de passe mis à jour', 'success');
          ['acc-current-password', 'acc-new-password', 'acc-confirm-password'].forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
          });
        } catch (err) {
          App.toast(err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });

      document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('delete-account-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Suppression...';

        try {
          const response = await fetch(`${App.getApiBase()}/api/account`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${window.NukunuStore.get('nukunu_token')}`
            },
            body: JSON.stringify({
              currentPassword: document.getElementById('acc-delete-password')?.value || '',
              confirmation: document.getElementById('acc-delete-confirm')?.value || '',
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Impossible de supprimer le compte.');
          App.toast('Compte supprimé', 'success');
          window.NukunuStore.clearAuth();
          document.getElementById('app')?.classList.add('hidden');
          document.getElementById('auth-overlay')?.classList.add('hidden');
          document.getElementById('onboarding-overlay')?.classList.add('hidden');
          document.getElementById('landing-page')?.classList.remove('hidden');
        } catch (err) {
          App.toast(err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });

    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div style="padding: var(--sp-8); text-align: center;">
          <i data-lucide="alert-triangle" style="color: var(--danger); width: 48px; height: 48px; margin-bottom: var(--sp-4);"></i>
          <h2 style="font-size: var(--text-xl); font-weight: 700; margin-bottom: var(--sp-2);">Erreur de connexion</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--sp-6);">Impossible de charger les données du profil depuis le serveur.</p>
          <button class="btn btn-primary" onclick="App.logout()">Retour à la connexion</button>
        </div>
      `;
      lucide.createIcons();
    }
  }

  return { render };
})();
