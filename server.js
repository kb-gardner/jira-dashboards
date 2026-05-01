const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8090;
const PUBLIC = path.join(__dirname, 'public');

// Env-based Jira config
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
const JIRA_ORG_ID = process.env.JIRA_ORG_ID || '';
const JIRA_SITE_ID = process.env.JIRA_SITE_ID || '';
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || '';
const JIRA_SP_FIELD = process.env.JIRA_SP_FIELD || '';
const JIRA_DEPT_PRIORITY_FIELD = process.env.JIRA_DEPT_PRIORITY_FIELD || '';
const JIRA_SUBMISSION_FIELD = process.env.JIRA_SUBMISSION_FIELD || '';
const JIRA_DEPARTMENT_FIELD = process.env.JIRA_DEPARTMENT_FIELD || '';
const JIRA_BOARD_ID = process.env.JIRA_BOARD_ID || '';
const HAS_AUTH = !!(JIRA_EMAIL && JIRA_TOKEN);

// Static dashboard password
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'yomama';
const PASSWORD_HASH = crypto.createHash('sha256').update(DASHBOARD_PASSWORD).digest('hex');
const COOKIE_NAME = 'dash_auth';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ALLOWED_HEADERS = new Set([
  'authorization', 'content-type', 'accept',
  'x-requested-with', 'x-atlassian-token',
]);

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[COOKIE_NAME] === PASSWORD_HASH;
}

function loginPage(error) {
  const errHtml = error ? `<div class="err">${error}</div>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sprint Dashboard · Sign in</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #F8FAFC; color: #1E293B;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: #fff; border: 1px solid #E2E8F0; border-radius: 12px;
    padding: 32px; width: 100%; max-width: 360px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  h1 span { color: #2563EB; }
  p.sub { font-size: 12px; font-family: 'IBM Plex Mono', monospace; color: #64748B; margin-bottom: 20px; }
  label { display: block; font-size: 11px; font-family: 'IBM Plex Mono', monospace; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  input {
    width: 100%; background: #F1F5F9; border: 1px solid #E2E8F0; color: #1E293B;
    font-family: 'IBM Plex Mono', monospace; font-size: 13px;
    padding: 10px 14px; border-radius: 8px; outline: none;
  }
  input:focus { border-color: #2563EB; }
  button {
    margin-top: 14px; width: 100%; padding: 10px 22px; border-radius: 8px;
    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; background: #2563EB; color: #fff;
  }
  button:hover { background: #1D4ED8; }
  .err { margin-top: 12px; font-size: 12px; font-family: 'IBM Plex Mono', monospace; color: #B05050; }
</style>
</head>
<body>
  <div class="card">
    <h1>Sprint <span>Dashboard</span></h1>
    <p class="sub">Sign in to continue</p>
    <form method="POST" action="/login">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autofocus autocomplete="current-password" />
      <button type="submit">Sign in</button>
      ${errHtml}
    </form>
  </div>
</body>
</html>`;
}

function sendLogin(res, status, error) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(loginPage(error));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept,X-Requested-With');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlPath = req.url.split('?')[0];

  // Login endpoint
  if (urlPath === '/login') {
    if (req.method === 'GET') { sendLogin(res, 200); return; }
    if (req.method === 'POST') {
      const body = (await readBody(req)).toString('utf8');
      const params = new URLSearchParams(body);
      const password = params.get('password') || '';
      if (password === DASHBOARD_PASSWORD) {
        const cookie = `${COOKIE_NAME}=${PASSWORD_HASH}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`;
        res.writeHead(302, { 'Set-Cookie': cookie, 'Location': '/' });
        res.end();
        return;
      }
      sendLogin(res, 401, 'Incorrect password.');
      return;
    }
    res.writeHead(405); res.end(); return;
  }

  // Logout endpoint
  if (urlPath === '/logout') {
    const cookie = `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
    res.writeHead(302, { 'Set-Cookie': cookie, 'Location': '/login' });
    res.end();
    return;
  }

  // Allow favicon to load on the login page without being gated
  if (urlPath === '/favicon.svg' && !isAuthenticated(req)) {
    fs.readFile(path.join(PUBLIC, 'favicon.svg'), (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(data);
    });
    return;
  }

  // Auth gate
  if (!isAuthenticated(req)) {
    sendLogin(res, 401);
    return;
  }

  // Config endpoint
  if (urlPath === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasAuth: HAS_AUTH,
      baseUrl: JIRA_BASE_URL,
      orgId: JIRA_ORG_ID,
      siteId: JIRA_SITE_ID,
      projectKey: JIRA_PROJECT_KEY,
      storyPointsField: JIRA_SP_FIELD,
      deptPriorityField: JIRA_DEPT_PRIORITY_FIELD,
      submissionField: JIRA_SUBMISSION_FIELD,
      departmentField: JIRA_DEPARTMENT_FIELD,
      boardId: JIRA_BOARD_ID,
    }));
    return;
  }

  // Proxy endpoint
  if (req.url.startsWith('/proxy/')) {
    let target;
    try { target = new URL(req.url.slice(7)); }
    catch { res.writeHead(400); res.end('Bad URL'); return; }

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const opts = {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        method: req.method,
        headers: {},
      };

      for (const [k, v] of Object.entries(req.headers)) {
        if (ALLOWED_HEADERS.has(k.toLowerCase())) opts.headers[k] = v;
      }
      if (HAS_AUTH) {
        opts.headers['authorization'] = 'Basic ' + Buffer.from(JIRA_EMAIL + ':' + JIRA_TOKEN).toString('base64');
      }
      opts.headers.host = target.hostname;
      if (body.length) opts.headers['content-length'] = body.length;

      const transport = target.protocol === 'https:' ? https : http;
      const proxy = transport.request(opts, proxyRes => {
        const headers = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (!k.startsWith('access-control-')) headers[k] = v;
        }
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
      });
      proxy.on('error', e => { res.writeHead(502); res.end(e.message); });
      if (body.length) proxy.write(body);
      proxy.end();
    });
    return;
  }

  // Static files
  const filePath = path.join(PUBLIC, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
