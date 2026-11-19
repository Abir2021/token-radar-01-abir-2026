# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Abir2021/token-radar-01-abir-2026/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Abir2021/token-radar-01-abir-2026/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

[![License: MIT](https://img.shields.io/badge/license-MIT-8ebd42.svg)](LICENSE)

An offline dashboard ranking every rankable pre-token protocol in the sealed snapshot by a comparable implied-value scenario, with a detail view and a concrete, costed farm plan for each row. The $50M watchlist is a coverage floor, not the board's boundary: the board ranks all 40 watchlist protocols plus every other pre-token protocol below the floor. Protocols whose token already trades are set aside in a separate Live tokens view, shown at market capitalisation and never ranked against pre-token ones.

A "records no token" label describes DefiLlama's record as of the snapshot date; it is not proof that a token does not exist. Nothing here predicts launches, airdrops, rewards, or investment returns.

## Run

Requires Node.js 22.18 or later. The program uses only Node's built-in modules and the official dossier helper in `vendor/`; it makes no network requests.

```sh
node main.ts
```

By default the entry reads `/input/snapshot.json` and writes `/output/board.json`, `/output/data.js`, `/output/dashboard/`, `/output/screenshots/`, and `/output/dossier.json`. For local development, paths can be overridden without changing the sealed input:

```sh
SNAPSHOT_PATH=/path/to/snapshot.json OUTPUT_DIR=./output node main.ts
```

The page and compressed local protocol data are self-contained in `dashboard/`. Open `dashboard/index.html` in a browser to browse; search, category filter, sortable columns, pre-token / live tabs, and protocol detail views work offline.

## Model — radar-2

For each protocol, implied value is rounded to whole dollars from:

`TVL × 0.18 × growth × tenure`

The growth factor clamps the 7-day TVL change to −20…+40 percentage points and multiplies by `1 + 0.8 × change / 100`, with missing change treated as zero. The tenure factor is `0.75 + 0.25 × (1 − exp(−age in years / 2))`; when `listed_at` is absent it is `0.85`. Tenure saturates, so a protocol tracked for two years with no token scores nearly as high as one tracked for five. The ranking therefore uses only the snapshot's TVL, tracked duration, and reported seven-day change; the model has no revenue, circulating supply, token price, or launch-probability input. These assumptions are a transparent relative scenario, not a financial valuation.

Each farm plan starts with a fresh wallet and then suggests only small, useful protocol interactions when terms, access, and personal risk tolerance permit. It calls out time, network-fee uncertainty, and principal/exit risk; no eligibility or reward is promised.

## License

MIT. See [LICENSE](LICENSE).
