/* ═══════════════════════════════════════════════════════════
   NUKUNU SOLAR — ADMIN CONTROLLER
   Global SaaS management (Users, Stats, Logs)
   (Protected by super_admin role)
   ═══════════════════════════════════════════════════════════ */

const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'nukunu_admin',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'nukunu_solar',
  password: process.env.DB_PASSWORD || 'nukunu_password',
  port: Number(process.env.DB_PORT || 5433),
});

/**
 * Middleware de sécurité Admin
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    return next();
  }
  return res.status(403).json({ error: 'Accès restreint aux administrateurs SaaS.' });
};

const os = require('os');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ADMIN_CREATABLE_ROLES = new Set(['installateur', 'fonds', 'industriel', 'particulier', 'super_admin']);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ensurePasswordStrength(password) {
  return typeof password === 'string' && password.length >= 8;
}

async function ensureRoleRecord(userId, role) {
  if (role === 'installateur') {
    await pool.query('INSERT INTO role_installateur (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  } else if (role === 'fonds') {
    await pool.query('INSERT INTO role_fonds (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  } else if (role === 'industriel') {
    await pool.query('INSERT INTO role_industriel (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  } else if (role === 'particulier') {
    await pool.query('INSERT INTO role_particulier (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  }
}

const getAdminStats = async (req, res) => {
  try {
    const [userCount, ticketCount, billingTotal] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM tickets'),
      pool.query('SELECT SUM(gross_revenue) FROM billing_entries')
    ]);

    res.json({
      totalUsers: parseInt(userCount.rows[0].count),
      totalTickets: parseInt(ticketCount.rows[0].count),
      totalRevenue: parseFloat(billingTotal.rows[0].sum || 0),
      infraHealth: 'Nominal',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getSystemInfo = (req, res) => {
  try {
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    
    res.json({
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total: Math.round(memTotal / 1024 / 1024),
        used: Math.round(memUsed / 1024 / 1024),
        percent: Math.round((memUsed / memTotal) * 100)
      },
      load: os.loadavg()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createUser = async (req, res) => {
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
  if (!ensurePasswordStrength(password)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  if (!ADMIN_CREATABLE_ROLES.has(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }

  try {
    await pool.query('BEGIN');
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );
    const user = result.rows[0];

    await ensureRoleRecord(user.id, role);

    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Création utilisateur: ${email} (${role})`
    ]);

    await pool.query('COMMIT');
    res.status(201).json({ user, message: 'Utilisateur créé.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: 'Email déjà utilisé.' });
    res.status(500).json({ error: 'Erreur lors de la création.' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte.' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING email', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Suppression utilisateur ID: ${id} (${result.rows[0].email})`
    ]);

    res.json({ message: 'Utilisateur supprimé avec succès.' });
  } catch (_err) {
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.name as user_name 
      FROM audit_logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      ORDER BY l.created_at DESC 
      LIMIT 100
    `);
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getRoleDistribution = async (req, res) => {
  try {
    const result = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    res.json({ distribution: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const broadcastMessage = async (req, res) => {
  const { title, message, level = 'info' } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Titre et message requis.' });

  try {
    await pool.query(
      "INSERT INTO system_config (key, value) VALUES ('global_broadcast', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
      [JSON.stringify({ title, message, level, active: true, created_at: new Date().toISOString() })]
    );

    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Broadcast Global: ${title}`
    ]);

    res.json({ message: 'Message diffusé avec succès.' });
  } catch (_err) {
    res.status(500).json({ error: 'Erreur lors de la diffusion.' });
  }
};

const toggleMaintenance = async (req, res) => {
  const { enabled } = req.body;
  try {
    await pool.query(
      "INSERT INTO system_config (key, value) VALUES ('maintenance_mode', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
      [JSON.stringify({ enabled: Boolean(enabled), updated_by: req.user.id })]
    );

    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Mode Maintenance: ${enabled ? 'Activé' : 'Désactivé'}`
    ]);

    res.json({ enabled: Boolean(enabled), message: `Maintenance ${enabled ? 'activée' : 'désactivée'}.` });
  } catch (_err) {
    res.status(500).json({ error: 'Erreur lors du basculement de la maintenance.' });
  }
};

const impersonateUser = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const user = result.rows[0];
    const impersonationToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, impersonatedBy: req.user.id },
      process.env.JWT_SECRET || 'local_docker_secret_change_me',
      { expiresIn: '12h' }
    );

    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Impersonation de l'utilisateur: ${user.email}`
    ]);

    res.json({ token: impersonationToken, user });
  } catch (_err) {
    res.status(500).json({ error: 'Échec de l\'impersonation.' });
  }
};

const getSystemFlags = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value
       FROM system_config
       WHERE key = ANY($1::text[])`,
      [['maintenance_mode', 'global_broadcast', 'session_revoked_after']]
    );
    const flags = result.rows.reduce((acc, row) => {
      acc[row.key] = row.value || {};
      return acc;
    }, {});

    res.json({
      maintenance: flags.maintenance_mode || { enabled: false },
      broadcast: flags.global_broadcast || { active: false },
      sessions: {
        revokedAfter: flags.session_revoked_after?.timestamp || null,
      },
    });
  } catch (_err) {
    res.status(500).json({ error: 'Erreur lors du chargement des paramètres système.' });
  }
};

const logoutAllUsers = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    await pool.query(
      "INSERT INTO system_config (key, value) VALUES ('session_revoked_after', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
      [JSON.stringify({ timestamp, updated_by: req.user.id })]
    );

    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)', [
      req.user.id,
      'Réinitialisation globale des sessions utilisateur'
    ]);

    const keepaliveToken = jwt.sign(
      { id: req.user.id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET || 'local_docker_secret_change_me',
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Toutes les sessions utilisateurs ont été réinitialisées.',
      timestamp,
      token: keepaliveToken,
    });
  } catch (_err) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation des sessions.' });
  }
};

const getDatabaseHealth = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;
    `);
    res.json({ tables: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const axios = require('axios');
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://nukunu-prometheus:9090';

const getPrometheusMetrics = async (req, res) => {
  const { query, range = '1h', step = '15s' } = req.query;
  if (!query) return res.status(400).json({ error: 'Query Prometheus requise.' });

  try {
    const end = Math.floor(Date.now() / 1000);
    let start;
    
    // Simple duration parser (1h, 24h, 7d)
    const match = range.match(/^(\d+)([hdm])$/);
    if (match) {
      const val = parseInt(match[1]);
      const unit = match[2];
      if (unit === 'h') start = end - val * 3600;
      else if (unit === 'd') start = end - val * 86400;
      else if (unit === 'm') start = end - val * 60; // minutes
    } else {
      start = end - 3600; // default 1h
    }

    const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
      params: {
        query,
        start,
        end,
        step
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error('Prometheus Error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des métriques Prometheus.' });
  }
};

const globalSearch = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ users: [], tickets: [], units: [] });

  try {
    const term = `%${q}%`;
    const [users, tickets] = await Promise.all([
      pool.query('SELECT id, name, email, role FROM users WHERE name ILIKE $1 OR email ILIKE $1 LIMIT 10', [term]),
      pool.query('SELECT id, title, site_name, status FROM tickets WHERE title ILIKE $1 OR site_name ILIKE $1 LIMIT 10', [term])
    ]);

    res.json({
      users: users.rows,
      tickets: tickets.rows
    });
  } catch (_err) {
    res.status(500).json({ error: 'Erreur de recherche.' });
  }
};

module.exports = {
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
  logoutAllUsers
};
