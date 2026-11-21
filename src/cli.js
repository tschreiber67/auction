// CLI: node src/cli.js [--seed N] [--bidders N] [--mode clock|sealed] [--step C] [--json]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearMarket } from './clearing.js';
import { generateMarket } from './data.js';

const HERE = fileURLToPath(import.meta.url);

export function parseArgs(argv) {
  const o = { seed: 1, bidders: 24, mode: 'clock', step: 10, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (['--seed', '--bidders', '--step'].includes(a)) {
      const v = argv[++i];
      if (v === undefined || !/^\d+$/.test(v)) throw new RangeError(`${a} needs a non-negative integer`);
      o[a.slice(2)] = Number(v);
    } else if (a === '--mode') {
      o.mode = argv[++i];
    } else throw new RangeError(`unknown argument ${a}`);
  }
  return o;
}

export function formatTable(out) {
  const pad = (s, n) => String(s).padStart(n);
  const widths = [7, 8, 6, 7, 10, 7];
  const head = ['supply', 'price', 'sold', 'unsold', 'revenue', 'eff'];
  const lines = [`seed=${out.seed} mode=${out.mode}`,
    'good'.padEnd(16) + head.map((h, i) => pad(h, widths[i])).join('')];
  for (const r of out.results) {
    lines.push(r.good.padEnd(16) + pad(r.supply, 7) + pad(r.price, 8) + pad(r.supply - r.unsold, 6) +
      pad(r.unsold, 7) + pad(r.revenue, 10) + pad(r.efficiency.toFixed(3), 7));
  }
  const t = out.totals;
  lines.push(`total revenue=${t.revenue} cents, sell-through=${(100 * t.sellThrough).toFixed(1)}%`);
  return lines.join('\n');
}

export function run(argv) {
  const o = parseArgs(argv);
  const out = clearMarket(generateMarket(o.seed, o.bidders), o.mode, o.step);
  return o.json ? JSON.stringify(out, null, 2) : formatTable(out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    console.error('error: ' + e.message);
    process.exitCode = 2;
  }
}
