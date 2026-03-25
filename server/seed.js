const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'nukunu_admin',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'nukunu_solar',
  password: process.env.DB_PASSWORD || 'nukunu_password',
  port: Number(process.env.DB_PORT || 5433),
});

const SEED_DATA = [
  {
    role: 'installateur',
    users: [
      {
        name: 'Jean Installateur', email: 'installateur@nukunu.com', password: 'password123',
        meta: { company_name: 'Solaire Pro', qualipv_id: 'QPV-12345', managed_sites: 12 },
        tickets: [['Mairie de Crolles', 'S06', 'Correctif urgent', 'Panne totale – intervention urgente', 'Panne totale', 'critical', 'todo', 'M. Lefevre', '2026-03-24', 740, 4]],
        docs: [['Attestation CONSUEL', 'Entrepôt Bricard', '2024-06-10', null, 'valid']],
        prospects: [['Entrepôt Marcellin SA', 'P. Marcellin', 320, 98000, 'lead', '2026-03-20']],
        billing: [['Entrepôt Bricard', 'OA EDF', 'Mars 2026', 13640, 'OA EDF', 0.1269, 1731, 'paid']],
      },
      {
        name: 'Alice Énergie', email: 'alice@nukunu.com', password: 'password123',
        meta: { company_name: 'ÉcoVolt Services', qualipv_id: 'QPV-67890', managed_sites: 8 },
        tickets: [['Lycée Bellevue', 'S08', 'Préventif', 'Contrôle onduleurs', 'Vérification annuelle', 'normal', 'todo', 'J. Dupont', '2026-04-10', 150, 48]],
        docs: [['Déclaration Mairie', 'Lycée Bellevue', '2023-05-15', '2026-05-15', 'warning']],
        prospects: [['Supermarché Leclerc', 'Direction', 500, 150000, 'quote', '2026-03-25']],
        billing: [['Lycée Bellevue', 'PPA', 'Mars 2026', 8500, 'PPA', 0.09, 765, 'paid']],
      }
    ]
  },
  {
    role: 'fonds',
    users: [
      {
        name: 'Marie Fonds', email: 'fonds@nukunu.com', password: 'password123',
        meta: { management_company: 'Invest Solaire', managed_volume_mwp: 28.5, active_assets: 5 },
        tickets: [['Parc Corse Énergie', 'P05', 'Audit', 'Revue OPEX trimestrielle', 'Analyse dérives', 'warning', 'inprogress', 'A. Martin', '2026-03-29', 0, 48]],
        docs: [['Rapport SFDR Q1', 'Parc Beauce Sud', '2026-03-15', null, 'valid']],
        prospects: [['Portefeuille Occitanie', 'Direction Invest', 5200, 1800000, 'negotiation', '2026-03-24']],
        billing: [['Parc Beauce Sud', 'OA EDF', 'Mars 2026', 332640, 'OA EDF', 0.1269, 42242, 'paid']],
      },
      {
        name: 'Capital Vert', email: 'capital@nukunu.com', password: 'password123',
        meta: { management_company: 'GreenCap PE', managed_volume_mwp: 15.0, active_assets: 3 },
        tickets: [['Centrale Alpine', 'P08', 'Correctif', 'Nettoyage panneaux', 'Baisse de PR', 'normal', 'todo', 'Nettoyage SARL', '2026-04-05', 1200, 72]],
        docs: [['Bail Emphytéotique', 'Centrale Alpine', '2020-01-01', '2040-01-01', 'valid']],
        prospects: [['Ferme Solaire Bretagne', 'Propriétaire', 12000, 4500000, 'lead', '2026-03-20']],
        billing: [['Centrale Alpine', 'Marché Libre', 'Mars 2026', 150000, 'Spot', 0.05, 7500, 'draft']],
      }
    ]
  },
  {
    role: 'industriel',
    users: [
      {
        name: 'Paul Industriel', email: 'industriel@nukunu.com', password: 'password123',
        meta: { site_name: 'Usine Métallurgie Rhône', roof_surface_m2: 4500, annual_consumption_kwh: 1200000 },
        tickets: [['Usine Métallurgie Rhône', 'IND-001', 'Préventif', 'Visite trimestrielle', 'Inspection', 'normal', 'todo', 'A. Martin', '2026-03-31', 0, 72]],
        docs: [['Audit énergétique', 'Usine Métallurgie Rhône', null, '2026-06-30', 'warning']],
        prospects: [['Extension logistique', 'Resp. Achats', 180, 64000, 'lead', '2026-03-21']],
        billing: [['Usine Métallurgie Rhône', 'Mix', 'Mars 2026', 92460, 'Mix', 0.118, 10910, 'paid']],
      },
      {
        name: 'Fabrique Textiles', email: 'textiles@nukunu.com', password: 'password123',
        meta: { site_name: 'Atelier Mode Nord', roof_surface_m2: 2000, annual_consumption_kwh: 450000 },
        tickets: [['Atelier Mode Nord', 'IND-002', 'Amélioration', 'Ajout batteries', 'Étude', 'normal', 'inprogress', 'E. Blanc', '2026-05-01', 500, 168]],
        docs: [['Contrat Maintenance', 'Atelier Mode Nord', '2025-01-01', '2026-01-01', 'expired']],
        prospects: [['Ombrières Parking', 'Directeur', 250, 85000, 'quote', '2026-03-26']],
        billing: [['Atelier Mode Nord', 'Autoconsommation', 'Mars 2026', 45000, 'PPA', 0.10, 4500, 'paid']],
      }
    ]
  },
  {
    role: 'particulier',
    users: [
      {
        name: 'Lucie Particulier', email: 'particulier@nukunu.com', password: 'password123',
        meta: { installation_address: '12 rue des Fleurs, 34000 Montpellier', peak_power_kwp: 9.0, connection_type: 'Autoconsommation avec revente' },
        tickets: [['Résidence Dupuis', 'RES-001', 'Préventif', 'Contrôle annuel', 'Vérification', 'normal', 'todo', 'L. Dupont', '2026-04-05', 0, 72]],
        docs: [['Attestation de production', 'Résidence Dupuis', '2026-01-05', null, 'valid']],
        prospects: [['Batterie Domestique', 'Mme Durand', 5, 4500, 'quote', '2026-03-23']],
        billing: [['Résidence Dupuis', 'EDF OA', 'Mars 2026', 312, 'EDF OA', 0.1269, 11.4, 'paid']],
      },
      {
        name: 'Marc Dubois', email: 'marc@nukunu.com', password: 'password123',
        meta: { installation_address: '45 avenue de la Mer, 13000 Marseille', peak_power_kwp: 6.0, connection_type: 'Vente totale' },
        tickets: [['Maison Dubois', 'RES-002', 'Correctif', 'Panneau endommagé', 'Grêle', 'warning', 'todo', 'Solaire Expert', '2026-03-28', 450, 24]],
        docs: [['Facture d\'installation', 'Maison Dubois', '2022-08-10', null, 'valid']],
        prospects: [['Borne VE', 'M. Dubois', 7, 1200, 'lead', '2026-03-27']],
        billing: [['Maison Dubois', 'EDF OA', 'Mars 2026', 850, 'EDF OA', 0.1269, 107.8, 'paid']],
      }
    ]
  }
];

async function seed() {
  console.log('🌱 Démarrage du Seed personnalisé Nukunu Solar...');
  try {
    for (const roleGroup of SEED_DATA) {
      for (const u of roleGroup.users) {
        const hash = await bcrypt.hash(u.password, 10);
        let res = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
        
        let userId;
        if (res.rows.length === 0) {
          res = await pool.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [u.name, u.email, hash, roleGroup.role]
          );
          userId = res.rows[0].id;
          console.log(`✅ Utilisateur créé: ${u.email} (${roleGroup.role})`);
        } else {
          userId = res.rows[0].id;
          await pool.query('DELETE FROM tickets WHERE user_id = $1', [userId]);
          await pool.query('DELETE FROM documents WHERE user_id = $1', [userId]);
          await pool.query('DELETE FROM prospects WHERE user_id = $1', [userId]);
          await pool.query('DELETE FROM billing_entries WHERE user_id = $1', [userId]);
          await pool.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);
          console.log(`ℹ️ Utilisateur existant nettoyé: ${u.email}`);
        }
        
        // Populate role specific table
        const rQuery = `
          INSERT INTO role_${roleGroup.role} (user_id, ${Object.keys(u.meta).join(', ')})
          VALUES ($1, ${Object.keys(u.meta).map((_, i) => `$${i + 2}`).join(', ')})
          ON CONFLICT (user_id) DO UPDATE SET ${Object.keys(u.meta).map(k => `${k} = EXCLUDED.${k}`).join(', ')}`;
        await pool.query(rQuery, [userId, ...Object.values(u.meta)]);

        // Insert relational data
        for (const item of u.tickets) {
          await pool.query(`INSERT INTO tickets (user_id, site_name, site_code, type, title, description, priority, status, tech, due_date, cost_np, sla_hours) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [userId, ...item]);
        }
        for (const item of u.docs) {
          await pool.query(`INSERT INTO documents (user_id, name, site_name, document_date, expiry_date, status) VALUES ($1,$2,$3,$4,$5,$6)`, [userId, ...item]);
        }
        for (const item of u.prospects) {
          await pool.query(`INSERT INTO prospects (user_id, name, contact, power_kwc, value_eur, stage, last_contact) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [userId, ...item]);
        }
        for (const item of u.billing) {
          await pool.query(`INSERT INTO billing_entries (user_id, site_name, contract_name, period_label, energy_kwh, tariff_label, tariff_rate, gross_revenue, payment_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [userId, ...item]);
        }
      }
    }
    console.log('\n✅ Seed complet et données relationnelles isolées par utilisateur !');
  } catch (err) {
    console.error('❌ Erreur lors du seed:', err);
  } finally {
    pool.end();
  }
}

seed();
