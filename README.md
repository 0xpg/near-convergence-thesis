<p align="center"><img src=".github/dither.svg" alt="Dithered wave" width="100%"></p>

# Investment Thesis for NEAR

**Intent Is All You Need.** An investment research site on where NEAR sits between two emerging sources of demand, autonomous economic activity and institutional order flow, and how much revenue its infrastructure can capture from both.

Live: [near-convergence-thesis.pages.dev](https://near-convergence-thesis.pages.dev/)

## Pages

| Route | What it shows |
|---|---|
| `/` | The thesis in one screen: humans, agents, NEAR and institutions |
| `/thesis` | Convergence thesis, 3D investment framework, network map and **NEAR at a glance** |
| `/lab` | Scenario Lab: ten draggable models from volume to fees to token demand (mock baseline) |
| `/research`, `/methodology` | Evidence ledger and how to reproduce every number |

## Data

- **Dune** queries on the [NEAR Economic dashboard](https://dune.com/0xpanatagama/near-economic), embedded in At a Glance.
- **DefiLlama** NEAR investor-relations feed and public API, used to reconcile Intents volume, fees and retained revenue.
- Every figure is frozen in `data/` with source hashes and can be recalculated from `analysis/`.

## Stack

React 19, TypeScript, Vite. Canvas dither rendering, no chart libraries. Static output.

## Run

Requires Node 22.18 or newer.

```bash
npm ci
npm test           # type check, models and scenes
npm run build      # outputs dist/
npm run preview    # http://127.0.0.1:4173
```

## Deploy

Every push to `main` runs the checks and deploys to Cloudflare Pages through GitHub Actions. Manual deploy:

```bash
npm run build:public
npx wrangler pages deploy dist-public --project-name near-convergence-thesis --branch main
```

## Structure

```
src/        pages, components, models (TypeScript)
styles/     page stylesheets and fonts
data/       frozen snapshots and calculations
analysis/   reproduction scripts and Dune SQL
scripts/    build and checks
```
