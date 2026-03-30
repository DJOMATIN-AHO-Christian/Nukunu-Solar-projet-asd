const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'nukunu_admin',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'nukunu_solar',
  password: process.env.DB_PASSWORD || 'nukunu_password',
  port: Number(process.env.DB_PORT || 5433),
});

async function migrate() {
  try {
    console.log('Running migration...');
    const sql = fs.readFileSync(path.join(__dirname, '../db/migration_admin.sql'), 'utf-8');
    await pool.query(sql);

    console.log('Seeding Super Admin...');
    const email = 'superadmin@nukunu.com';
    const password = 'superpassword123';
    const hash = await bcrypt.hash(password, 10);

    const res = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role RETURNING id',
      ['Super Administrateur', email, hash, 'super_admin']
    );

    console.log(`Migration and Seeding complete! User ID: ${res.rows[0].id}`);
    console.log(`Credentials: ${email} / ${password}`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
