import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildDossier } from './vendor/makefun-board.ts';

type Protocol = {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
};

const root = dirname(fileURLToPath(import.meta.url));
const inputPath = process.env.SNAPSHOT_PATH ?? '/input/snapshot.json';
const outputPath = process.env.OUTPUT_DIR ?? '/output';
const snapshot = JSON.parse(readFileSync(inputPath, 'utf8')) as {
  as_of: string;
  floor_usd: number;
  source: string;
  protocols: Protocol[];
  watchlist: string[];
};
const watchlist = new Set(snapshot.watchlist);
const asOf = Date.parse(`${snapshot.as_of}T00:00:00Z`);

function model(protocol: Protocol): { value: number; tenure: number; momentum: number } {
  const ageYears = protocol.listed_at === null
    ? null
    : Math.max(0, (asOf - Date.parse(`${protocol.listed_at}T00:00:00Z`)) / 86_400_000 / 365.25);
  const tenure = ageYears === null ? 0.92 : 0.82 + 0.08 * Math.log1p(ageYears);
  const weeklyChange = Math.max(-10, Math.min(10, protocol.change_7d ?? 0));
  const momentum = Math.exp((weeklyChange / 100) * 0.7);
  return { value: Math.round(protocol.tvl_usd * 0.2 * tenure * momentum), tenure, momentum };
}

function farmPlan(protocol: Protocol): string[] {
  const chain = protocol.chains[0] ?? 'its supported network';
  const category = (protocol.category ?? '').toLowerCase();
  let action = `try one core ${protocol.category ?? 'protocol'} workflow on ${chain}, then confirm the result and withdrawal path`;
  if (category.includes('dex') || category.includes('exchange')) {
    action = `make a small test swap on ${chain}; consider liquidity only after checking fees and impermanent-loss exposure`;
  } else if (category.includes('lend') || category.includes('credit')) {
    action = `test a small supply on ${chain}; skip borrowing until you understand liquidation and withdrawal terms`;
  } else if (category.includes('yield') || category.includes('vault') || category.includes('curator')) {
    action = `inspect the strategy and assets, then make one small deposit on ${chain} only if the withdrawal terms fit`;
  } else if (category.includes('bridge')) {
    action = `test the smallest practical transfer through its ${chain} route and confirm destination receipt before repeating`;
  } else if (category.includes('chain') || category.includes('payment')) {
    action = `complete one ordinary, low-value on-chain action on ${chain} and verify it settles`;
  } else if (category.includes('rwa')) {
    action = `check eligibility and redemption rules first; use a small ${chain} transaction only if you qualify and understand the terms`;
  }
  const recordNote = protocol.gecko_id === null && protocol.symbol === null
    ? `This ${snapshot.as_of} snapshot records no token for ${protocol.name}; that is not proof none exists and it is not an airdrop signal.`
    : `The snapshot records ${protocol.symbol ?? 'a token'} for ${protocol.name}; do not treat it as a pre-token farm or assume incentives.`;
  return [
    `${recordNote} Spend about 10 minutes checking the protocol's current first-party documentation, supported chain and any published rewards; cost $0.`,
    `Open the official app only from a source you independently trust. Check contract, fees, eligibility and how to exit before connecting a wallet; cost $0, about 5–10 minutes.`,
    `If the product is live and suits your risk limits, ${action}. Use only an amount you can afford to lose; principal is at risk, and the wallet quotes gas/fees. Allow 10–20 minutes.`,
    `For 3 weeks, repeat only a genuinely useful, low-risk action once a week and keep each transaction hash. Cost is one wallet-quoted network fee per action; allow 5–10 minutes weekly. No reward is promised.`,
    `Test an exit when practical, record the returned balance and any reward actually shown, and stop if withdrawal terms change. Exit gas/fees and market loss may apply; allow about 10 minutes.`,
  ];
}

const ranked = snapshot.protocols.map((protocol) => {
  const factors = model(protocol);
  return {
    slug: protocol.slug,
    name: protocol.name,
    rank: 0,
    implied_value_usd: factors.value,
    farm_steps: farmPlan(protocol),
    category: protocol.category,
    chains: protocol.chains,
    tvl_usd: protocol.tvl_usd,
    change_7d: protocol.change_7d,
    listed_at: protocol.listed_at,
    symbol: protocol.symbol,
    token_recorded: protocol.gecko_id !== null || protocol.symbol !== null,
    watchlist: watchlist.has(protocol.slug),
  };
}).sort((a, b) =>
  b.implied_value_usd - a.implied_value_usd ||
  b.tvl_usd - a.tvl_usd ||
  a.slug.localeCompare(b.slug),
);
ranked.forEach((row, index) => { row.rank = index + 1; });

const modelNote = 'Scenario, not a token forecast: implied value = 20% of snapshot TVL × tenure factor × 7-day momentum factor. Tenure = 0.82 + 0.08 × ln(1 + tracked years); when listed_at is absent it is 0.92. Momentum = exp(0.7 × clipped 7-day change / 100), with change clipped to ±10 percentage points and missing change treated as 0. It uses no revenue, token supply, market price, or launch probability. DefiLlama recording no token is not proof none exists.';
const dataRows = ranked.map((row) => [
  row.slug, row.name, row.category, row.chains.slice(0, 3), row.tvl_usd,
  row.change_7d, row.listed_at, row.symbol, row.token_recorded, row.watchlist,
]);
const dashboardData = `window.RADAR_BLOB=${JSON.stringify(gzipSync(Buffer.from(JSON.stringify({
  as_of: snapshot.as_of,
  floor_usd: snapshot.floor_usd,
  watchlist_count: snapshot.watchlist.length,
  rows: dataRows,
})), { level: 9 }).toString('base64'))};\n`;
const board = {
  as_of: snapshot.as_of,
  source: snapshot.source,
  model: modelNote,
  watchlist_count: snapshot.watchlist.length,
  rows: ranked,
};

mkdirSync(join(root, 'dashboard'), { recursive: true });
writeFileSync(join(root, 'dashboard', 'zdata.js'), dashboardData);
mkdirSync(outputPath, { recursive: true });
writeFileSync(join(outputPath, 'board.json'), `${JSON.stringify(board, null, 2)}\n`);
cpSync(join(root, 'dashboard'), join(outputPath, 'dashboard'), { recursive: true });
cpSync(join(root, 'screenshots'), join(outputPath, 'screenshots'), { recursive: true });
writeFileSync(join(outputPath, 'dossier.json'), buildDossier(outputPath, { text_max_bytes: 65_536 }));

console.log(`Built ${ranked.length} rows (${snapshot.watchlist.length} watchlist) in ${outputPath}`);
