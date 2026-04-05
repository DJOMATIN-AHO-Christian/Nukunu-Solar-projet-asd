/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — DATA.JS
   Local cache, scoped persistence and API-backed dashboard state
═══════════════════════════════════════════════════════════ */

window.NukunuStore = window.NukunuStore || (() => {
  const AUTH_KEYS = [
    'nukunu_session',
    'nukunu_token',
    'nukunu_profile',
    'nukunu_user_role',
    'nukunu_user_id',
    'nukunu_user_name',
    'nukunu_user_email',
  ];

  function get(key) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue !== null) return sessionValue;
    return localStorage.getItem(key);
  }

  function set(key, value, persist = true) {
    const primary = persist ? localStorage : sessionStorage;
    const secondary = persist ? sessionStorage : localStorage;
    secondary.removeItem(key);
    if (value === null || value === undefined) {
      primary.removeItem(key);
      return;
    }
    primary.setItem(key, String(value));
  }

  function setAuthState(payload, remember = true) {
    clearAuth();
    localStorage.setItem('nukunu_remember_me', remember ? 'true' : 'false');
    Object.entries(payload).forEach(([key, value]) => set(key, value, remember));
  }

  function isRemembered() {
    return localStorage.getItem('nukunu_remember_me') !== 'false';
  }

  function remove(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  function clearAuth() {
    AUTH_KEYS.forEach(remove);
  }

  return { get, set, remove, clearAuth, setAuthState, isRemembered };
})();

const NukunuData = (() => {
  const STORAGE_KEYS = {
    tickets: 'nukunu_tickets',
    documents: 'nukunu_documents',
    prospects: 'nukunu_prospects',
    billing: 'nukunu_billing',
    settings: 'nukunu_settings',
  };
  const _syncWarnings = new Map();

  const BASE = {
    sites: {
      installateur: [
        { id:'S01', name:'Résidence Les Acacias', client:'Copropriété Les Acacias', location:'Lyon, 69', power:84, pr:91.2, status:'ok', production_day:310, alert:null, tech:'A. Martin' },
        { id:'S02', name:'Entrepôt Bricard', client:'Bricard Logistics', location:'Bordeaux, 33', power:250, pr:72.4, status:'critical', production_day:620, alert:'Onduleur SMA 3 hors ligne depuis 08h14', tech:'L. Dupont' },
        { id:'S03', name:'Lycée Jean Moulin', client:'Région Auvergne-RA', location:'Grenoble, 38', power:120, pr:86.5, status:'ok', production_day:441, alert:null, tech:'A. Martin' },
        { id:'S04', name:'Centre Commercial Lumina', client:'Lumina Group', location:'Toulouse, 31', power:480, pr:68.1, status:'warning', production_day:1150, alert:'Sous-performance string B7 détectée', tech:'M. Lefevre' },
        { id:'S05', name:'Camping Soleil d\'Azur', client:'Camping SARL', location:'Nice, 06', power:36, pr:94.1, status:'ok', production_day:130, alert:null, tech:'L. Dupont' },
        { id:'S06', name:'Mairie de Crolles', client:'Commune de Crolles', location:'Crolles, 38', power:60, pr:52.0, status:'critical', production_day:55, alert:'Panne totale – production nulle depuis 06h00', tech:'M. Lefevre' },
      ],
      fonds: [
        { id:'P01', name:'Parc Beauce Sud', location:'Beauce, 28', power:4200, pr:89.3, status:'ok', production_day:15120, revenue_ytd:824000 },
        { id:'P02', name:'Centrale Gascogne', location:'Gers, 32', power:8500, pr:91.8, status:'ok', production_day:31450, revenue_ytd:1960000 },
        { id:'P03', name:'Toitures Rhône', location:'Rhône, 69', power:1100, pr:77.2, status:'warning', production_day:3080, revenue_ytd:201000 },
        { id:'P04', name:'Ferme Solaire Narbonne', location:'Aude, 11', power:12000, pr:85.0, status:'ok', production_day:42000, revenue_ytd:3100000 },
        { id:'P05', name:'Parc Corse Énergie', location:'HCorse, 2B', power:2300, pr:62.5, status:'critical', production_day:3010, revenue_ytd:540000 },
      ],
      industriel: {
        name:'Usine Métallurgie Rhône',
        location:'Vénissieux, 69',
        power:840,
        pr:87.4,
        autoconso_pct:73,
        status:'ok',
        production_day:3082,
        autoconso_day:2250,
        injection_day:832,
        savings_day:495,
        savings_month:9870,
        revenue_injection_month:1460,
        bill_before:28400,
        bill_after:16900,
      },
      particulier: {
        name:'Résidence Dupuis',
        location:'Montpellier, 34',
        power:9,
        status:'ok',
        production_day:28.4,
        autoconso_day:19.1,
        injection_day:9.3,
        savings_day:4.18,
        savings_month:83.2,
        revenue_injection_month:11.4,
        battery_pct:72,
      }
    },

    alerts: {
      installateur: [
        { level:'critical', site:'Mairie de Crolles', msg:'Panne totale – production nulle depuis 06h00', time:'il y a 2h', id:'A01', siteId:'S06' },
        { level:'critical', site:'Entrepôt Bricard', msg:'Onduleur SMA-3 hors ligne – perte estimée 480 kWh/j', time:'il y a 5h', id:'A02', siteId:'S02' },
        { level:'warning',  site:'CC Lumina', msg:'Sous-performance string B7 : PR 68% vs attendu 85%', time:'il y a 1j', id:'A03', siteId:'S04' },
        { level:'warning',  site:'Résidence Les Acacias', msg:'Maintenance préventive recommandée sous 7 jours', time:'il y a 3j', id:'A04', siteId:'S01' },
      ],
      fonds: [
        { level:'critical', site:'Parc Corse Énergie', msg:'PR 62.5% – perte mensuelle estimée +28 000 €', time:'il y a 6h', id:'A11', siteId:'P05' },
        { level:'warning',  site:'Toitures Rhône', msg:'OPEX dépassement budget +14% sur 3 mois', time:'il y a 1j', id:'A12', siteId:'P03' },
      ],
      industriel: [],
      particulier: [],
    },

    tickets: [
      { id:'T-084', title:'Remplacement onduleur SMA-3', site:'Entrepôt Bricard', priority:'critical', status:'todo', tech:'L. Dupont',  created:'2026-03-24', due:'2026-03-25', cost_np:320, description:'Intervention urgente liée à une perte de production détectée sur l’onduleur principal.' },
      { id:'T-083', title:'Nettoyage panneaux – 3e trimestre', site:'Lycée Jean Moulin', priority:'normal', status:'todo', tech:'A. Martin', created:'2026-03-22', due:'2026-03-30', cost_np:0, description:'Opération préventive planifiée pour garantir le maintien du rendement nominal.' },
      { id:'T-082', title:'Diagnostic string B7', site:'CC Lumina', priority:'warning', status:'inprogress', tech:'M. Lefevre', created:'2026-03-21', due:'2026-03-26', cost_np:190, description:'Analyse en cours suite à une sous-performance persistante sur le string B7.' },
      { id:'T-081', title:'Vérification câblage DC', site:'Camping Soleil d\'Azur', priority:'normal', status:'inprogress', tech:'L. Dupont', created:'2026-03-18', due:'2026-03-27', cost_np:0, description:'Contrôle visuel et mesures électriques du câblage continu.' },
      { id:'T-080', title:'Panne totale – intervention urgente', site:'Mairie de Crolles', priority:'critical', status:'todo', tech:'M. Lefevre', created:'2026-03-24', due:'2026-03-24', cost_np:740, description:'Panne totale détectée, déplacement immédiat demandé.' },
      { id:'T-079', title:'Mise à jour firmware onduleur Fronius', site:'Résidence Les Acacias', priority:'normal', status:'done', tech:'A. Martin', created:'2026-03-15', due:'2026-03-15', cost_np:0, description:'Mise à jour réalisée et validée.' },
      { id:'T-078', title:'Contrôle annuel installation', site:'Lycée Jean Moulin', priority:'normal', status:'done', tech:'A. Martin', created:'2026-03-10', due:'2026-03-14', cost_np:0, description:'Inspection annuelle clôturée.' },
      { id:'T-077', title:'Remplacement disjoncteur AC', site:'Entrepôt Bricard', priority:'warning', status:'done', tech:'L. Dupont', created:'2026-03-08', due:'2026-03-09', cost_np:155, description:'Remplacement terminé, tests OK.' },
    ],

    documents: [
      { id:'DOC-001', name:'Attestation CONSUEL', site:'Entrepôt Bricard', date:'2024-06-10', expiry:null, status:'valid' },
      { id:'DOC-002', name:'Contrat de raccordement Enedis', site:'Entrepôt Bricard', date:'2024-06-14', expiry:null, status:'valid' },
      { id:'DOC-003', name:'Permis de construire', site:'CC Lumina', date:'2023-11-01', expiry:null, status:'valid' },
      { id:'DOC-004', name:'Déclaration ICPE', site:'CC Lumina', date:'2024-01-15', expiry:'2026-04-01', status:'warning' },
      { id:'DOC-005', name:'Attestation CONSUEL', site:'Mairie de Crolles', date:null, expiry:null, status:'missing' },
      { id:'DOC-006', name:'PV de mise en service', site:'Camping Soleil d\'Azur', date:'2025-05-20', expiry:null, status:'valid' },
      { id:'DOC-007', name:'Certificat CE onduleur', site:'Résidence Les Acacias', date:'2023-09-12', expiry:'2025-09-12', status:'expired' },
    ],

    prospects: [
      { id:'CRM-12', name:'Entrepôt Marcellin SA', contact:'P. Marcellin', power:320, value:98000, stage:'lead', lastContact:'2026-03-20' },
      { id:'CRM-13', name:'EHPAD Les Glycines', contact:'M. Bernard', power:60, value:22000, stage:'quote', lastContact:'2026-03-22' },
      { id:'CRM-14', name:'Lycée Vaucanson', contact:'Région ARA', power:150, value:54000, stage:'negotiation', lastContact:'2026-03-24' },
      { id:'CRM-15', name:'Supermarché Carrefour Meylan', contact:'J. Perrin', power:480, value:187000, stage:'signed', lastContact:'2026-03-18' },
      { id:'CRM-16', name:'Hôtel Mercure Grenoble', contact:'K. Durand', power:90, value:38000, stage:'lead', lastContact:'2026-03-19' },
      { id:'CRM-17', name:'Usine Soitec Bernin', contact:'DG Achats', power:1200, value:510000, stage:'negotiation', lastContact:'2026-03-23' },
    ],

    opexMonths: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
    opexValues: [1200,800,950,1100,700,1800,650,1200,950,1100,750,900],

    epexHours: Array.from({ length: 24 }, (_, i) => {
      const prices = [28,25,24,23,22,25,38,62,75,82,78,74,70,68,65,72,88,96,90,78,55,42,35,30];
      return { hour:i, price:prices[i] };
    }),

    warranties: [
      { name:'Panneaux REC Alpha (produit)', site:'Entrepôt Bricard', start:'2024-06-10', years:25, pct:4 },
      { name:'Panneaux REC Alpha (MO)', site:'Entrepôt Bricard', start:'2024-06-10', years:12, pct:8 },
      { name:'Onduleur SMA Sunny Tripower', site:'Entrepôt Bricard', start:'2024-06-10', years:10, pct:10 },
      { name:'Batterie LG Chem RESU', site:'CC Lumina', start:'2023-11-15', years:10, pct:23 },
      { name:'Panneaux Jinko Solar', site:'Lycée Jean Moulin', start:'2022-09-01', years:25, pct:14 },
      { name:'Onduleur Fronius Symo', site:'Lycée Jean Moulin', start:'2022-09-01', years:7, pct:50, warn:true },
    ],

    kpi: {
      installateur: {
        sites: 6, alerts_critical: 2, pr_avg: 77.6, production_month: 84200, revenue_month: 62400, next_interventions: 3,
      },
      fonds: {
        mw: 28.1, sites: 5, pr_avg: 81.2, production_ytd: 42800, revenue_ytd: 6625000, irr: 8.3, co2: 4820,
      },
      industriel: {
        autoconso_pct: 73, savings_ytd: 87400, injection_ytd: 10200, pr: 87.4, bill_reduction: 40.5,
      },
      particulier: {
        production_month: 312, savings_month: 83.2, injection_revenue: 11.4, battery_pct: 72,
      }
    },
  };

  const DASHBOARD_DEFAULT = {
    sites: BASE.sites,
    alerts: BASE.alerts,
    warranties: BASE.warranties,
    kpi: BASE.kpi,
    reporting: {
      monthly: {
        labels: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
        production: [1820,2100,3450,4800,5900,6400,6700,6100,4500,3200,2100,1600],
        revenue: [364,420,690,960,1180,1280,1340,1220,900,640,420,320],
      },
      opexMonths: BASE.opexMonths,
      opexValues: BASE.opexValues,
      esg: {
        installateur: { co2: '1 240', homes: '560', prod: '3 820' },
        fonds: { co2: '4 820', homes: '2 180', prod: '14 600' },
        industriel: { co2: '820', homes: '380', prod: '2 960' },
      },
      reports: {
        installateur: ['Rapport client mensuel PDF','Synthèse maintenance','Rapport de garantie de production'],
        fonds: ['Rapport investisseur P50/P90','Projection revenus 12 mois','Rapport SFDR','Export modèle Excel'],
        industriel: ['Rapport facturation interne','Justificatif décret tertiaire','Bilan carbone annuel'],
        particulier: ['Mon résumé mensuel','Attestation de production annuelle'],
      },
    },
    conformite: {
      deadlines: [
        {label:'Déclaration ICPE — CC Lumina',date:'01/04/2026',days:8,level:'red'},
        {label:'Renouvellement contrat raccordement — Parc Corse',date:'15/04/2026',days:22,level:'amber'},
        {label:'Audit énergétique obligatoire — Usine Rhône (Décret Tertiaire)',date:'30/06/2026',days:98,level:'green'},
      ],
      checklist: {
        installateur: [
          { item:'Attestation CONSUEL obtenue', done:true },
          { item:'Déclaration DAT déposée en mairie', done:true },
          { item:'Dossier CACSI Enedis complet', done:false },
          { item:'PV de mise en service signé', done:true },
          { item:'Contrat de raccordement signé', done:true },
        ],
        fonds: [
          { item:'Due diligence technique — Parc Corse', done:false },
          { item:'Rapport SFDR Q1 2026 disponible', done:true },
          { item:'Taxonomie verte UE — rapport annuel', done:true },
          { item:'Audit réglementaire — Beauce Sud', done:true },
        ],
        industriel: [
          { item:'Déclaration Décret Tertiaire 2025 validée', done:true },
          { item:'Bilan carbone DPE actualisé', done:false },
          { item:'Audit énergétique obligatoire planifié', done:false },
          { item:'DPEF intégrée dans rapport annuel', done:true },
        ],
        particulier: [
          { item:'Installation déclarée à la mairie', done:true },
          { item:'Attestation CONSUEL reçue', done:true },
          { item:'Contrat CACSI Enedis signé', done:true },
          { item:'Formulaire 2042 C PRO préparé', done:false },
        ],
      },
    },
    optimisation: {
      epexHours: BASE.epexHours,
      batteryConfig: {
        particulier: { pct: BASE.sites.particulier.battery_pct, capacity: 10, nextCharge: '22h00 → 06h00' },
        industriel: { pct: 68, capacity: 320, nextCharge: '01h00 → 05h00' },
        installateur: { pct: 64, capacity: 80, nextCharge: '23h00 → 04h00' },
        fonds: { pct: 71, capacity: 2400, nextCharge: '00h00 → 06h00' },
      },
      gainMonthly: { fonds: 48200, industriel: 2400, installateur: 124, particulier: 124 },
      forecast: { fonds: '42.8 MWh', industriel: '3.1 MWh', installateur: '28.6 kWh', particulier: '28.6 kWh' },
      flex: {
        fonds: [['FCR (Freq. Contain. Reserve)','Actif','42 €/MWh','zap','green'], ['aFRR Secondaire','Disponible','38 €/MW/h','activity','blue'], ['Marché de capacité','Enchère (Avr)','12 €/kW/an','euro','amber']],
        industriel: [['Effacement HPE (Pointe)','Actif','−18% TURPE','zap','green'], ['Délestage programmé','Planifié','Jeudi 18h–20h','calendar','amber'], ['Prime de flexibilité','En cours','2 840 €/an','trending-up','amber']],
        installateur: [['Effacement HPE (Pointe)','Actif','−18% TURPE','zap','green'], ['Délestage programmé','Planifié','Jeudi 18h–20h','calendar','amber'], ['Prime de flexibilité','En cours','2 840 €/an','trending-up','amber']],
      },
    },
  };

  function _notifySyncIssue(domain) {
    const now = Date.now();
    const last = _syncWarnings.get(domain) || 0;
    if (now - last < 6000) return;
    _syncWarnings.set(domain, now);
    if (typeof App !== 'undefined' && typeof App.toast === 'function') {
      App.toast(`API indisponible pour ${domain}, mode local temporaire activé.`, 'warning', 4500);
    }
  }

  function _priorityRank(level) {
    return { critical: 0, expired: 1, warning: 2, info: 3, ok: 4 }[level] ?? 5;
  }

  function _parseDate(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function _clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function _readState(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : _clone(fallback);
    } catch (err) {
      return _clone(fallback);
    }
  }

  function _writeState(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function _api(path, options = {}) {
    const token = window.NukunuStore.get('nukunu_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${App.getApiBase()}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erreur API');
    return data;
  }

  function _today() {
    return new Date().toISOString().slice(0, 10);
  }

  function _nextId(prefix, list) {
    const numbers = list
      .map(item => Number(String(item.id || '').replace(/\D/g, '')))
      .filter(Number.isFinite);
    const max = numbers.length ? Math.max(...numbers) : 0;
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  }

  function _scope() {
    return window.NukunuStore.get('nukunu_user_email') || window.NukunuStore.get('nukunu_user_id') || 'anonymous';
  }

  function _scopedKey(key) {
    return `${key}_${_scope()}`;
  }

  function _getStateSlice(key, fallback) {
    return _readState(_scopedKey(key), fallback);
  }

  function _setStateSlice(key, value) {
    _writeState(_scopedKey(key), value);
  }

  function _getSettingsState() {
    return _getStateSlice(STORAGE_KEYS.settings, {});
  }

  function _setSettingsState(value) {
    _setStateSlice(STORAGE_KEYS.settings, value);
  }

  function clearLocalCache() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(_scopedKey(key));
      sessionStorage.removeItem(_scopedKey(key));
    });
    _syncWarnings.clear();
  }

  function getDashboardData() {
    return getSetting('dashboard_data', DASHBOARD_DEFAULT);
  }

  async function refreshDashboardData() {
    return refreshSetting('dashboard_data', DASHBOARD_DEFAULT);
  }

  function getSetting(key, fallback = {}) {
    const state = _getSettingsState();
    return _clone(state[key] ?? fallback);
  }

  async function refreshSetting(key, fallback = {}) {
    try {
      const data = await _api(`/api/settings/${key}`);
      const state = _getSettingsState();
      state[key] = data.payload || fallback;
      _setSettingsState(state);
      return getSetting(key, fallback);
    } catch (error) {
      _notifySyncIssue(`configuration (${key})`);
      return getSetting(key, fallback);
    }
  }

  async function saveSetting(key, payload) {
    try {
      const data = await _api(`/api/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ payload }),
      });
      const state = _getSettingsState();
      state[key] = data.payload || payload;
      _setSettingsState(state);
      return getSetting(key, payload);
    } catch (error) {
      _notifySyncIssue(`configuration (${key})`);
      const state = _getSettingsState();
      state[key] = payload;
      _setSettingsState(state);
      return getSetting(key, payload);
    }
  }

  function getTickets() {
    return _clone(_getStateSlice(STORAGE_KEYS.tickets, BASE.tickets));
  }

  function getTicket(id) {
    return _clone(getTickets().find(ticket => ticket.id === id) || null);
  }

  function createTicket(payload) {
    const tickets = getTickets();
    const site = payload.site || 'Site non précisé';
    const priority = payload.priority || 'normal';
    const item = {
      id: _nextId('T-', tickets),
      title: payload.title || payload.type || 'Intervention',
      site,
      priority,
      status: 'todo',
      tech: payload.tech || 'Technicien à définir',
      created: _today(),
      due: payload.due || _today(),
      cost_np: Number(payload.cost_np || 0),
      description: payload.description || 'Ticket créé depuis l’interface Nukunu Solar.',
      type: payload.type || 'Correctif',
      sla: Number(payload.sla || 24),
    };
    _setStateSlice(STORAGE_KEYS.tickets, [item, ...tickets]);
    return _clone(item);
  }

  function updateTicketStatus(id, status) {
    const tickets = getTickets();
    let updated = null;
    const nextTickets = tickets.map(ticket => {
      if (ticket.id !== id) return ticket;
      updated = { ...ticket, status };
      return updated;
    });
    _setStateSlice(STORAGE_KEYS.tickets, nextTickets);
    return _clone(updated);
  }

  function assignTicket(id, tech) {
    const tickets = getTickets();
    let updated = null;
    const nextTickets = tickets.map(ticket => {
      if (ticket.id !== id) return ticket;
      updated = { ...ticket, tech };
      return updated;
    });
    _setStateSlice(STORAGE_KEYS.tickets, nextTickets);
    return _clone(updated);
  }

  function getDocuments() {
    return _clone(_getStateSlice(STORAGE_KEYS.documents, BASE.documents));
  }

  function addDocument(payload) {
    const documents = getDocuments();
    const item = {
      id: _nextId('DOC-', documents),
      name: payload.name || 'Document',
      site: payload.site || 'Site non précisé',
      date: payload.date || _today(),
      expiry: payload.expiry || null,
      file_name: payload.file_name || null,
      file_mime_type: payload.file_mime_type || null,
      file_content: payload.file_content || null,
      has_file: Boolean(payload.file_content),
      status: payload.status || 'valid',
    };
    _setStateSlice(STORAGE_KEYS.documents, [item, ...documents]);
    return _clone(item);
  }

  function markDocumentUploaded(name, site, payload = {}) {
    const documents = getDocuments();
    let updated = null;
    const nextDocuments = documents.map(document => {
      if (document.name !== name || document.site !== site) return document;
      updated = {
        ...document,
        date: _today(),
        status: 'valid',
        file_name: payload.file_name || document.file_name || null,
        file_mime_type: payload.file_mime_type || document.file_mime_type || null,
        file_content: payload.file_content || document.file_content || null,
        has_file: Boolean(payload.file_content || document.file_content),
      };
      return updated;
    });
    if (updated) _setStateSlice(STORAGE_KEYS.documents, nextDocuments);
    return _clone(updated);
  }

  function getProspects() {
    return _clone(_getStateSlice(STORAGE_KEYS.prospects, BASE.prospects));
  }

  function createProspect(payload) {
    const prospects = getProspects();
    const item = {
      id: _nextId('CRM-', prospects),
      name: payload.name || 'Nouveau prospect',
      contact: payload.contact || 'Contact à définir',
      power: Number(payload.power || 0),
      value: Number(payload.value || 0),
      stage: payload.stage || 'lead',
      lastContact: _today(),
    };
    _setStateSlice(STORAGE_KEYS.prospects, [item, ...prospects]);
    return _clone(item);
  }

  function updateProspectStage(id, stage) {
    const prospects = getProspects();
    let updated = null;
    const nextProspects = prospects.map(prospect => {
      if (prospect.id !== id) return prospect;
      updated = { ...prospect, stage, lastContact: _today() };
      return updated;
    });
    _setStateSlice(STORAGE_KEYS.prospects, nextProspects);
    return _clone(updated);
  }

  function touchProspect(id) {
    const prospects = getProspects();
    let updated = null;
    const nextProspects = prospects.map(prospect => {
      if (prospect.id !== id) return prospect;
      updated = { ...prospect, lastContact: _today() };
      return updated;
    });
    _setStateSlice(STORAGE_KEYS.prospects, nextProspects);
    return _clone(updated);
  }

  function findAlert(alertId) {
    const allAlerts = Object.values(getDashboardData().alerts || {}).flat();
    return _clone(allAlerts.find(alert => alert.id === alertId) || null);
  }

  function getBillingEntries() {
    const fallback = Profile.get() === 'fonds'
      ? BASE.sites.fonds.map((site, index) => {
          const contracts = ['OA EDF', 'PPA Prive', 'Complement CRE', 'OA EDF', 'PPA Prive', 'Marche spot'];
          const tariffs = [0.1269, 0.085, 0.092, 0.1269, 0.078, 0.101];
          const labels = ['0.1269', '0.0850', '0.0920', '0.1269', '0.0780', 'Spot EPEX (moy. 0.1010)'];
          const energy = Math.round(site.production_day * 22);
          return {
            id: `BIL-${String(index + 1).padStart(3, '0')}`,
            site: site.name,
            contract: contracts[index] || 'OA EDF',
            period: 'Mars 2026',
            energy_kwh: energy,
            tariff_label: labels[index] || '0.1269',
            tariff_rate: tariffs[index] || 0.1,
            gross_revenue: Math.round(energy * (tariffs[index] || 0.1)),
            notes: '',
            payment_status: 'paid',
          };
        })
      : Profile.get() === 'installateur'
        ? BASE.sites.installateur.map((site, index) => {
            const contracts = ['OA EDF', 'PPA Prive', 'Complement CRE', 'OA EDF', 'PPA Prive', 'Marche spot'];
            const tariffs = [0.1269, 0.085, 0.092, 0.1269, 0.078, 0.101];
            const labels = ['0.1269', '0.0850', '0.0920', '0.1269', '0.0780', 'Spot EPEX (moy. 0.1010)'];
            const energy = Math.round(site.production_day * 22);
            return {
              id: `BIL-${String(index + 1).padStart(3, '0')}`,
              site: site.name,
              contract: contracts[index] || 'OA EDF',
              period: 'Mars 2026',
              energy_kwh: energy,
              tariff_label: labels[index] || '0.1269',
              tariff_rate: tariffs[index] || 0.1,
              gross_revenue: Math.round(energy * (tariffs[index] || 0.1)),
              notes: '',
              payment_status: 'paid',
            };
          })
        : [
            {
              id: 'BIL-001',
              site: Profile.get() === 'industriel' ? BASE.sites.industriel.name : BASE.sites.particulier.name,
              contract: Profile.get() === 'industriel' ? 'Autoconsommation + injection' : 'EDF OA',
              period: 'Mars 2026',
              energy_kwh: Profile.get() === 'industriel' ? 92460 : 312,
              tariff_label: Profile.get() === 'industriel' ? 'Mix' : '0.1269',
              tariff_rate: Profile.get() === 'industriel' ? 0.118 : 0.1269,
              gross_revenue: Profile.get() === 'industriel' ? 10910 : 11.4,
              notes: '',
              payment_status: 'paid',
            },
          ];
    return _clone(_getStateSlice(STORAGE_KEYS.billing, fallback));
  }

  async function refreshTickets() {
    try {
      const data = await _api('/api/tickets');
      _setStateSlice(STORAGE_KEYS.tickets, data.tickets || []);
      return getTickets();
    } catch (error) {
      _notifySyncIssue('tickets');
      return getTickets();
    }
  }

  async function createTicketRemote(payload) {
    try {
      const data = await _api('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshTickets();
      return data.ticket;
    } catch (error) {
      _notifySyncIssue('tickets');
      return createTicket(payload);
    }
  }

  async function updateTicketStatusRemote(id, status) {
    try {
      const data = await _api(`/api/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refreshTickets();
      return data.ticket;
    } catch (error) {
      _notifySyncIssue('tickets');
      return updateTicketStatus(id, status);
    }
  }

  async function refreshDocuments() {
    try {
      const data = await _api('/api/documents');
      _setStateSlice(STORAGE_KEYS.documents, data.documents || []);
      return getDocuments();
    } catch (error) {
      _notifySyncIssue('documents');
      return getDocuments();
    }
  }

  async function addDocumentRemote(payload) {
    try {
      const data = await _api('/api/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshDocuments();
      return data.document;
    } catch (error) {
      _notifySyncIssue('documents');
      return addDocument(payload);
    }
  }

  async function markDocumentUploadedRemote(name, site, payload = {}) {
    try {
      const data = await _api('/api/documents/upload', {
        method: 'PATCH',
        body: JSON.stringify({ name, site, ...payload }),
      });
      await refreshDocuments();
      return data.document;
    } catch (error) {
      _notifySyncIssue('documents');
      return markDocumentUploaded(name, site, payload);
    }
  }

  async function refreshProspects() {
    try {
      const data = await _api('/api/prospects');
      _setStateSlice(STORAGE_KEYS.prospects, data.prospects || []);
      return getProspects();
    } catch (error) {
      _notifySyncIssue('prospects');
      return getProspects();
    }
  }

  async function createProspectRemote(payload) {
    try {
      const data = await _api('/api/prospects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshProspects();
      return data.prospect;
    } catch (error) {
      _notifySyncIssue('prospects');
      return createProspect(payload);
    }
  }

  async function updateProspectRemote(id, payload) {
    try {
      const data = await _api(`/api/prospects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refreshProspects();
      return data.prospect;
    } catch (error) {
      _notifySyncIssue('prospects');
      if (payload.stage) return updateProspectStage(id, payload.stage);
      if (payload.touch) return touchProspect(id);
      return null;
    }
  }

  async function refreshBilling() {
    try {
      const data = await _api('/api/billing');
      _setStateSlice(STORAGE_KEYS.billing, data.entries || []);
      return getBillingEntries();
    } catch (error) {
      _notifySyncIssue('facturation');
      return getBillingEntries();
    }
  }

  async function createBillingContract(payload) {
    try {
      const data = await _api('/api/billing/contracts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await refreshBilling();
      return data.entry;
    } catch (error) {
      _notifySyncIssue('facturation');
      const entries = getBillingEntries();
      const entry = {
        id: _nextId('BIL-', entries),
        site: payload.site || 'Nouveau site',
        contract: payload.contractName || 'Nouveau contrat',
        period: 'Mars 2026',
        energy_kwh: 0,
        tariff_label: 'A definir',
        tariff_rate: 0,
        gross_revenue: 0,
        notes: payload.notes || '',
        payment_status: 'draft',
      };
      _setStateSlice(STORAGE_KEYS.billing, [entry, ...entries]);
      return entry;
    }
  }

  function allSiteOptions() {
    const dashboard = getDashboardData();
    return [
      ...(dashboard.sites.installateur || []).map(site => ({ id: site.id, name: site.name })),
      ...(dashboard.sites.fonds || []).map(site => ({ id: site.id, name: site.name })),
      { id: 'IND-001', name: dashboard.sites.industriel.name },
      { id: 'RES-001', name: dashboard.sites.particulier.name },
    ];
  }

  function productionChart(profile) {
    const h = Array.from({ length: 13 }, (_, i) => i + 6).map(hour => `${hour}h`);
    if (profile === 'particulier') {
      return {
        labels: h,
        actual: [0,0.2,0.9,1.8,2.6,3.1,3.4,3.2,2.7,2.0,1.1,0.4,0.1],
        theory: [0,0.3,1.0,2.0,2.8,3.2,3.5,3.3,2.9,2.1,1.2,0.5,0.2],
      };
    }
    return {
      labels: h,
      actual: h.map((_, i) => [0,25,110,210,380,470,510,490,420,330,200,90,20][i]),
      theory: h.map((_, i) => [0,30,120,220,400,490,530,510,440,350,210,100,25][i]),
    };
  }

  function monthlyData() {
    const reporting = getDashboardData().reporting || {};
    return _clone(reporting.monthly || DASHBOARD_DEFAULT.reporting.monthly);
  }

  function getLandingMetrics() {
    const dashboard = getDashboardData();
    const fondsKpi = dashboard.kpi?.fonds || {};
    const installateurKpi = dashboard.kpi?.installateur || {};
    const tickets = getTickets();
    const allAlerts = Object.values(dashboard.alerts || {}).flat();
    return {
      assetsMw: fondsKpi.mw || 0,
      prAvg: fondsKpi.pr_avg || installateurKpi.pr_avg || 0,
      revenueYtd: fondsKpi.revenue_ytd || 0,
      openTickets: tickets.filter(ticket => ticket.status !== 'done').length,
      criticalAlerts: allAlerts.filter(alert => alert.level === 'critical').length,
    };
  }

  function _getNotificationState() {
    return getSetting('notification_state', { readIds: [], dismissedIds: [] });
  }

  function _getActivityLog() {
    return getSetting('activity_log', []);
  }

  function getNotifications() {
    const profile = Profile.get() || window.NukunuStore.get('nukunu_user_role') || 'installateur';
    const notificationState = _getNotificationState();
    const alertSettings = getSetting('monitoring_alerts', { warning: 'daily_digest', critical: 'immediate' });
    const notifications = [];
    const dashboardAlerts = getDashboardData().alerts || DASHBOARD_DEFAULT.alerts;

    (dashboardAlerts[profile] || []).forEach(alert => {
      if (alert.level === 'warning' && alertSettings.warning === 'disabled') return;
      notifications.push({
        id: `alert:${alert.id}`,
        title: alert.site,
        message: alert.msg,
        module: 'monitoring',
        level: alert.level,
        actionLabel: alert.level === 'critical' ? 'Créer un ticket' : 'Voir le monitoring',
        actionValue: alert.id,
        actionKind: alert.level === 'critical' ? 'ticket' : 'module',
        createdAt: _parseDate(),
      });
    });

    getDocuments()
      .filter(document => ['missing', 'expired', 'warning'].includes(document.status))
      .forEach(document => {
        notifications.push({
          id: `document:${document.id}`,
          title: document.name,
          message: `${document.site} · ${document.status === 'missing' ? 'document manquant' : document.status === 'expired' ? 'document expiré' : 'document à renouveler'}`,
          module: 'conformite',
          level: document.status === 'expired' || document.status === 'missing' ? 'critical' : 'warning',
          actionLabel: document.status === 'missing' ? 'Ajouter le fichier' : 'Ouvrir la conformité',
          actionKind: 'module',
          actionValue: 'conformite',
          createdAt: _parseDate(document.expiry || document.date),
        });
      });

    getTickets()
      .filter(ticket => ticket.status !== 'done')
      .forEach(ticket => {
        notifications.push({
          id: `ticket:${ticket.id}`,
          title: ticket.title,
          message: `${ticket.site} · ${ticket.tech || 'Technicien non assigné'} · échéance ${ticket.due || 'non définie'}`,
          module: 'maintenance',
          level: ticket.priority === 'critical' ? 'critical' : ticket.priority === 'warning' ? 'warning' : 'info',
          actionLabel: 'Ouvrir le ticket',
          actionKind: 'module',
          actionValue: 'maintenance',
          createdAt: _parseDate(ticket.due || ticket.created),
        });
      });

    getBillingEntries()
      .filter(entry => entry.payment_status === 'draft')
      .forEach(entry => {
        notifications.push({
          id: `billing:${entry.id}`,
          title: entry.site,
          message: `Contrat brouillon à finaliser (${entry.contract || 'Contrat'})`,
          module: 'facturation',
          level: 'warning',
          actionLabel: 'Finaliser le contrat',
          actionKind: 'module',
          actionValue: 'facturation',
          createdAt: _parseDate(),
        });
      });

    if (Profile.getConfig(profile)?.modules?.includes('vente')) {
      getProspects()
        .filter(prospect => {
          const lastContact = _parseDate(prospect.lastContact);
          return (Date.now() - lastContact.getTime()) / 86400000 >= 5;
        })
        .forEach(prospect => {
          notifications.push({
            id: `prospect:${prospect.id}`,
            title: prospect.name,
            message: `Aucune relance depuis le ${prospect.lastContact || '—'}`,
            module: 'vente',
            level: 'info',
            actionLabel: 'Relancer le prospect',
            actionKind: 'prospect',
            actionValue: prospect.id,
            createdAt: _parseDate(prospect.lastContact),
          });
        });
    }

    _getActivityLog().forEach(item => {
      notifications.push({
        id: item.id,
        title: item.title,
        message: item.message,
        module: item.module || 'reporting',
        level: item.level || 'info',
        actionLabel: item.actionLabel || 'Ouvrir',
        actionKind: 'module',
        actionValue: item.module || 'reporting',
        createdAt: _parseDate(item.createdAt),
      });
    });

    return notifications
      .filter(notification => !notificationState.dismissedIds.includes(notification.id))
      .map(notification => ({ ...notification, read: notificationState.readIds.includes(notification.id) }))
      .sort((left, right) => {
        const rankDiff = _priorityRank(left.level) - _priorityRank(right.level);
        if (rankDiff !== 0) return rankDiff;
        return _parseDate(right.createdAt).getTime() - _parseDate(left.createdAt).getTime();
      });
  }

  function getNotificationSummary() {
    const notifications = getNotifications();
    return {
      total: notifications.length,
      unread: notifications.filter(notification => !notification.read).length,
      critical: notifications.filter(notification => !notification.read && notification.level === 'critical').length,
    };
  }

  async function markNotificationRead(id) {
    const state = _getNotificationState();
    if (!state.readIds.includes(id)) state.readIds.push(id);
    return saveSetting('notification_state', state);
  }

  async function dismissNotification(id) {
    const state = _getNotificationState();
    if (!state.dismissedIds.includes(id)) state.dismissedIds.push(id);
    if (!state.readIds.includes(id)) state.readIds.push(id);
    return saveSetting('notification_state', state);
  }

  async function markAllNotificationsRead() {
    const state = _getNotificationState();
    const ids = getNotifications().map(notification => notification.id);
    state.readIds = Array.from(new Set([...(state.readIds || []), ...ids]));
    return saveSetting('notification_state', state);
  }

  async function logActivity(entry) {
    const items = _getActivityLog();
    const next = [
      {
        id: `activity:${Date.now()}`,
        createdAt: new Date().toISOString(),
        level: 'info',
        ...entry,
      },
      ...items,
    ].slice(0, 25);
    return saveSetting('activity_log', next);
  }

  return {
    get sites() { return getDashboardData().sites || DASHBOARD_DEFAULT.sites; },
    get alerts() { return getDashboardData().alerts || DASHBOARD_DEFAULT.alerts; },
    get epexHours() { return (getDashboardData().optimisation || {}).epexHours || DASHBOARD_DEFAULT.optimisation.epexHours; },
    get warranties() { return getDashboardData().warranties || DASHBOARD_DEFAULT.warranties; },
    get kpi() { return getDashboardData().kpi || DASHBOARD_DEFAULT.kpi; },
    get opexMonths() { return (getDashboardData().reporting || {}).opexMonths || DASHBOARD_DEFAULT.reporting.opexMonths; },
    get opexValues() { return (getDashboardData().reporting || {}).opexValues || DASHBOARD_DEFAULT.reporting.opexValues; },
    get reportingData() { return getDashboardData().reporting || DASHBOARD_DEFAULT.reporting; },
    get conformiteData() { return getDashboardData().conformite || DASHBOARD_DEFAULT.conformite; },
    get optimisationData() { return getDashboardData().optimisation || DASHBOARD_DEFAULT.optimisation; },
    productionChart,
    monthlyData,
    getTickets,
    getTicket,
    createTicket,
    updateTicketStatus,
    assignTicket,
    getDocuments,
    addDocument,
    markDocumentUploaded,
    getProspects,
    createProspect,
    updateProspectStage,
    touchProspect,
    getBillingEntries,
    getLandingMetrics,
    getNotifications,
    getNotificationSummary,
    clearLocalCache,
    markNotificationRead,
    dismissNotification,
    markAllNotificationsRead,
    logActivity,
    refreshTickets,
    createTicketRemote,
    updateTicketStatusRemote,
    refreshDocuments,
    addDocumentRemote,
    markDocumentUploadedRemote,
    refreshProspects,
    createProspectRemote,
    updateProspectRemote,
    refreshBilling,
    createBillingContract,
    getSetting,
    refreshSetting,
    saveSetting,
    getDashboardData,
    refreshDashboardData,
    findAlert,
    allSiteOptions,
  };
})();
