const path = require('path');
require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const client = require('prom-client');

// Monitoring Setup (BC03)
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500],
});
register.registerMetric(httpRequestDurationMicroseconds);

const app = express();
const port = Number(process.env.PORT || 3002);
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = JWT_SECRET;
const ALLOWED_ROLES = new Set(['installateur', 'fonds', 'industriel', 'particulier']);
const ALLOWED_SETTINGS_KEYS = new Set([
  'monitoring_filters',
  'monitoring_alerts',
  'billing_filters',
  'optimisation_rules',
  'dashboard_data',
  'notification_state',
  'activity_log',
]);
const FRONTEND_ROOT = path.resolve(__dirname, '../client');

const { getLiveHealthSummary, decorateDashboardData } = require('./live-data');
const {
  isAdmin,
  getAdminStats,
  getAllUsers,
  getAuditLogs,
  getSystemInfo,
  createUser,
  deleteUser,
  getRoleDistribution,
  broadcastMessage,
  toggleMaintenance,
  impersonateUser,
  getDatabaseHealth,
  getPrometheusMetrics,
  globalSearch,
  getSystemFlags,
  logoutAllUsers,
} = require('./admin-controller');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET absent du .env : un secret éphémère a été généré pour cette session.');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === 'null' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origine non autorisée par CORS'));
  }
}));

// Use express.static for the entire client folder at the root
app.use(express.static(FRONTEND_ROOT));

// Redirection root
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

app.use(express.json({ limit: '10mb' }));
app.use('/css', express.static(path.join(FRONTEND_ROOT, 'css')));
app.use('/js', express.static(path.join(FRONTEND_ROOT, 'js')));

const pool = new Pool({
  user: process.env.DB_USER || 'nukunu_admin',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'nukunu_solar',
  password: process.env.DB_PASSWORD || 'nukunu_password',
  port: Number(process.env.DB_PORT || 5432),
});

async function getSystemConfigMap(keys = []) {
  if (!keys.length) return {};
  const result = await pool.query(
    'SELECT key, value FROM system_config WHERE key = ANY($1::text[])',
    [keys]
  );
  return result.rows.reduce((acc, row) => {
    acc[row.key] = row.value || {};
    return acc;
  }, {});
}

async function getPlatformState() {
  const state = await getSystemConfigMap(['maintenance_mode', 'global_broadcast', 'session_revoked_after']);
  return {
    maintenance: state.maintenance_mode || { enabled: false },
    broadcast: state.global_broadcast || { active: false },
    sessions: state.session_revoked_after || null,
  };
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès refusé' });

  try {
    const user = jwt.verify(token, JWT_SECRET);
    const state = await getPlatformState();
    const revokedAfter = Date.parse(state.sessions?.timestamp || '');
    if (Number.isFinite(revokedAfter) && user.iat && (user.iat * 1000) < revokedAfter) {
      return res.status(401).json({ error: 'Session expirée après réinitialisation globale.' });
    }
    if (state.maintenance?.enabled && user.role !== 'super_admin' && req.path !== '/api/system/state') {
      return res.status(503).json({ error: 'La plateforme est temporairement en maintenance.' });
    }

    req.user = user;
    next();
  } catch (_error) {
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// 📈 Middleware Monitoring — Tracking Durée Requêtes (BC03)
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    // On ne track que les routes API pour éviter de polluer les métriques avec les fichiers statiques
    if (req.path.startsWith('/api')) {
      httpRequestDurationMicroseconds.observe(
        { method: req.method, route: req.path, code: res.statusCode },
        end()
      );
    }
  });
  next();
});


app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/* ── ADMIN ROUTES (SAAS) ───────────────────────── */
app.get('/api/admin/stats', authenticateToken, isAdmin, getAdminStats);
app.get('/api/admin/users', authenticateToken, isAdmin, getAllUsers);
app.get('/api/admin/logs',  authenticateToken, isAdmin, getAuditLogs);
app.get('/api/admin/sysinfo', authenticateToken, isAdmin, getSystemInfo);
app.post('/api/admin/users', authenticateToken, isAdmin, createUser);
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, deleteUser);
app.get('/api/admin/role-distribution', authenticateToken, isAdmin, getRoleDistribution);
app.post('/api/admin/broadcast', authenticateToken, isAdmin, broadcastMessage);
app.post('/api/admin/maintenance', authenticateToken, isAdmin, toggleMaintenance);
app.post('/api/admin/impersonate/:id', authenticateToken, isAdmin, impersonateUser);
app.get('/api/admin/db-health', authenticateToken, isAdmin, getDatabaseHealth);
app.get('/api/admin/metrics', authenticateToken, isAdmin, getPrometheusMetrics);
app.get('/api/admin/search', authenticateToken, isAdmin, globalSearch);
app.get('/api/admin/system-flags', authenticateToken, isAdmin, getSystemFlags);
app.post('/api/admin/logout-all', authenticateToken, isAdmin, logoutAllUsers);
app.get('/api/system/state', authenticateToken, async (req, res) => {
  try {
    res.json(await getPlatformState());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du chargement de l’état plateforme.' });
  }
});

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}

function makePasswordResetToken(user) {
  return jwt.sign({ id: user.id, email: user.email, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '15m' });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function ensurePasswordStrength(password) {
  return typeof password === 'string' && password.length >= 8;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function padId(prefix, id) {
  return `${prefix}${String(id).padStart(3, '0')}`;
}

function parseDisplayId(value) {
  return Number(String(value || '').replace(/\D/g, ''));
}

async function runMigrations() {
  const statements = [
    // ── 1. BASE TABLES ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      email_verified BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS role_installateur (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      company_name VARCHAR(255),
      qualipv_id VARCHAR(100),
      managed_sites INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS role_fonds (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      management_company VARCHAR(255),
      managed_volume_mwp DECIMAL,
      active_assets INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS role_industriel (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      site_name VARCHAR(255),
      roof_surface_m2 DECIMAL,
      annual_consumption_kwh DECIMAL
    )`,
    `CREATE TABLE IF NOT EXISTS role_particulier (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      installation_address VARCHAR(255),
      peak_power_kwp DECIMAL,
      connection_type VARCHAR(100)
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      site_name VARCHAR(255),
      document_date DATE,
      expiry_date DATE,
      file_name VARCHAR(255),
      file_mime_type VARCHAR(255),
      file_content TEXT,
      status VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      site_name VARCHAR(255),
      site_code VARCHAR(100),
      type VARCHAR(100),
      title VARCHAR(255),
      description TEXT,
      priority VARCHAR(50),
      tech VARCHAR(255),
      due_date DATE,
      cost_np DECIMAL,
      sla_hours INTEGER,
      status VARCHAR(50) DEFAULT 'todo',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prospects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255),
      contact VARCHAR(255),
      power_kwc DECIMAL,
      value_eur DECIMAL,
      stage VARCHAR(100),
      last_contact DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS billing_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      site_name VARCHAR(255),
      contract_name VARCHAR(255),
      period_label VARCHAR(100),
      energy_kwh DECIMAL,
      tariff_label VARCHAR(100),
      tariff_rate DECIMAL,
      gross_revenue DECIMAL,
      notes TEXT,
      payment_status VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      setting_key VARCHAR(100),
      payload JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, setting_key)
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(255) NOT NULL,
      entity VARCHAR(100),
      entity_id VARCHAR(100),
      details JSONB DEFAULT '{}'::jsonb,
      ip_address VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS system_config (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── 2. INCREMENTAL UPDATES (MIGRATIONS) ─────────────────────
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR(255)",
    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_content TEXT",
    "ALTER TABLE billing_entries ADD COLUMN IF NOT EXISTS notes TEXT",
  ];

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (e) {
      console.error(`Migration Statement Failed: ${statement}`);
      console.error(e);
    }
  }
}

function mapTicket(row) {
  return {
    id: padId('T-', row.id),
    site: row.site_name,
    priority: row.priority,
    status: row.status,
    tech: row.tech,
    created: new Date(row.created_at).toISOString().slice(0, 10),
    due: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
    cost_np: Number(row.cost_np || 0),
    description: row.description,
    title: row.title,
    type: row.type,
    sla: row.sla_hours,
  };
}

function mapDocument(row) {
  return {
    id: padId('DOC-', row.id),
    name: row.name,
    site: row.site_name,
    date: row.document_date ? new Date(row.document_date).toISOString().slice(0, 10) : null,
    expiry: row.expiry_date ? new Date(row.expiry_date).toISOString().slice(0, 10) : null,
    file_name: row.file_name || null,
    file_mime_type: row.file_mime_type || null,
    file_content: row.file_content || null,
    has_file: Boolean(row.file_content),
    status: row.status,
  };
}

function mapProspect(row) {
  return {
    id: padId('CRM-', row.id),
    name: row.name,
    contact: row.contact,
    power: Number(row.power_kwc || 0),
    value: Number(row.value_eur || 0),
    stage: row.stage,
    lastContact: row.last_contact ? new Date(row.last_contact).toISOString().slice(0, 10) : null,
  };
}

function mapBilling(row) {
  return {
    id: padId('BIL-', row.id),
    site: row.site_name,
    contract: row.contract_name,
    period: row.period_label,
    energy_kwh: Number(row.energy_kwh || 0),
    tariff_label: row.tariff_label,
    tariff_rate: Number(row.tariff_rate || 0),
    gross_revenue: Number(row.gross_revenue || 0),
    notes: row.notes || '',
    payment_status: row.payment_status,
  };
}

async function getUserSetting(userId, settingKey, fallback = {}) {
  const result = await pool.query(
    'SELECT payload FROM user_settings WHERE user_id = $1 AND setting_key = $2',
    [userId, settingKey]
  );
  return result.rows[0]?.payload || fallback;
}

async function setUserSetting(userId, settingKey, payload) {
  const result = await pool.query(
    `INSERT INTO user_settings (user_id, setting_key, payload, updated_at)
     VALUES ($1,$2,$3::jsonb,CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, setting_key)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP
     RETURNING payload`,
    [userId, settingKey, JSON.stringify(payload || {})]
  );
  return result.rows[0]?.payload || {};
}

async function ensureDomainData(userId, role) {
  const [{ rows: ticketRows }, { rows: documentRows }, { rows: prospectRows }, { rows: billingRows }] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM tickets WHERE user_id = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS count FROM documents WHERE user_id = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS count FROM prospects WHERE user_id = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS count FROM billing_entries WHERE user_id = $1', [userId]),
  ]);

  const uid = String(userId).padStart(3, '0');
  
  if (!ticketRows[0].count) {
    const defaults = {
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
    for (const item of defaults) {
      await pool.query(
        `INSERT INTO tickets (user_id, site_name, site_code, type, title, description, priority, status, tech, due_date, cost_np, sla_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [userId, ...item]
      );
    }
  }

  if (!documentRows[0].count) {
    const defaults = {
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
    for (const item of defaults) {
      await pool.query(
        `INSERT INTO documents (user_id, name, site_name, document_date, expiry_date, status)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId, ...item]
      );
    }
  }

  if (!prospectRows[0].count) {
    const defaults = {
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
    for (const item of defaults) {
      await pool.query(
        `INSERT INTO prospects (user_id, name, contact, power_kwc, value_eur, stage, last_contact)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, ...item]
      );
    }
  }

  if (!billingRows[0].count) {
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
        `INSERT INTO billing_entries (user_id, site_name, contract_name, period_label, energy_kwh, tariff_label, tariff_rate, gross_revenue, payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [userId, ...item]
      );
    }
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
    epexHours: [{ hour: 0, price: 28 }, { hour: 1, price: 25 }, { hour: 2, price: 24 }, { hour: 3, price: 23 }, { hour: 4, price: 22 }, { hour: 5, price: 25 }, { hour: 6, price: 38 }, { hour: 7, price: 62 }, { hour: 8, price: 75 }, { hour: 9, price: 82 }, { hour: 10, price: 78 }, { hour: 11, price: 74 }, { hour: 12, price: 70 }, { hour: 13, price: 68 }, { hour: 14, price: 65 }, { hour: 15, price: 72 }, { hour: 16, price: 88 }, { hour: 17, price: 96 }, { hour: 18, price: 90 }, { hour: 19, price: 78 }, { hour: 20, price: 55 }, { hour: 21, price: 42 }, { hour: 22, price: 35 }, { hour: 23, price: 30 }],
    batteryConfig: {
      particulier: { pct: 72, capacity: 10, nextCharge: '22h00 → 06h00' },
      industriel: { pct: 68, capacity: 320, nextCharge: '01h00 → 05h00' },
      installateur: { pct: 64, capacity: 80, nextCharge: '23h00 → 04h00' },
      fonds: { pct: 71, capacity: 2400, nextCharge: '00h00 → 06h00' },
    }[role] || {},
    gainMonthly: { fonds: 48200, industriel: 2400, installateur: 124, particulier: 124 }[role] || 0,
    forecast: { fonds: '42.8 MWh', industriel: '3.1 MWh', installateur: '28.6 kWh', particulier: '28.6 kWh' }[role] || '0 kWh',
    flex: {
      fonds: [['FCR (Freq. Contain. Reserve)', 'Actif', '42 €/MWh', 'zap', 'green'], ['aFRR Secondaire', 'Disponible', '38 €/MW/h', 'activity', 'blue'], ['Marché de capacité', 'Enchère (Avr)', '12 €/kW/an', 'euro', 'amber']],
      industriel: [['Effacement HPE (Pointe)', 'Actif', '−18% TURPE', 'zap', 'green'], ['Délestage programmé', 'Planifié', 'Jeudi 18h–20h', 'calendar', 'amber'], ['Prime de flexibilité', 'En cours', '2 840 €/an', 'trending-up', 'amber']],
      installateur: [['Effacement HPE (Pointe)', 'Actif', '−18% TURPE', 'zap', 'green'], ['Délestage programmé', 'Planifié', 'Jeudi 18h–20h', 'calendar', 'amber'], ['Prime de flexibilité', 'En cours', '2 840 €/an', 'trending-up', 'amber']],
    }[role] || [],
  };

  const settingsDefaults = {
    monitoring_filters: { site: 'all', status: 'all', alertLevel: 'all' },
    monitoring_alerts: { channel: 'email_dashboard', critical: 'immediate', warning: 'daily_digest' },
    billing_filters: { site: 'all', contract: 'all', status: 'all' },
    optimisation_rules: { mode: 'auto', chargeOffPeak: true, dischargePeak: true, sellSurplus: true },
    dashboard_data: {
      sites: { 
        [role]: (role === 'industriel' || role === 'particulier') 
          ? (allSites[role][0] || {}) 
          : (allSites[role] || []) 
      },
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
      `INSERT INTO user_settings (user_id, setting_key, payload)
       VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (user_id, setting_key) DO NOTHING`,
      [userId, key, JSON.stringify(payload)]
    );
  }
}

app.post('/api/auth/register', async (req, res) => {
  const name = normalizeText(req.body?.name);
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const role = normalizeText(req.body?.role);
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }
  if (!ensurePasswordStrength(password)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  try {
    const platformState = await getPlatformState();
    if (platformState.maintenance?.enabled) {
      return res.status(503).json({ error: 'Les inscriptions sont temporairement suspendues pendant la maintenance.' });
    }

    await pool.query('BEGIN');
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );
    const user = userResult.rows[0];

    if (role === 'installateur') await pool.query('INSERT INTO role_installateur (user_id) VALUES ($1)', [user.id]);
    if (role === 'fonds') await pool.query('INSERT INTO role_fonds (user_id) VALUES ($1)', [user.id]);
    if (role === 'industriel') await pool.query('INSERT INTO role_industriel (user_id) VALUES ($1)', [user.id]);
    if (role === 'particulier') await pool.query('INSERT INTO role_particulier (user_id) VALUES ($1)', [user.id]);

    await pool.query('COMMIT');
    await ensureDomainData(user.id, role);

    res.status(201).json({ user, token: makeToken(user) });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    if (error.code === '23505') return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    res.status(500).json({ error: 'Erreur serveur lors de l’inscription.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Adresse email invalide.' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Mot de passe incorrect.' });
    const platformState = await getPlatformState();
    if (platformState.maintenance?.enabled && user.role !== 'super_admin') {
      return res.status(503).json({ error: 'La plateforme est temporairement en maintenance.' });
    }

    await ensureDomainData(user.id, user.role);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: makeToken(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
});

app.post('/api/auth/request-reset', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      return res.json({
        ok: true,
        message: 'Si un compte existe, une procédure de réinitialisation a été préparée.',
      });
    }

    const user = result.rows[0];
    const resetToken = makePasswordResetToken(user);
    res.json({
      ok: true,
      message: 'Réinitialisation prête en environnement local.',
      resetToken,
      expiresInMinutes: 15,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la préparation de la réinitialisation.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const token = normalizeText(req.body?.token);
  const newPassword = req.body?.newPassword;
  const confirmPassword = req.body?.confirmPassword;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Token et nouveau mot de passe requis.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });
  }
  if (!ensurePasswordStrength(newPassword)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Token de réinitialisation invalide.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
      [passwordHash, payload.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ ok: true, message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Token expiré ou invalide.' });
  }
});

app.get('/api/account', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, name, email, role, email_verified, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const user = userResult.rows[0];
    let roleData = {};

    switch (user.role) {
      case 'installateur':
        roleData = (await pool.query('SELECT company_name, qualipv_id, managed_sites FROM role_installateur WHERE user_id = $1', [user.id])).rows[0] || {};
        break;
      case 'fonds':
        roleData = (await pool.query('SELECT management_company, managed_volume_mwp, active_assets FROM role_fonds WHERE user_id = $1', [user.id])).rows[0] || {};
        break;
      case 'industriel':
        roleData = (await pool.query('SELECT site_name, roof_surface_m2, annual_consumption_kwh FROM role_industriel WHERE user_id = $1', [user.id])).rows[0] || {};
        break;
      case 'particulier':
        roleData = (await pool.query('SELECT installation_address, peak_power_kwp, connection_type FROM role_particulier WHERE user_id = $1', [user.id])).rows[0] || {};
        break;
    }

    res.json({ user, roleDetails: roleData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
  }
});

app.put('/api/account', authenticateToken, async (req, res) => {
  const name = normalizeText(req.body?.name);
  const email = req.body?.email ? normalizeEmail(req.body.email) : null;
  const roleDetails = req.body?.roleDetails;
  const userId = req.user.id;
  const role = req.user.role;

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  try {
    await pool.query('BEGIN');

    if (name || email) {
      await pool.query(
        'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3',
        [name, email, userId]
      );
    }

    if (roleDetails) {
      if (role === 'installateur') {
        await pool.query(
          'UPDATE role_installateur SET company_name = COALESCE($1, company_name), qualipv_id = COALESCE($2, qualipv_id), managed_sites = COALESCE($3, managed_sites) WHERE user_id = $4',
          [roleDetails.company_name, roleDetails.qualipv_id, roleDetails.managed_sites, userId]
        );
      } else if (role === 'fonds') {
        await pool.query(
          'UPDATE role_fonds SET management_company = COALESCE($1, management_company), managed_volume_mwp = COALESCE($2, managed_volume_mwp), active_assets = COALESCE($3, active_assets) WHERE user_id = $4',
          [roleDetails.management_company, roleDetails.managed_volume_mwp, roleDetails.active_assets, userId]
        );
      } else if (role === 'industriel') {
        await pool.query(
          'UPDATE role_industriel SET site_name = COALESCE($1, site_name), roof_surface_m2 = COALESCE($2, roof_surface_m2), annual_consumption_kwh = COALESCE($3, annual_consumption_kwh) WHERE user_id = $4',
          [roleDetails.site_name, roleDetails.roof_surface_m2, roleDetails.annual_consumption_kwh, userId]
        );
      } else if (role === 'particulier') {
        await pool.query(
          'UPDATE role_particulier SET installation_address = COALESCE($1, installation_address), peak_power_kwp = COALESCE($2, peak_power_kwp), connection_type = COALESCE($3, connection_type) WHERE user_id = $4',
          [roleDetails.installation_address, roleDetails.peak_power_kwp, roleDetails.connection_type, userId]
        );
      }
    }

    await pool.query('COMMIT');
    const refreshedUser = (await pool.query('SELECT id, name, email, role, email_verified, created_at FROM users WHERE id = $1', [userId])).rows[0];
    res.json({ message: 'Profil mis à jour avec succès.', user: refreshedUser, token: makeToken(refreshedUser) });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    if (error.code === '23505') return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  const confirmPassword = req.body?.confirmPassword;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Tous les champs du mot de passe sont requis.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });
  }
  if (!ensurePasswordStrength(newPassword)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  try {
    const result = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
    res.json({ ok: true, message: 'Mot de passe mis à jour.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
  }
});

app.delete('/api/account', authenticateToken, async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const confirmation = normalizeText(req.body?.confirmation);

  if (!currentPassword || confirmation !== 'SUPPRIMER') {
    return res.status(400).json({ error: 'Confirmation invalide.' });
  }

  try {
    const result = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ ok: true, message: 'Compte supprimé.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte.' });
  }
});

app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    await ensureDomainData(req.user.id, req.user.role);
    const result = await pool.query('SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [req.user.id]);
    res.json({ tickets: result.rows.map(mapTicket) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du chargement des tickets.' });
  }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
  const { site, siteCode, type, title, description, priority, tech, due, cost_np, sla } = req.body;
  if (!normalizeText(site) || !normalizeText(title)) {
    return res.status(400).json({ error: 'Site et titre du ticket requis.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO tickets (user_id, site_name, site_code, type, title, description, priority, tech, due_date, cost_np, sla_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [req.user.id, site, siteCode || null, type || 'Correctif', title, description || null, priority || 'normal', tech || null, due || null, Number(cost_np || 0), Number(sla || 24)]
    );
    res.status(201).json({ ticket: mapTicket(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la création du ticket.' });
  }
});

app.patch('/api/tickets/:id', authenticateToken, async (req, res) => {
  const id = parseDisplayId(req.params.id);
  const { status, tech } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tickets
       SET status = COALESCE($1, status), tech = COALESCE($2, tech)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [status || null, tech || null, id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket introuvable.' });
    res.json({ ticket: mapTicket(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du ticket.' });
  }
});

app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    await ensureDomainData(req.user.id, req.user.role);
    const result = await pool.query('SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [req.user.id]);
    res.json({ documents: result.rows.map(mapDocument) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du chargement des documents.' });
  }
});

app.post('/api/documents', authenticateToken, async (req, res) => {
  const { name, site, date, expiry, status, file_name, file_mime_type, file_content } = req.body;
  if (!normalizeText(name) || !normalizeText(site)) {
    return res.status(400).json({ error: 'Nom du document et site requis.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO documents (user_id, name, site_name, document_date, expiry_date, file_name, file_mime_type, file_content, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [req.user.id, name, site, date || null, expiry || null, file_name || null, file_mime_type || null, file_content || null, status || 'valid']
    );
    res.status(201).json({ document: mapDocument(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de l’ajout du document.' });
  }
});

app.patch('/api/documents/upload', authenticateToken, async (req, res) => {
  const { name, site, file_name, file_mime_type, file_content } = req.body;
  try {
    const result = await pool.query(
      `UPDATE documents
       SET document_date = CURRENT_DATE,
           status = 'valid',
           file_name = COALESCE($4, file_name),
           file_mime_type = COALESCE($5, file_mime_type),
           file_content = COALESCE($6, file_content)
       WHERE user_id = $1 AND name = $2 AND site_name = $3
       RETURNING *`,
      [req.user.id, name, site, file_name || null, file_mime_type || null, file_content || null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Document introuvable.' });
    res.json({ document: mapDocument(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du document.' });
  }
});

app.get('/api/prospects', authenticateToken, async (req, res) => {
  try {
    await ensureDomainData(req.user.id, req.user.role);
    const result = await pool.query('SELECT * FROM prospects WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [req.user.id]);
    res.json({ prospects: result.rows.map(mapProspect) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du chargement des prospects.' });
  }
});

app.post('/api/prospects', authenticateToken, async (req, res) => {
  const { name, contact, power, value, stage } = req.body;
  if (!normalizeText(name)) {
    return res.status(400).json({ error: 'Nom du prospect requis.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO prospects (user_id, name, contact, power_kwc, value_eur, stage)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [req.user.id, name, contact || null, Number(power || 0), Number(value || 0), stage || 'lead']
    );
    res.status(201).json({ prospect: mapProspect(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la création du prospect.' });
  }
});

app.patch('/api/prospects/:id', authenticateToken, async (req, res) => {
  const id = parseDisplayId(req.params.id);
  const { stage, touch } = req.body;
  try {
    const result = await pool.query(
      `UPDATE prospects
       SET stage = COALESCE($1, stage),
           last_contact = CASE WHEN $2::boolean THEN CURRENT_DATE ELSE last_contact END
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [stage || null, Boolean(touch || stage), id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Prospect introuvable.' });
    res.json({ prospect: mapProspect(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du prospect.' });
  }
});

app.get('/api/billing', authenticateToken, async (req, res) => {
  try {
    await ensureDomainData(req.user.id, req.user.role);
    const result = await pool.query('SELECT * FROM billing_entries WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [req.user.id]);
    res.json({ entries: result.rows.map(mapBilling) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du chargement de la facturation.' });
  }
});

app.post('/api/billing/contracts', authenticateToken, async (req, res) => {
  const { site, contractName, notes } = req.body;
  if (!normalizeText(site)) {
    return res.status(400).json({ error: 'Site requis.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO billing_entries (user_id, site_name, contract_name, period_label, tariff_label, tariff_rate, gross_revenue, notes, payment_status)
       VALUES ($1,$2,$3,'Mars 2026','À définir',0,0,$4,'draft')
       RETURNING *`,
      [req.user.id, site || 'Nouveau site', contractName || 'Nouveau contrat', notes || null]
    );
    res.status(201).json({ entry: mapBilling(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la création du contrat.' });
  }
});

app.get('/api/settings/:key', authenticateToken, async (req, res) => {
  try {
    if (!ALLOWED_SETTINGS_KEYS.has(req.params.key)) {
      return res.status(400).json({ error: 'Clé de configuration non autorisée.' });
    }
    let storedPayload = await getUserSetting(req.user.id, req.params.key, {});
    if (req.params.key === 'dashboard_data' && !Object.keys(storedPayload || {}).length && ALLOWED_ROLES.has(req.user.role)) {
      await ensureDomainData(req.user.id, req.user.role);
      storedPayload = await getUserSetting(req.user.id, req.params.key, {});
    }
    const payload = req.params.key === 'dashboard_data'
      ? await decorateDashboardData(storedPayload, req.user.role)
      : storedPayload;
    res.json({ key: req.params.key, payload });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du chargement de la configuration.' });
  }
});

app.put('/api/settings/:key', authenticateToken, async (req, res) => {
  try {
    if (!ALLOWED_SETTINGS_KEYS.has(req.params.key)) {
      return res.status(400).json({ error: 'Clé de configuration non autorisée.' });
    }
    const payload = await setUserSetting(req.user.id, req.params.key, req.body?.payload || {});
    res.json({ key: req.params.key, payload });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de la configuration.' });
  }
});

app.get('/api/live/status', authenticateToken, async (req, res) => {
  try {
    let payload = await getUserSetting(req.user.id, 'dashboard_data', {});
    if (!Object.keys(payload || {}).length && ALLOWED_ROLES.has(req.user.role)) {
      await ensureDomainData(req.user.id, req.user.role);
      payload = await getUserSetting(req.user.id, 'dashboard_data', {});
    }
    const liveDashboard = await decorateDashboardData(payload, req.user.role);
    res.json(liveDashboard.live || { enabled: false, providers: {} });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du chargement du statut live.' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true, frontend: true, live: getLiveHealthSummary() });
  } catch (_error) {
    res.status(500).json({ ok: false, db: false, live: getLiveHealthSummary() });
  }
});

async function bootstrap() {
  try {
    await runMigrations();
    app.listen(port, () => {
      console.log(`Nukunu Solar API Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Impossible de démarrer le serveur Nukunu Solar:', error);
    process.exit(1);
  }
}

bootstrap();
