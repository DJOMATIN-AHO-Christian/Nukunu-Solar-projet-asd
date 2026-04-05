const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }); }
        catch (_e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const users = [
  { name: 'Alice (Installateur)', email: 'alice@nukunu.com', password: 'password123', role: 'installateur' },
  { name: 'Fonds User', email: 'fonds@nukunu.com', password: 'password123', role: 'fonds' },
  { name: 'Industriel User', email: 'industriel@nukunu.com', password: 'password123', role: 'industriel' },
  { name: 'Particulier User', email: 'particulier@nukunu.com', password: 'password123', role: 'particulier' }
];

async function verifyRole(u) {
  console.log(`\n--- VÉRIFICATION PROFONDE : ${u.name.toUpperCase()} ---`);
  
  // 1. Auth
  const login = await request({
    hostname: '127.0.0.1', port: 3002, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: u.email, password: u.password });

  if (login.status !== 200) {
    console.log(`❌ Login échoué: ${JSON.stringify(login.data)}`);
    return false;
  }
  const token = login.data.token;
  const headers = { 'Authorization': 'Bearer ' + token };

  // 2. Dashboard Data (Nested check)
  const dash = await request({ hostname: '127.0.0.1', port: 3002, path: '/api/settings/dashboard_data', method: 'GET', headers });
  const d = dash.data.payload;
  
  const checks = [
    { label: 'Sites (Nested)', val: !!(d.sites && d.sites[u.role] && d.sites[u.role].length > 0) },
    { label: 'Alerts (Nested)', val: !!(d.alerts && d.alerts[u.role]) }, // Can be empty but object must exist
    { label: 'KPIs (Nested)', val: !!(d.kpi && d.kpi[u.role]) },
    { label: 'Warranties', val: !!(d.warranties && d.warranties.length > 0) },
    { label: 'Reporting (ESG-Nested)', val: !!(d.reporting && d.reporting.esg && d.reporting.esg[u.role]) },
    { label: 'Conformité (Checklist-Nested)', val: !!(d.conformite && d.conformite.checklist && d.conformite.checklist[u.role]) },
    { label: 'Optimisation (Battery-Nested)', val: !!(d.optimisation && d.optimisation.batteryConfig && d.optimisation.batteryConfig[u.role]) },
  ];

  checks.forEach(c => console.log(`  [DASH] ${c.label.padEnd(25)}: ${c.val ? '✅' : '❌'}`));

  // 3. Relational Endpoints
  const endpoints = [
    { path: '/api/tickets', key: 'tickets' },
    { path: '/api/documents', key: 'documents' },
    { path: '/api/prospects', key: 'prospects' },
    { path: '/api/billing', key: 'entries' }
  ];

  for (const ep of endpoints) {
    const res = await request({ hostname: '127.0.0.1', port: 3002, path: ep.path, method: 'GET', headers });
    const count = Array.isArray(res.data[ep.key]) ? res.data[ep.key].length : 0;
    console.log(`  [API]  ${ep.path.padEnd(25)}: ${count > 0 ? '✅ (' + count + ' items)' : '⚠️ (0 item)'}`);
  }

  return checks.every(c => c.val);
}

async function run() {
  let success = true;
  for (const u of users) {
    const res = await verifyRole(u);
    if (!res) success = false;
  }
  
  console.log('\n=========================================');
  if (success) {
    console.log('🎉 TOUTES LES DONNÉES SONT VÉRIFIÉES ET CONFORMES !');
  } else {
    console.log('❌ CERTAINES STRUCTURES SONT ENCORE INCORRECTES.');
  }
  console.log('=========================================\n');
}

run();
