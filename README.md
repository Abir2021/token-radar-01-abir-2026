# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Abir2021/token-radar-01-abir-2026/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Abir2021/token-radar-01-abir-2026/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

[![License: MIT](https://img.shields.io/badge/license-MIT-8ebd42.svg)](LICENSE)
[![Project](https://img.shields.io/badge/project-token--radar--01--abir--2026-171b19.svg)](#token-radar)

An offline dashboard ranking every protocol in the sealed snapshot by a comparable implied-value scenario, with a detail page and a cautious, cost/time-aware field plan for each row. The $50M watchlist is a coverage floor, not the board's boundary. A “no token recorded” label describes DefiLlama's record as of the snapshot date; it is not proof that a token does not exist. Nothing here predicts launches, airdrops, rewards, or investment returns.

## Run

Requires Node.js 22.23.5. The program uses only Node's built-in modules and the official dossier helper in `vendor/`; it makes no network requests.

```sh
node main.ts
```

By default the entry reads `/input/snapshot.json` and writes `/output/board.json`, `/output/dashboard/`, `/output/screenshots/`, and `/output/dossier.json`. For local development, paths can be overridden without changing the sealed input:

```sh
SNAPSHOT_PATH=/path/to/snapshot.json OUTPUT_DIR=./output node main.ts
```

The page and compressed local protocol data are self-contained in `dashboard/`. Open `dashboard/index.html` in Chromium to browse; search, category/chain/token-record filters, sortable columns, paging, and protocol detail views work offline. `screenshots/` contains the board, detail, and filtered views used by the dossier.

## Scenario

For each protocol, implied value is rounded to whole dollars from:

`20% × TVL × tenure factor × 7-day momentum factor`

The tenure factor is `0.82 + 0.08 × ln(1 + tracked years)`; where `listed_at` is absent, it is `0.92`. The momentum factor is `exp(0.7 × clipped 7-day change / 100)`, with the change clipped to ±10 percentage points and missing change treated as zero. The ranking therefore uses only the snapshot's TVL, tracked duration, and reported seven-day change; the model has no revenue, circulating supply, token price, or launch-probability input. These assumptions are a transparent relative scenario, not a financial valuation.

Each farm plan starts with free verification and then suggests only small, useful protocol interactions when terms, access, and personal risk tolerance permit. It calls out time, network-fee uncertainty, and principal/exit risk; no eligibility or reward is promised.

## License

MIT. See [LICENSE](LICENSE).
