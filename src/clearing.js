// Single-good multi-unit clearing: ascending clock and sealed-bid uniform price.
// Baseline: every good clears independently, no cross-good or bidder constraints.
// Bidders are assumed truthful (bid = marginal value). Money is integer cents.

const byValueThenId = (a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

/** Units each bidder wants at `price` (marginal values >= price). Returns { bidderId: units }. */
export function demandAt(bidders, good, price) {
  const out = {};
  for (const b of bidders) {
    const n = (b.values[good] ?? []).filter((v) => v >= price).length;
    if (n) out[b.id] = n;
  }
  return out;
}

function unitBids(bidders, good) {
  const all = [];
  for (const b of bidders) for (const v of b.values[good] ?? []) all.push([v, b.id]);
  return all.sort(byValueThenId);
}

function finish(res, bidders, good) {
  res.welfare = sum(bidders.map((b) => sum((b.values[good] ?? []).slice(0, res.allocations[b.id] ?? 0))));
  const sold = sum(Object.values(res.allocations));
  res.revenue = res.price * sold;
  res.unsold = res.supply - sold;
  res.maxWelfare = sum(unitBids(bidders, good).slice(0, res.supply).map((t) => t[0]));
  res.efficiency = res.maxWelfare ? Math.round((res.welfare / res.maxWelfare) * 1e6) / 1e6 : 1;
  return res;
}

function newResult(good, mode, supply, price) {
  return { good, mode, supply, price, allocations: {}, unsold: 0, rounds: [], rationed: 0,
    revenue: 0, welfare: 0, maxWelfare: 0, efficiency: 1 };
}

/**
 * Ascending clock. Price rises by `step` while demand > supply.
 * Clearing price is the last price with excess demand (or the reserve if never in excess).
 * Units valued >= the first no-excess price are all awarded; remaining units go to the
 * highest dropped values (ties by bidder id).
 */
export function clockAuction(bidders, good, supply, reserve, step) {
  if (!Number.isInteger(step) || step <= 0) throw new RangeError('step must be a positive integer');
  if (supply < 0 || reserve < 0) throw new RangeError('supply and reserve must be non-negative');
  const rounds = [];
  let price = reserve;
  let prev = null;
  let d;
  let total;
  for (;;) {
    d = demandAt(bidders, good, price);
    total = sum(Object.values(d));
    rounds.push({ price, demand: total });
    if (total <= supply) break;
    prev = price;
    price += step;
  }
  const res = newResult(good, 'clock', supply, reserve);
  res.rounds = rounds;
  const alloc = { ...d };
  if (prev !== null) {
    const left = supply - total;
    const dropped = [];
    for (const b of bidders) {
      for (const v of b.values[good] ?? []) if (v >= prev && v < price) dropped.push([v, b.id]);
    }
    dropped.sort(byValueThenId);
    for (const [, id] of dropped.slice(0, left)) alloc[id] = (alloc[id] ?? 0) + 1;
    res.rationed = Math.min(left, dropped.length);
    res.price = prev;
  }
  res.allocations = alloc;
  return finish(res, bidders, good);
}

/** Top `supply` unit bids >= reserve win; price = highest losing bid (or reserve). */
export function sealedUniform(bidders, good, supply, reserve) {
  const bids = unitBids(bidders, good).filter((t) => t[0] >= reserve);
  const winners = bids.slice(0, supply);
  const losers = bids.slice(supply);
  const price = losers.length ? Math.max(reserve, losers[0][0]) : reserve;
  const res = newResult(good, 'sealed', supply, price);
  for (const [, id] of winners) res.allocations[id] = (res.allocations[id] ?? 0) + 1;
  return finish(res, bidders, good);
}

/** Clear every good independently. Returns per-good results and totals. */
export function clearMarket(market, mode = 'clock', step = 10) {
  if (mode !== 'clock' && mode !== 'sealed') throw new RangeError("mode must be 'clock' or 'sealed'");
  const results = market.goods.map((g) =>
    mode === 'clock'
      ? clockAuction(market.bidders, g.name, g.units, g.reserve, step)
      : sealedUniform(market.bidders, g.name, g.units, g.reserve));
  const supply = sum(market.goods.map((g) => g.units));
  const sold = supply - sum(results.map((r) => r.unsold));
  return {
    seed: market.seed,
    mode,
    results,
    totals: {
      revenue: sum(results.map((r) => r.revenue)),
      welfare: sum(results.map((r) => r.welfare)),
      unitsSold: sold,
      unitsSupplied: supply,
      sellThrough: supply ? Math.round((sold / supply) * 1e4) / 1e4 : 0,
    },
  };
}
