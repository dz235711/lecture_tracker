import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AppError, openStore, root, maximumBodyBytes } from './store.mjs';

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function sendJson(response, value, status = 200, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(value));
}
async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new AppError(415, 'Expected a timetable.');
  let bytes = 0; const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes <= maximumBodyBytes) chunks.push(chunk);
  }
  if (bytes > maximumBodyBytes) throw new AppError(413, 'This timetable is too large.');
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError(400, 'The timetable could not be read.'); }
}
export async function startLedger({ port = 3000, databasePath, staticDirectory = resolve(root, 'dist'), development = false } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Choose a port between 0 and 65535.');
  const store = openStore(databasePath);
  const assetsRoot = resolve(staticDirectory);
  let vite;
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    try {
      const localPort = request.socket.localPort;
      const hosts = new Set([`127.0.0.1:${localPort}`, `localhost:${localPort}`]);
      if (!hosts.has(request.headers.host?.toLowerCase())) throw new AppError(403, 'Open the app through its localhost address.');
      const origin = `http://${request.headers.host}`;
      const url = new URL(request.url || '/', origin);
      if (url.origin !== origin) throw new AppError(403, 'This request is not allowed.');
      if (url.pathname === '/api/planner') {
        if (request.method === 'GET') { sendJson(response, store.load()); return; }
        if (request.method === 'PUT') {
          if (!new Set([...hosts].map(host => `http://${host}`)).has(request.headers.origin) || request.headers['sec-fetch-site'] === 'cross-site') throw new AppError(403, 'This save request is not allowed.');
          const body = await readJson(request);
          if (body?.data?.schemaVersion !== 2) throw new AppError(409, 'The app has been updated. Reload to use courses and shared links.');
          sendJson(response, store.save(body.data, body.revision)); return;
        }
        sendJson(response, { error: 'This action is not supported.' }, 405, { Allow: 'GET, PUT' }); return;
      }
      if (url.pathname === '/api/backup') {
        if (request.method !== 'GET') { sendJson(response, { error: 'This action is not supported.' }, 405, { Allow: 'GET' }); return; }
        sendJson(response, { format: 'lecture-ledger', version: 2, data: store.load().data }, 200, { 'Content-Disposition': 'attachment; filename="lecture-ledger-backup.json"' }); return;
      }
      if (url.pathname.startsWith('/api/')) throw new AppError(404, 'This page does not exist.');
      if (!['GET', 'HEAD'].includes(request.method)) throw new AppError(405, 'This action is not supported.');
      if (vite) { vite.middlewares(request, response, () => { if (!response.writableEnded) { response.writeHead(404); response.end('Not found'); } }); return; }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new AppError(400, 'This address could not be read.'); }
      if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) throw new AppError(404, 'This page does not exist.');
      const filename = pathname === '/' ? resolve(assetsRoot, 'index.html') : resolve(assetsRoot, `.${pathname}`);
      if (filename !== assetsRoot && !filename.startsWith(assetsRoot + sep)) throw new AppError(404, 'This page does not exist.');
      let content;
      try { if (!(await stat(filename)).isFile()) throw new Error(); content = await readFile(filename); }
      catch { throw new AppError(404, 'This page does not exist. Build the app with npm run build if this is your first run.'); }
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(filename)] || 'application/octet-stream', 'Cache-Control': filename.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      sendJson(response, { error: error instanceof AppError ? error.message : 'Your local data could not be accessed. Please try again.' }, error instanceof AppError ? error.status : 503);
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  try {
    if (development) {
      const { createServer: createViteServer } = await import('vite');
      vite = await createViteServer({ configFile: resolve(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
    }
    await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  } catch (error) { await vite?.close(); store.close(); throw error; }
  const address = server.address();
  let closing;
  return { server, store, origin: `http://127.0.0.1:${address.port}`, close() {
    if (!closing) closing = (async () => { await vite?.close(); await new Promise(done => { server.close(done); server.closeIdleConnections(); }); store.close(); })();
    return closing;
  } };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const development = process.argv.includes('--dev');
  startLedger({ port: Number(process.env.PORT || 3000), development }).then(app => {
    console.log(`Lecture Ledger is running at ${app.origin}/`);
    console.log(`Data is saved in ${app.store.filename}`);
    const stop = async () => { await app.close(); process.exit(0); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  }).catch(error => { console.error(error.code === 'EADDRINUSE' ? 'That local port is in use. Choose another with PORT=3001 ./start.sh.' : error.message); process.exitCode = 1; });
}
