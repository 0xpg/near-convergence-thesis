<p align="center"><img src=".github/dither.svg" alt="Dithered wave" width="100%"></p>

# Investment Thesis for NEAR

**Intent Is All You Need.** An investment research site on where NEAR sits between two emerging sources of demand, autonomous economic activity and institutional order flow, and how much revenue its infrastructure can capture from both.

Live: [near-convergence-thesis.pages.dev](https://near-convergence-thesis.pages.dev/)

## Pages

| Route | What it shows |
|---|---|
| `/` | The thesis in one screen: humans, agents, NEAR and institutions |
| `/thesis` | Convergence thesis, 3D investment framework, network map and **NEAR at a glance** |
| `/scenario-labs` | Scenario Lab: Bear, Base, Bull and Maximum cases from Intents volume, fees, institutional routing and AI services to token value, with sourced inputs, an uncertainty band and an out-of-sample backtest |

## Scenario Lab

The lab turns four drivers into a NEAR price at an exit date: Intents execution, institutional routing, AI services and institutional demand. Bear, Base and Bull are fixed input sets. Maximum is reverse-solved: it finds the AI billing needed to reach $400 by the exit date. Every case can be edited, and the link carries the edited state.

Each input shows its evidence:

- **Starting point.** Volume, gross fee rate and cash capture come from the last 30 days on Dune.
- **Growth cases.** Placed against the 3, 6 and 9 month growth record, with a robustness check across start dates.
- **Fees and capture.** Fee compression tested by regression with Newey-West errors. Capture before and after the fee switch compared with a Welch t-test.
- **Multiple.** Compared with revenue multiples across DefiLlama peer protocols and chains.
- **Discount rate.** 26.3% is kept as the default. A required return is shown beside it, derived from NEAR's beta to BTC and BTC+ETH since the US spot ETF launch, plus published crypto risk premia.
- **Uncertainty band.** 1,000 seeded paths (seed 20261114), using the volatility measured from monthly volume.
- **Backtest.** Walk-forward from earlier cutoffs. It reports where realized volume fell against the case envelope, including the months it missed.

The case model is deterministic and unchanged. The evidence layer sits beside it, so both can be rerun independently.

## Data

- **Dune** queries on the [NEAR Economic dashboard](https://dune.com/0xpanatagama/near-economic), embedded in At a Glance.
- **DefiLlama** NEAR investor-relations feed and public API, used to reconcile Intents volume, fees and retained revenue, and for peer revenue multiples and price history.
- **Binance** public market data for BTC, ETH and NEAR returns.
- **FRED** five-year Treasury yield (DGS5) as the risk-free rate.
- Every figure is frozen in `data/` with source hashes and can be recalculated from `analysis/`.

## Stack

React 19, TypeScript, Vite. Canvas dither rendering, no chart libraries. Static output.

## Run

Requires Node 22.18 or newer.

```bash
npm ci
npm test           # type check, data checks, models and scenes
npm run build      # outputs dist/
npm run preview    # http://127.0.0.1:4173
```

Rerun the Scenario Lab evidence from the archived sources:

```bash
node analysis/lab-baseline.mjs           # starting inputs and benchmarks -> data/lab-baseline.json
node analysis/lab-rigor/build.mjs        # statistics, backtest, peers, rate -> data/lab-rigor.json
node analysis/lab-rigor/build.mjs --check  # confirm the committed file matches
```

## Deploy

Every push to `main` runs the checks and deploys to Cloudflare Pages through GitHub Actions. Pull requests run the same checks without deploying. Manual deploy:

```bash
npm run build:public
npx wrangler pages deploy dist-public --project-name near-convergence-thesis --branch main
```

## Structure

```
src/        pages, components, models (TypeScript)
styles/     fonts and page stylesheets
data/       frozen snapshots and calculations
analysis/   reproduction scripts, archived sources and Dune SQL
scripts/    build and checks
```
