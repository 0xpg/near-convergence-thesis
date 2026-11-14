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

The lab asks a simple question: if NEAR keeps earning revenue from the activity it settles, what could the token be worth? It builds that answer from four sources of demand: trading through NEAR Intents, institutions routing orders, AI services, and institutions holding the token.

There are four reference cases. Bear, Base and Bull each describe a different future. Maximum works backwards from an ambitious price target to show what would have to be true to reach it. Every input can be changed, and a shared link keeps your version.

Each assumption is shown next to the evidence for it:

- **Where we start.** Today's activity, fees and revenue, taken from public onchain data.
- **How fast it grows.** Each case's growth is compared with what NEAR Intents has actually done so far.
- **Fees and revenue kept.** Checks whether fees fall as activity grows, and how much of each fee the protocol keeps.
- **What the market pays for revenue.** NEAR is compared with other crypto protocols and chains, alongside the historical record of what happens to unusually high valuations over time.
- **The return an investor should demand.** The rate used to bring future value back to today is set against published crypto valuations and venture-stage benchmarks.
- **How wide the range is.** A band shows how much results could swing with realistic volatility.
- **Whether it has held up.** The cases are tested against what actually happened since launch, including where they missed.

The project is young and the history is short, so every result is a hypothesis to test, not a forecast. The case model and the evidence behind it are kept separate, and both can be rerun from the archived data.

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
