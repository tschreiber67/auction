import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/prng.js';
import { generateMarket } from '../src/data.js';
import { route } from '../src/api.js';
import { startServer } from '../src/server.js';
import { run, parseArgs } from '../src/cli.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('prng is deterministic per seed and within [0,1)', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) {
    const x = a.next();
    assert.equal(x, b.next());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(createRng(1).next(), createRng(2).next());
});

test('prng int is inclusive and in range', () => {
  const r = createRng(9);
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(r.int(1, 3));
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('market is deterministic per seed', () => {
  assert.deepEqual(generateMarket(4), generateMarket(4));
  assert.notDeepEqual(generateMarket(4), generateMarket(5));
});

test('marginal values are positive and non-increasing', () => {
  const m = generateMarket(9, 60);
  for (const b of m.bidders) {
    for (const vs of Object.values(b.values)) {
      assert.ok(vs.every((v) => Number.isInteger(v) && v > 0));
      for (let i = 1; i < vs.length; i++) assert.ok(vs[i - 1] >= vs[i]);
    }
  }
});

test('market shape and bidder ids are unique', () => {
  const m = generateMarket(1, 24, 3);
  assert.equal(m.bidders.length, 24);
  assert.equal(m.goods.length, 3);
  assert.equal(new Set(m.bidders.map((b) => b.id)).size, 24);
});

test('generateMarket validates arguments', () => {
  assert.throws(() => generateMarket(1, 0), RangeError);
  assert.throws(() => generateMarket(1, 10, 9), RangeError);
  assert.throws(() => generateMarket(-1), RangeError);
});

test('API /api/clear ok', () => {
  const { status, payload } = route('/api/clear', 'seed=1&mode=sealed');
  assert.equal(status, 200);
  assert.equal(payload.mode, 'sealed');
  assert.equal(payload.results.length, 3);
});

test('API /api/market ok', () => {
  const { status, payload } = route('/api/market', 'seed=2&bidders=5&goods=1');
  assert.equal(status, 200);
  assert.equal(payload.bidders.length, 5);
  assert.equal(payload.goods.length, 1);
});

for (const qs of ['seed=abc', 'bidders=0', 'step=0', 'mode=dutch', 'goods=4']) {
  test(`API rejects bad input ${qs}`, () => {
    const { status, payload } = route('/api/clear', qs);
    assert.equal(status, 400);
    assert.ok(payload.error);
  });
}

test('API unknown path is 404', () => {
  assert.equal(route('/api/nope', '').status, 404);
});

test('CLI table lists every good and totals', () => {
  const out = run(['--seed', '1']);
  assert.match(out, /lowband-blocks/);
  assert.match(out, /highband-blocks/);
  assert.match(out, /total revenue=\d+ cents/);
});

test('CLI json output parses and respects seed', () => {
  assert.equal(JSON.parse(run(['--json', '--seed', '3'])).seed, 3);
});

test('CLI rejects bad arguments', () => {
  assert.throws(() => parseArgs(['--seed', 'x']), RangeError);
  assert.throws(() => parseArgs(['--nope']), RangeError);
});

test('CLI entrypoint runs as a subprocess', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'src', 'cli.js'), '--json', '--seed', '3'], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).seed, 3);
});

test('HTTP server serves the page and the API on a free port', async () => {
  const server = await startServer(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Dynamic Auction Simulator/);
    const api = await fetch(base + '/api/clear?seed=1&mode=clock&step=10');
    assert.equal(api.status, 200);
    assert.equal((await api.json()).results.length, 3);
    const bad = await fetch(base + '/api/clear?step=0');
    assert.equal(bad.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
