const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'nukunu_admin',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'nukunu_solar',
  password: process.env.DB_PASSWORD || 'nukunu_password',
  port: Number(process.env.DB_PORT || 5433),
});

async function fix() {
  try {
    const { rows: users } = await pool.query('SELECT id, role FROM users');
    console.log(`Checking ${users.length} users...`);
    
    for (const user of users) {
      if (user.role === 'industriel' || user.role === 'particulier') {
        const { rows: settings } = await pool.query(
          'SELECT payload FROM user_settings WHERE user_id = $1 AND setting_key = $2',
          [user.id, 'dashboard_data']
        );
        
        if (settings.length > 0) {
          const payload = settings[0].payload;
          if (Array.isArray(payload.sites[user.role])) {
            console.log(`Fixing dashboard_data for user ${user.id} (${user.role})`);
            payload.sites[user.role] = payload.sites[user.role][0] || {};
            await pool.query(
              'UPDATE user_settings SET payload = $1 WHERE user_id = $2 AND setting_key = $3',
              [JSON.stringify(payload), user.id, 'dashboard_data']
            );
          }
        }
      }
    }
    console.log('Fix completed successfully!');
  } catch (err) {
    console.error('Error during fix:', err);
  } finally {
    await pool.end();
  }
}

fix();
