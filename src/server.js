// node:http server: JSON API plus static UI. No auth, no outbound network. Binds 127.0.0.1.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from './api.js';

const HERE = fileURLToPath(import.meta.url);
const INDEX = path.join(path.dirname(HERE), '..', 'static', 'index.html');

export function createServer() {
  return http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'method not allowed' }));
    }
    if (u.pathname === '/' || u.pathname === '/index.html') {
      const html = await readFile(INDEX);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
    const { status, payload } = route(u.pathname, u.search.slice(1));
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });
}

export function startServer(port = Number(process.env.AUCTION_PORT ?? 8108)) {
  const server = createServer();
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  const server = await startServer();
  console.log(`Dynamic Auction Simulator on http://127.0.0.1:${server.address().port}`);
}
