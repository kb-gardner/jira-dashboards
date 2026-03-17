const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

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
const HAS_AUTH = !!(JIRA_EMAIL && JIRA_TOKEN);

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

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept,X-Requested-With');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Config endpoint
  if (req.url === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasAuth: HAS_AUTH,
      baseUrl: JIRA_BASE_URL,
      orgId: JIRA_ORG_ID,
      siteId: JIRA_SITE_ID,
      projectKey: JIRA_PROJECT_KEY,
      storyPointsField: JIRA_SP_FIELD,
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
  const urlPath = req.url.split('?')[0];
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
