// Deterministic synthetic market generator. All money is integer cents. Synthetic bidders only.
import { createRng } from './prng.js';

// Spectrum-style licence blocks: name, units on offer, reserve (cents per block).
export const GOOD_TEMPLATES = [
  { name: 'lowband-blocks', units: 24, reserve: 500 },
  { name: 'midband-blocks', units: 60, reserve: 80 },
  { name: 'highband-blocks', units: 25, reserve: 200 },
];
export const SEGMENTS = ['small', 'mid', 'large'];
const MAX_UNITS = { small: 3, mid: 8, large: 16 };

export function generateMarket(seed = 1, nBidders = 24, nGoods = 3) {
  if (!Number.isInteger(nGoods) || nGoods < 1 || nGoods > GOOD_TEMPLATES.length) {
    throw new RangeError(`goods must be 1..${GOOD_TEMPLATES.length}`);
  }
  if (!Number.isInteger(nBidders) || nBidders < 1 || nBidders > 500) {
    throw new RangeError('bidders must be 1..500');
  }
  if (!Number.isInteger(seed) || seed < 0) throw new RangeError('seed must be a non-negative integer');
  const rng = createRng(seed);
  const goods = GOOD_TEMPLATES.slice(0, nGoods).map((g) => ({ ...g }));
  const bidders = [];
  for (let i = 0; i < nBidders; i++) {
    const r = rng.next();
    const segment = r < 0.5 ? 'small' : r < 0.8 ? 'mid' : 'large';
    const values = {};
    for (const g of goods) {
      if (rng.next() < 0.25) continue; // not interested in this good
      const base = g.reserve * rng.uniform(0.6, 3.0);
      const decay = rng.uniform(0.8, 0.97);
      const n = rng.int(1, MAX_UNITS[segment]);
      const list = [];
      let v = base;
      for (let k = 0; k < n; k++) {
        list.push(Math.floor(v)); // non-increasing marginal values
        v *= decay;
      }
      values[g.name] = list;
    }
    bidders.push({ id: 'B' + String(i).padStart(3, '0'), segment, values });
  }
  return { seed, goods, bidders };
}
