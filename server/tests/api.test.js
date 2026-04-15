const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');

test('Nukunu Solar API Tests', async (t) => {
  const PORT = 3015; // Un port dédié pour éviter les collisions avec un serveur existant
  const URL = `http://localhost:${PORT}`;
  let serverProcess;

    // Tuer tout processus occupant le port 3015 au démarrage (sécurité supplémentaire)
    try { spawn('fuser', ['-k', '3015/tcp']); } catch(e) {}

    // Démarrer le serveur avant les tests
    t.before(async () => {
      serverProcess = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        env: { 
          ...process.env, 
          PORT, 
          NODE_ENV: 'test',
          DB_USER: process.env.DB_USER || 'nukunu_admin',
          DB_PASSWORD: process.env.DB_PASSWORD || 'nukunu_password',
          DB_NAME: process.env.DB_NAME || 'nukunu_solar',
          DB_HOST: process.env.DB_HOST || 'localhost',
          DB_PORT: '5432'
        },
        stdio: 'inherit' // on veut voir les erreurs en CI
      });

      // Boucle d'attente intelligente (Retry loop)
      let retries = 10;
      let success = false;
      while (retries > 0 && !success) {
        try {
          const res = await fetch(`${URL}/api/health`);
          if (res.ok) {
            success = true;
            break;
          }
        } catch (e) {
          retries--;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      if (!success) throw new Error('Le serveur API n\'a pas démarré à temps.');
    });

    // Tuer le processus serveur après les tests
    t.after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  await t.test('GET /api/health should return 200 OK', async () => {
    const res = await fetch(`${URL}/api/health`);
    assert.strictEqual(res.status, 200, 'Health endpoint responds with 200');
    const json = await res.json();
    assert.strictEqual(json.ok, true, 'Property ok is true');
  });

  await t.test('POST /api/auth/register fails with missing fields', async () => {
    const res = await fetch(`${URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400, 'Responds with 400 Bad Request');
    const json = await res.json();
    assert.strictEqual(json.error, 'Tous les champs sont requis.');
  });

  await t.test('POST /api/auth/login fails with invalid credentials', async () => {
    const res = await fetch(`${URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@nukunu.com', password: 'wrongpassword' })
    });
    // Can be 401 or 404 depending on if email exists, in our case 404 since fake doesn't exist
    const json = await res.json();
    assert.ok(json.error, 'An error message is provided');
  });

  await t.test('Full Auth Flow: Register -> Login -> Fetch Protected Data', async () => {
    const uniqueEmail = `test_${Date.now()}@nukunu.com`;
    
    // 1. Register
    const regRes = await fetch(`${URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!',
        name: 'Test User',
        role: 'particulier'
      })
    });
    assert.strictEqual(regRes.status, 201, 'User successfully registered');

    // 2. Login
    const loginRes = await fetch(`${URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!'
      })
    });
    assert.strictEqual(loginRes.status, 200, 'User successfully logged in');
    const loginJson = await loginRes.json();
    const token = loginJson.token;
    assert.ok(token, 'JWT token received');

    // 3. Fetch Protected Data (e.g., plants)
    const dataRes = await fetch(`${URL}/api/plants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(dataRes.status, 200, 'Successfully fetched protected plants data');
    const dataJson = await dataRes.json();
    assert.ok(Array.isArray(dataJson), 'Data is an array of plants');
  });
});
