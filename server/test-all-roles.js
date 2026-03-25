const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const users = [
  { email: 'installateur@nukunu.com', password: 'password123', targetRole: 'installateur' },
  { email: 'fonds@nukunu.com', password: 'password123', targetRole: 'fonds' },
  { email: 'industriel@nukunu.com', password: 'password123', targetRole: 'industriel' },
  { email: 'particulier@nukunu.com', password: 'password123', targetRole: 'particulier' }
];

async function run() {
  console.log('🔍 Démarrage de la vérification pour tous les rôles...\n');
  let allPass = true;

  for (const u of users) {
    try {
      const loginRes = await request({
        hostname: '127.0.0.1', port: 3002, path: '/api/auth/login',
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      }, { email: u.email, password: u.password });

      if (loginRes.status !== 200) {
        console.error(`❌ [${u.targetRole}] Login failed:`, loginRes.data);
        allPass = false;
        continue;
      }
      
      const token = loginRes.data.token;
      
      const dashRes = await request({
        hostname: '127.0.0.1', port: 3002, path: '/api/settings/dashboard_data',
        method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
      });

      const db = dashRes.data.payload;
      const role = u.targetRole;
      
      const hasSites = Array.isArray(db.sites[role]) && db.sites[role].length > 0;
      const hasKpi = !!db.kpi[role]; // should be an object
      const hasESG = !!db.reporting.esg[role];
      const hasChecklist = Array.isArray(db.conformite.checklist[role]);

      console.log(`👤 Rôle : ${role.toUpperCase()}`);
      console.log(`  - Sites présents (${role}): ${hasSites ? '✅ ' + db.sites[role].length + ' sites' : '❌ MANQUANT'}`);
      console.log(`  - KPI présent (${role}): ${hasKpi ? '✅' : '❌ MANQUANT'}`);
      console.log(`  - ESG présent (${role}): ${hasESG ? '✅' : '❌ MANQUANT'}`);
      console.log(`  - Conformité présente (${role}): ${hasChecklist ? '✅' : '❌ MANQUANT'}`);
      console.log('');

      if (!hasSites || !hasKpi || !hasESG || !hasChecklist) {
        allPass = false;
      }

    } catch (err) {
      console.error(`❌ Erreur critique pour ${u.targetRole}:`, err.message);
      allPass = false;
    }
  }
  
  if (allPass) {
    console.log('🎉 TOUS LES RÔLES ONT LEURS DONNÉES PARFAITEMENT RESTAURÉES!');
  } else {
    console.log('⚠️ Certaines données sont toujours manquantes.');
  }
}
run();
