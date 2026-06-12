const http = require('http');

const PORT = 8000;

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

const users = new Map();

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}

    // POST /api/auth/register
    if (req.method === 'POST' && url.pathname === '/api/auth/register') {
      if (users.has(data.email)) {
        return json(res, 409, { detail: 'A user with this email already exists' });
      }
      users.set(data.email, { id: 'mock-uuid-' + Date.now(), email: data.email, wset_level: data.wset_level || 'L2' });
      return json(res, 201, {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
      });
    }

    // POST /api/auth/login
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      if (!users.has(data.email)) {
        return json(res, 401, { detail: 'Invalid email or password' });
      }
      return json(res, 200, {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
      });
    }

    // GET /api/auth/me
    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return json(res, 401, { detail: 'Invalid or expired token' });
      }
      const email = [...users.keys()][0] || 'test@example.com';
      const user = users.get(email) || { id: 'mock-id', email, wset_level: 'L2', created_at: new Date().toISOString() };
      return json(res, 200, user);
    }

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { status: 'ok' });
    }

    json(res, 404, { detail: 'Not found' });
  });
});

server.listen(PORT, () => {
  console.log(`Mock API running at http://localhost:${PORT}`);
});
