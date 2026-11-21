import test from 'node:test';
import assert from 'node:assert/strict';
import { clockAuction, sealedUniform, demandAt, clearMarket } from '../src/clearing.js';
import { generateMarket } from '../src/data.js';

const G = 'g';
const mk = (...lists) => lists.map((v, i) => ({ id: 'B' + i, segment: 'small', values: { [G]: v } }));

test('demandAt counts values at or above price', () => {
  const bs = mk([100, 80, 50], [90]);
  assert.deepEqual(demandAt(bs, G, 80), { B0: 2, B1: 1 });
  assert.deepEqual(demandAt(bs, G, 101), {});
});

test('clock with no excess demand sells at reserve', () => {
  const r = clockAuction(mk([100, 90], [80]), G, 10, 50, 5);
  assert.equal(r.price, 50);
  assert.equal(r.unsold, 7);
  assert.deepEqual(r.allocations, { B0: 2, B1: 1 });
  assert.equal(r.rounds.length, 1);
});

test('clock clears at the exact step boundary', () => {
  // supply 2. demand: p<=40:4, 50..60:3, 70..90:2 -> first no-excess price 70, last excess 60
  const r = clockAuction(mk([100, 60], [90, 40]), G, 2, 0, 10);
  assert.equal(r.rounds.at(-1).price, 70);
  assert.equal(r.price, 60);
  assert.deepEqual(r.allocations, { B0: 1, B1: 1 });
  assert.equal(r.rationed, 0);
  assert.equal(r.revenue, 120);
});

test('clock rationing goes to highest dropped values', () => {
  // supply 2, step 20 from reserve 0. At 100 demand is 1, one unit left, prev=80.
  // Dropped values in [80,100): 95,92,91 -> 95 (B1) wins.
  const r = clockAuction(mk([100], [95], [92], [91]), G, 2, 0, 20);
  assert.equal(r.price, 80);
  assert.deepEqual(r.allocations, { B0: 1, B1: 1 });
  assert.equal(r.rationed, 1);
});

test('clock rationing ties break by bidder id', () => {
  const r = clockAuction(mk([90], [90], [90]), G, 2, 0, 100);
  assert.equal(r.rationed, 2);
  assert.deepEqual(r.allocations, { B0: 1, B1: 1 });
  assert.equal(r.price, 0);
});

test('clock price never exceeds a winning unit value', () => {
  const m = generateMarket(7);
  for (const g of m.goods) {
    const r = clockAuction(m.bidders, g.name, g.units, g.reserve, 7);
    for (const b of m.bidders) {
      const k = r.allocations[b.id] ?? 0;
      for (const v of (b.values[g.name] ?? []).slice(0, k)) assert.ok(v >= r.price);
    }
  }
});

test('clock never oversells and conserves units over 15 seeds', () => {
  for (let seed = 0; seed < 15; seed++) {
    const m = generateMarket(seed, 30);
    for (const g of m.goods) {
      const r = clockAuction(m.bidders, g.name, g.units, g.reserve, 13);
      const sold = Object.values(r.allocations).reduce((a, b) => a + b, 0);
      assert.ok(sold <= g.units);
      assert.equal(sold + r.unsold, g.units);
    }
  }
});

test('clock rejects a non-positive step', () => {
  assert.throws(() => clockAuction(mk([5]), G, 1, 0, 0), RangeError);
});

test('sealed price is the highest losing bid', () => {
  const r = sealedUniform(mk([100, 70], [90, 60]), G, 2, 0);
  assert.deepEqual(r.allocations, { B0: 1, B1: 1 });
  assert.equal(r.price, 70);
  assert.equal(r.revenue, 140);
});

test('sealed respects reserve and leaves units unsold', () => {
  const r = sealedUniform(mk([100, 40], [30]), G, 5, 50);
  assert.deepEqual(r.allocations, { B0: 1 });
  assert.equal(r.unsold, 4);
  assert.equal(r.price, 50);
});

test('sealed is fully efficient under truthful bidding', () => {
  const m = generateMarket(3);
  for (const g of m.goods) assert.equal(sealedUniform(m.bidders, g.name, g.units, 0).efficiency, 1);
});

test('sealed tie at the cut breaks by bidder id', () => {
  const r = sealedUniform(mk([50], [50], [50]), G, 2, 0);
  assert.deepEqual(r.allocations, { B0: 1, B1: 1 });
  assert.equal(r.price, 50);
});

test('clock with step 1 and sealed reach the same welfare', () => {
  const m = generateMarket(5);
  for (const g of m.goods) {
    const c = clockAuction(m.bidders, g.name, g.units, 0, 1);
    const s = sealedUniform(m.bidders, g.name, g.units, 0);
    assert.equal(c.welfare, s.welfare);
  }
});

test('efficiency stays between 0 and 1', () => {
  for (const r of clearMarket(generateMarket(11), 'clock', 25).results) {
    assert.ok(r.efficiency >= 0 && r.efficiency <= 1);
  }
});

test('clearMarket totals add up and results are deterministic', () => {
  const a = clearMarket(generateMarket(2), 'clock', 10);
  const b = clearMarket(generateMarket(2), 'clock', 10);
  assert.deepEqual(a, b);
  assert.equal(a.totals.revenue, a.results.reduce((s, r) => s + r.revenue, 0));
  assert.ok(a.totals.unitsSold <= a.totals.unitsSupplied);
});

test('clearMarket rejects an unknown mode', () => {
  assert.throws(() => clearMarket(generateMarket(1), 'dutch'), RangeError);
});
