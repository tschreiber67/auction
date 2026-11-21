Dynamic Auction Simulator 
This repo is a dynamic auction simulator.  It runs Node 22, ES modules, zero npm dependencies (node:http, node:test, node:assert). There are synthetic seeded bidders and inventory. The self-contained PRNG (mulberry32, src/prng.js) where the same seed gives identical market and results.  All prices are integer cents. There are no payments, accounts, login or network calls.  The auction has three goods (spectrum-style licence blocks): lowband-blocks (24 units, reserve 500), midband-blocks (60, reserve 80), highband-blocks (25, reserve 200).  Each bidder has, per good (or none), a non-increasing list of marginal unit values and a segment (small/mid/large).

CLEARING MODES (src/clearing.js)
- clock: ascending clock. Price starts at reserve, rises by step cents while demand > supply.
  Clearing price = last price with excess demand (reserve if never in excess).
  Units valued at or above the first no-excess price are all awarded. Leftover units go to the highest
  dropped values (ties by bidder id). All winners pay the single price.
- sealed: sealed-bid uniform price. Top unit bids >= reserve win. Price = highest losing bid, else reserve.
- Reported per good: price, units sold/unsold, rationed units, revenue, welfare, efficiency (welfare / best possible welfare).
- Bidders are assumed truthful (bid = value).

RUN 
- npm start                                        UI + API at http://127.0.0.1:8108 (env AUCTION_PORT)
- node src/cli.js --seed 1 --mode clock --step 10  table to stdout
- node src/cli.js --seed 1 --mode sealed --json    JSON to stdout

API (GET, no auth)
- /api/market?seed=1&bidders=24&goods=3
- /api/clear?seed=1&bidders=24&goods=3&mode=clock|sealed&step=10
- bad input returns 400 with {"error": ...}

TESTS
- npm test        expected: 35 tests, 35 pass, 0 fail
- tests/clearing.test.js (clock, sealed, rationing, invariants), tests/data_api.test.js (PRNG, generator, API route, CLI, HTTP server)

LIMITATIONS
- Each good clears independently. No bidder budgets, caps, minimum lot sizes, bundles, cross-good dependencies or capacity/compatibility constraints.
- Truthful bidding only; no strategic bidding or activity rules.
- Single price per good; no pay-as-bid, fairness measures or settlement audit.
- Clock price increments are fixed; one auction per run.

LAYOUT
- src/prng.js, data.js generator, clearing.js algorithms, api.js routing, server.js HTTP, cli.js CLI
- static/index.html UI (results table plus demand-vs-price SVG per good)
- tests/
