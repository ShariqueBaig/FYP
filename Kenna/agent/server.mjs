// Zero-dependency static server for the prebuilt demo bundle (../demo).
//
// The harness is served straight from its source (../fyp-mvp/harness.js), so the
// served harness can never be stale relative to the repo. The bundle's
// index.html already carries <script src="/fyp-harness.js">.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(HERE, '..', 'demo');
const OVERRIDES = {
  '/fyp-harness.js': path.resolve(HERE, '..', 'fyp-mvp', 'harness.js'),
  '/fyp-html2canvas.min.js': path.resolve(HERE, '..', 'fyp-mvp', 'vendor', 'html2canvas.min.js'),
};
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.map': 'application/json',
};

export function startServer(port = 0) {
  if (!fs.existsSync(path.join(DEMO, 'index.html'))) {
    throw new Error('demo/index.html is missing - run "bash fyp-mvp/build-demo.sh" (needs the app repo) or pull the prebuilt demo/.');
  }
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = OVERRIDES[urlPath];
    if (!file) {
      file = path.join(DEMO, path.normalize(urlPath).replace(/^([/\\])+/, ''));
      if (!file.startsWith(DEMO)) { res.writeHead(403).end(); return; } // no path traversal
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DEMO, 'index.html');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', // never serve a stale bundle or harness
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, url: 'http://127.0.0.1:' + server.address().port }));
  });
}

// `node agent/server.mjs [port]` - serve for a human or a separate browser.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startServer(Number(process.argv[2]) || 8081);
  console.log('FYP demo: ' + url + '/?demo=1');
}
