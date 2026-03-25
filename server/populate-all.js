const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'nukunu_admin',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'nukunu_solar',
  password: process.env.DB_PASSWORD || 'nukunu_password',
  port: Number(process.env.DB_PORT || 5433),
});

async function ensureDomainData(userId, role) {
  const uid = String(userId).padStart(3, '0');

  // Insert relational data directly without checking counts (we will wipe existing first)
  const defaultsTickets = {
    installateur: [
      [`Mairie de Crolles (${uid})`, 'S06', 'Correctif urgent', 'Panne totale – intervention urgente', 'Panne totale détectée, déplacement immédiat demandé.', 'critical', 'todo', 'M. Lefevre', '2026-03-24', 740, 4],
      [`Entrepôt Bricard (${uid})`, 'S02', 'Correctif urgent', 'Remplacement onduleur SMA-3', 'Intervention urgente liée à une perte de production détectée sur l’onduleur principal.', 'critical', 'todo', 'L. Dupont', '2026-03-25', 320, 24],
    ],
    fonds: [
      [`Parc Corse Énergie (${uid})`, 'P05', 'Audit', 'Revue OPEX trimestrielle', 'Analyse des dérives d’exploitation et arbitrage budgétaire.', 'warning', 'inprogress', 'A. Martin', '2026-03-29', 0, 48],
    ],
    industriel: [
      [`Usine Métallurgie Rhône (${uid})`, 'IND-001', 'Préventif', 'Visite préventive trimestrielle', 'Inspection planifiée du site industriel.', 'normal', 'todo', 'A. Martin', '2026-03-31', 0, 72],
    ],
    particulier: [
      [`Résidence Dupuis (${uid})`, 'RES-001', 'Préventif', 'Contrôle annuel installation', 'Vérification annuelle de l’installation résidentielle.', 'normal', 'todo', 'L. Dupont', '2026-04-05', 0, 72],
    ],
  }[role] || [];
  
  for (const item of defaultsTickets) {
    await pool.query(
      `INSERT INTO tickets (user_id, site_name, site_code, type, title, description, priority, status, tech, due_date, cost_np, sla_hours) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [userId, ...item]
    );
  }

  const defaultsDocs = {
    installateur: [
      ['Attestation CONSUEL', `Entrepôt Bricard (${uid})`, '2024-06-10', null, 'valid'],
      ['Déclaration ICPE', `CC Lumina (${uid})`, '2024-01-15', '2026-04-01', 'warning'],
      ['Attestation CONSUEL', `Mairie de Crolles (${uid})`, null, null, 'missing'],
    ],
    fonds: [
      ['Rapport SFDR Q1', `Parc Beauce Sud (${uid})`, '2026-03-15', null, 'valid'],
      ['Due diligence technique', `Parc Corse Énergie (${uid})`, null, null, 'missing'],
    ],
    industriel: [
      ['Audit énergétique', `Usine Métallurgie Rhône (${uid})`, null, '2026-06-30', 'warning'],
    ],
    particulier: [
      ['Attestation annuelle de production', `Résidence Dupuis (${uid})`, '2026-01-05', null, 'valid'],
    ],
  }[role] || [];
  
  for (const item of defaultsDocs) {
    await pool.query(
      `INSERT INTO documents (user_id, name, site_name, document_date, expiry_date, status) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, ...item]
    );
  }

  const defaultsProspects = {
    installateur: [
      [`Entrepôt Marcellin SA (${uid})`, 'P. Marcellin', 320, 98000, 'lead', '2026-03-20'],
      [`EHPAD Les Glycines (${uid})`, 'M. Bernard', 60, 22000, 'quote', '2026-03-22'],
    ],
    fonds: [
      [`Portefeuille Occitanie (${uid})`, 'Direction Invest', 5200, 1800000, 'negotiation', '2026-03-24'],
    ],
    industriel: [
      [`Extension toiture logistique (${uid})`, 'Resp. Achats', 180, 64000, 'lead', '2026-03-21'],
    ],
    particulier: [
      [`Maison témoin solaire (${uid})`, 'Mme Durand', 9, 14500, 'quote', '2026-03-23'],
    ],
  }[role] || [];
  
  for (const item of defaultsProspects) {
    await pool.query(
      `INSERT INTO prospects (user_id, name, contact, power_kwc, value_eur, stage, last_contact) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, ...item]
    );
  }

  const defaultsBilling = {
    installateur: [
      [`Entrepôt Bricard (${uid})`, 'OA EDF', 'Mars 2026', 13640, 'OA EDF', 0.1269, 1731, 'paid'],
      [`CC Lumina (${uid})`, 'PPA Privé', 'Mars 2026', 25300, 'PPA Privé', 0.078, 1973, 'paid'],
    ],
    fonds: [
      [`Parc Beauce Sud (${uid})`, 'OA EDF', 'Mars 2026', 332640, 'OA EDF', 0.1269, 42242, 'paid'],
      [`Centrale Gascogne (${uid})`, 'PPA Privé', 'Mars 2026', 691900, 'PPA Privé', 0.085, 58812, 'paid'],
    ],
    industriel: [
      [`Usine Métallurgie Rhône (${uid})`, 'Autoconsommation + injection', 'Mars 2026', 92460, 'Mix', 0.118, 10910, 'paid'],
    ],
    particulier: [
      [`Résidence Dupuis (${uid})`, 'EDF OA', 'Mars 2026', 312, 'EDF OA', 0.1269, 11.4, 'paid'],
    ],
  };
  
  for (const item of (defaultsBilling[role] || [])) {
    await pool.query(
      `INSERT INTO billing_entries (user_id, site_name, contract_name, period_label, energy_kwh, tariff_label, tariff_rate, gross_revenue, payment_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, ...item]
    );
  }

  const allSites = {
    installateur: [
      { id: 'S01', name: `Résidence Les Acacias (${uid})`, client: 'Copropriété Les Acacias', location: 'Lyon, 69', power: 84, pr: 91.2, status: 'ok', production_day: 310, alert: null, tech: 'A. Martin' },
      { id: 'S02', name: `Entrepôt Bricard (${uid})`, client: 'Bricard Logistics', location: 'Bordeaux, 33', power: 250, pr: 72.4, status: 'critical', production_day: 620, alert: 'Onduleur SMA 3 hors ligne depuis 08h14', tech: 'L. Dupont' },
      { id: 'S03', name: `Lycée Jean Moulin (${uid})`, client: 'Région Auvergne-RA', location: 'Grenoble, 38', power: 120, pr: 86.5, status: 'ok', production_day: 441, alert: null, tech: 'A. Martin' },
      { id: 'S04', name: `Centre Commercial Lumina (${uid})`, client: 'Lumina Group', location: 'Toulouse, 31', power: 480, pr: 68.1, status: 'warning', production_day: 1150, alert: 'Sous-performance string B7 détectée', tech: 'M. Lefevre' },
      { id: 'S05', name: `Camping Soleil d'Azur (${uid})`, client: 'Camping SARL', location: 'Nice, 06', power: 36, pr: 94.1, status: 'ok', production_day: 130, alert: null, tech: 'L. Dupont' },
      { id: 'S06', name: `Mairie de Crolles (${uid})`, client: 'Commune de Crolles', location: 'Crolles, 38', power: 60, pr: 52.0, status: 'critical', production_day: 55, alert: 'Panne totale – production nulle depuis 06h00', tech: 'M. Lefevre' },
    ],
    fonds: [
      { id: 'P01', name: `Parc Beauce Sud (${uid})`, location: 'Beauce, 28', power: 4200, pr: 89.3, status: 'ok', production_day: 15120, revenue_ytd: 824000 },
      { id: 'P02', name: `Centrale Gascogne (${uid})`, location: 'Gers, 32', power: 8500, pr: 91.8, status: 'ok', production_day: 31450, revenue_ytd: 1960000 },
      { id: 'P03', name: `Toitures Rhône (${uid})`, location: 'Rhône, 69', power: 1100, pr: 77.2, status: 'warning', production_day: 3080, revenue_ytd: 201000 },
      { id: 'P04', name: `Ferme Solaire Narbonne (${uid})`, location: 'Aude, 11', power: 12000, pr: 85.0, status: 'ok', production_day: 42000, revenue_ytd: 3100000 },
      { id: 'P05', name: `Parc Corse Énergie (${uid})`, location: 'HCorse, 2B', power: 2300, pr: 62.5, status: 'critical', production_day: 3010, revenue_ytd: 540000 },
    ],
    industriel: [
      { id: 'IND-001', name: `Usine Métallurgie Rhône (${uid})`, location: 'Vénissieux, 69', power: 840, pr: 87.4, autoconso_pct: 73, status: 'ok', production_day: 3082, autoconso_day: 2250, injection_day: 832, savings_day: 495, savings_month: 9870, revenue_injection_month: 1460, bill_before: 28400, bill_after: 16900 }
    ],
    particulier: [
      { id: 'RES-001', name: `Résidence Dupuis (${uid})`, location: 'Montpellier, 34', power: 9, status: 'ok', production_day: 28.4, autoconso_day: 19.1, injection_day: 9.3, savings_day: 4.18, savings_month: 83.2, revenue_injection_month: 11.4, battery_pct: 72 }
    ]
  };

  const allAlerts = {
    installateur: [
      { level: 'critical', site: `Mairie de Crolles (${uid})`, msg: 'Panne totale – production nulle depuis 06h00', time: 'il y a 2h', id: 'A01', siteId: 'S06' },
      { level: 'critical', site: `Entrepôt Bricard (${uid})`, msg: 'Onduleur SMA-3 hors ligne – perte estimée 480 kWh/j', time: 'il y a 5h', id: 'A02', siteId: 'S02' },
      { level: 'warning', site: `CC Lumina (${uid})`, msg: 'Sous-performance string B7 : PR 68% vs attendu 85%', time: 'il y a 1j', id: 'A03', siteId: 'S04' },
      { level: 'warning', site: `Résidence Les Acacias (${uid})`, msg: 'Maintenance préventive recommandée sous 7 jours', time: 'il y a 3j', id: 'A04', siteId: 'S01' },
    ],
    fonds: [
      { level: 'critical', site: `Parc Corse Énergie (${uid})`, msg: 'PR 62.5% – perte mensuelle estimée +28 000 €', time: 'il y a 6h', id: 'A11', siteId: 'P05' },
      { level: 'warning', site: `Toitures Rhône (${uid})`, msg: 'OPEX dépassement budget +14% sur 3 mois', time: 'il y a 1j', id: 'A12', siteId: 'P03' },
    ],
    industriel: [], particulier: []
  };

  const allKpi = {
    installateur: { sites: 6, alerts_critical: 2, pr_avg: 77.6, production_month: 84200, revenue_month: 62400, next_interventions: 3 },
    fonds: { mw: 28.1, sites: 5, pr_avg: 81.2, production_ytd: 42800, revenue_ytd: 6625000, irr: 8.3, co2: 4820 },
    industriel: { autoconso_pct: 73, savings_ytd: 87400, injection_ytd: 10200, pr: 87.4, bill_reduction: 40.5 },
    particulier: { production_month: 312, savings_month: 83.2, injection_revenue: 11.4, battery_pct: 72 },
  };

  const roleOptimisation = {
    epexHours: [{ hour: 0, price: 28 }, { hour: 1, price: 25 }],
    batteryConfig: {
      particulier: { pct: 72, capacity: 10, nextCharge: '22h00 → 06h00' },
      industriel: { pct: 68, capacity: 320, nextCharge: '01h00 → 05h00' },
      installateur: { pct: 64, capacity: 80, nextCharge: '23h00 → 04h00' },
      fonds: { pct: 71, capacity: 2400, nextCharge: '00h00 → 06h00' },
    }[role] || {},
    gainMonthly: { fonds: 48200, industriel: 2400, installateur: 124, particulier: 124 }[role] || 0,
    forecast: { fonds: '42.8 MWh', industriel: '3.1 MWh', installateur: '28.6 kWh', particulier: '28.6 kWh' }[role] || '0 kWh',
    flex: {
      fonds: [['FCR (Freq. Contain. Reserve)', 'Actif', '42 €/MWh', 'zap', 'green']],
      industriel: [['Effacement HPE (Pointe)', 'Actif', '−18% TURPE', 'zap', 'green']],
      installateur: [['Effacement HPE (Pointe)', 'Actif', '−18% TURPE', 'zap', 'green']],
    }[role] || [],
  };

  const settingsDefaults = {
    monitoring_filters: { site: 'all', status: 'all', alertLevel: 'all' },
    monitoring_alerts: { channel: 'email_dashboard', critical: 'immediate', warning: 'daily_digest' },
    billing_filters: { site: 'all', contract: 'all', status: 'all' },
    optimisation_rules: { mode: 'auto', chargeOffPeak: true, dischargePeak: true, sellSurplus: true },
    dashboard_data: {
      sites: { [role]: allSites[role] || [] },
      alerts: { [role]: allAlerts[role] || [] },
      warranties: [
        { name: 'Panneaux REC Alpha', site: `Entrepôt Bricard (${uid})`, start: '2024-06-10', years: 25, pct: 4 },
        { name: 'Onduleur SMA', site: `Entrepôt Bricard (${uid})`, start: '2024-06-10', years: 10, pct: 10 },
      ],
      kpi: { [role]: allKpi[role] || {} },
      reporting: {
        monthly: { labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'], production: [1820, 2100, 3450, 4800, 5900, 6400, 6700, 6100, 4500, 3200, 2100, 1600], revenue: [364, 420, 690, 960, 1180, 1280, 1340, 1220, 900, 640, 420, 320] },
        opexMonths: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
        opexValues: [1200, 800, 950, 1100, 700, 1800, 650, 1200, 950, 1100, 750, 900],
        esg: { [role]: { co2: '1 240', homes: '560', prod: '3 820' } },
        reports: { [role]: ['Rapport mensuel PDF', 'Synthèse annuelle'] },
      },
      conformite: {
        deadlines: [
          { label: `Audit énergétique obligatoire — Usine Rhône (${uid})`, date: '30/06/2026', days: 98, level: 'green' },
        ],
        checklist: { [role]: [{ item: 'Attestation CONSUEL obtenue', done: true }, { item: 'Dossier Enedis', done: false }] },
      },
      optimisation: {
        ...roleOptimisation,
        batteryConfig: { [role]: roleOptimisation.batteryConfig },
        flex: { [role]: roleOptimisation.flex }
      },
    },
  };

  for (const [key, payload] of Object.entries(settingsDefaults)) {
    await pool.query(
      `INSERT INTO user_settings (user_id, setting_key, payload) VALUES ($1,$2,$3::jsonb)`,
      [userId, key, JSON.stringify(payload)]
    );
  }
}

async function populateAll() {
  console.log('🔄 Récupération de tous les utilisateurs existants...');
  try {
    const res = await pool.query('SELECT id, email, role FROM users');
    console.log(`Trouvé ${res.rows.length} utilisateurs.`);

    for (const user of res.rows) {
      console.log(`\n🚮 Nettoyage des anciennes données pour ${user.email} (ID: ${user.id}, Rôle: ${user.role})...`);
      await pool.query('DELETE FROM tickets WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM documents WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM prospects WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM billing_entries WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM user_settings WHERE user_id = $1', [user.id]);
      
      console.log(`✨ Création de nouvelles données fictives pour ${user.email}...`);
      await ensureDomainData(user.id, user.role);
    }
    
    console.log('\n✅ Terminé ! Tous les utilisateurs actuels ont maintenant leurs propres données fictives isolées.');
  } catch (err) {
    console.error('Erreur lors du peuplement:', err);
  } finally {
    pool.end();
  }
}

populateAll();
