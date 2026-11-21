// Pure request routing: (path, query string) -> { status, payload }. Testable without sockets.
import { clearMarket } from './clearing.js';
import { generateMarket } from './data.js';

function intParam(q, key, def, lo, hi) {
  const raw = q.get(key);
  if (raw === null) return def;
  if (!/^-?\d+$/.test(raw)) throw new RangeError(`${key} must be an integer`);
  const v = Number(raw);
  if (v < lo || v > hi) throw new RangeError(`${key} must be ${lo}..${hi}`);
  return v;
}

export function route(path, query = '') {
  if (path !== '/api/market' && path !== '/api/clear') return { status: 404, payload: { error: 'not found' } };
  const q = new URLSearchParams(query);
  try {
    const seed = intParam(q, 'seed', 1, 0, 1e9);
    const nb = intParam(q, 'bidders', 24, 1, 500);
    const ng = intParam(q, 'goods', 3, 1, 3);
    const market = generateMarket(seed, nb, ng);
    if (path === '/api/market') return { status: 200, payload: market };
    const mode = q.get('mode') ?? 'clock';
    const step = intParam(q, 'step', 10, 1, 10000);
    return { status: 200, payload: clearMarket(market, mode, step) };
  } catch (e) {
    if (e instanceof RangeError) return { status: 400, payload: { error: e.message } };
    throw e;
  }
}
