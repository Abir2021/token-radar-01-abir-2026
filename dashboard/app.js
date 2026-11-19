(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money = (n) => '$' + fmt.format(n);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const params = new URLSearchParams(location.search);
  const state = { query: '', status: params.get('status') ?? 'all', category: '', chain: '', sort: 'value', direction: -1, page: 0, selected: params.get('slug') ?? '' };
  let rows = [];
  let info;
  let toastTimer;

  function farmSteps(row) {
    const chain = row.chains[0] || 'its supported network';
    const category = (row.category || '').toLowerCase();
    let action = `try one core ${row.category || 'protocol'} workflow on ${chain}, then confirm the result and withdrawal path`;
    if (category.includes('dex') || category.includes('exchange')) action = `make a small test swap on ${chain}; consider liquidity only after checking fees and impermanent-loss exposure`;
    else if (category.includes('lend') || category.includes('credit')) action = `test a small supply on ${chain}; skip borrowing until you understand liquidation and withdrawal terms`;
    else if (category.includes('yield') || category.includes('vault') || category.includes('curator')) action = `inspect the strategy and assets, then make one small deposit on ${chain} only if the withdrawal terms fit`;
    else if (category.includes('bridge')) action = `test the smallest practical transfer through its ${chain} route and confirm destination receipt before repeating`;
    else if (category.includes('chain') || category.includes('payment')) action = `complete one ordinary, low-value on-chain action on ${chain} and verify it settles`;
    else if (category.includes('rwa')) action = `check eligibility and redemption rules first; use a small ${chain} transaction only if you qualify and understand the terms`;
    const status = row.token
      ? `The snapshot records ${row.symbol || 'a token'} for ${row.name}; do not treat it as a pre-token farm or assume incentives.`
      : `This ${info.as_of} snapshot records no token for ${row.name}; that is not proof none exists and it is not an airdrop signal.`;
    return [
      `${status} Spend about 10 minutes checking the protocol's current first-party documentation, supported chain and any published rewards; cost $0.`,
      `Open the official app only from a source you independently trust. Check contract, fees, eligibility and how to exit before connecting a wallet; cost $0, about 5–10 minutes.`,
      `If the product is live and suits your risk limits, ${action}. Use only an amount you can afford to lose; principal is at risk, and the wallet quotes gas/fees. Allow 10–20 minutes.`,
      `For 3 weeks, repeat only a genuinely useful, low-risk action once a week and keep each transaction hash. Cost is one wallet-quoted network fee per action; allow 5–10 minutes weekly. No reward is promised.`,
      `Test an exit when practical, record the returned balance and any reward actually shown, and stop if withdrawal terms change. Exit gas/fees and market loss may apply; allow about 10 minutes.`,
    ];
  }

  function fillFilters() {
    const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
    const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
    $('category').innerHTML += categories.map((x) => `<option>${esc(x)}</option>`).join('');
    $('chain').innerHTML += chains.map((x) => `<option>${esc(x)}</option>`).join('');
    if (['all', 'watchlist', 'unrecorded', 'recorded'].includes(state.status)) $('status').value = state.status;
    $('category').value = state.category;
    $('chain').value = state.chain;
  }

  function filteredRows() {
    let result = rows.filter((r) => {
      const q = state.query.toLowerCase();
      const match = !q || `${r.name} ${r.slug} ${r.category || ''} ${r.chains.join(' ')}`.toLowerCase().includes(q);
      const status = state.status === 'watchlist' ? r.watchlist
        : state.status === 'unrecorded' ? !r.token
          : state.status === 'recorded' ? r.token : true;
      return match && status && (!state.category || r.category === state.category) && (!state.chain || r.chains.includes(state.chain));
    });
    result.sort((a, b) => {
      const av = a[state.sort], bv = b[state.sort];
      let cmp = typeof av === 'string' ? String(av || '').localeCompare(String(bv || '')) : (av ?? -Infinity) - (bv ?? -Infinity);
      if (state.sort === 'name') return cmp * state.direction;
      return cmp * state.direction || a.rank - b.rank;
    });
    return result;
  }

  function renderBoard() {
    $('workspace').classList.remove('detail-mode');
    const result = filteredRows();
    const pages = Math.max(1, Math.ceil(result.length / 16));
    state.page = Math.min(state.page, pages - 1);
    const pageRows = result.slice(state.page * 16, (state.page + 1) * 16);
    $('result-count').textContent = fmt.format(result.length);
    $('page-label').textContent = result.length ? `${String(state.page * 16 + 1).padStart(2, '0')}–${String(Math.min((state.page + 1) * 16, result.length)).padStart(2, '0')} / ${fmt.format(result.length)} PROTOCOLS` : '0 PROTOCOLS';
    $('prev').disabled = state.page === 0;
    $('next').disabled = state.page >= pages - 1;
    $('rows').innerHTML = pageRows.length ? pageRows.map((r, i) => {
      const change = r.change === null ? '—' : `${r.change > 0 ? '+' : ''}${r.change.toFixed(2)}%`;
      const bar = Math.max(3, Math.round(40 * r.value / Math.max(1, rows[0].value)));
      return `<tr>
        <td class="rank-cell">${String(r.rank).padStart(2, '0')}</td>
        <td><button class="protocol-button" data-open="${esc(r.slug)}"><span class="protocol-initial">${esc(r.name.slice(0, 1).toUpperCase())}</span><span class="protocol-name">${esc(r.name)}<span class="protocol-category">${esc(r.category || 'Uncategorized')} · ${esc(r.chains.slice(0, 2).join(', '))}${r.chains.length > 2 ? ' +' + (r.chains.length - 2) : ''}</span></span></button></td>
        <td class="money">${money(r.tvl)}</td>
        <td class="${r.change > 0 ? 'change-up' : r.change < 0 ? 'change-down' : ''}">${change}</td>
        <td><div class="value-cell"><span class="value-bar" style="width:${bar}px"></span><span class="value-number">${money(r.value)}</span></div></td>
        <td><span class="status-chip ${r.token ? 'tracked' : ''}">${r.token ? `● ${esc(r.symbol || 'RECORDED')}` : '○ UNRECORDED'}</span></td>
        <td><button class="open-arrow" data-open="${esc(r.slug)}" aria-label="Open ${esc(r.name)}">↗</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty-state"><b>NO MATCHES IN THIS VIEW</b>Try a different filter or search term.</div></td></tr>';
    document.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => showDetail(el.dataset.open)));
  }

  function showDetail(slug) {
    const row = rows.find((r) => r.slug === slug);
    if (!row) return;
    state.selected = slug;
    const steps = farmSteps(row);
    const changeClass = row.change > 0 ? 'positive' : row.change < 0 ? 'negative' : '';
    const tenure = row.listed ? `${Math.max(0, (Date.parse(`${info.as_of}T00:00:00Z`) - Date.parse(`${row.listed}T00:00:00Z`)) / 86_400_000 / 365.25).toFixed(1)} yrs` : 'Not reported';
    const change = row.change === null ? 'Not reported' : `${row.change > 0 ? '+' : ''}${row.change.toFixed(2)}%`;
    const heights = [25, 38, 31, 51, 42, 62, 52, 72, 59, 82, 68, 91];
    $('workspace').classList.add('detail-mode');
    $('workspace').innerHTML = `<section class="board detail-layout">
      <article class="detail-main">
        <button class="back-button" id="back">← BACK TO RADAR</button>
        <div class="detail-title"><div><h2>${esc(row.name)}</h2><p>${esc(row.category || 'Uncategorized')} · ${esc(row.slug)}</p></div><div class="detail-value">${money(row.value)}<small>IMPLIED VALUE · USD</small></div></div>
        <div class="detail-badges"><span>${esc(row.chains.join(' · ') || 'Chain not reported')}</span><span>${row.token ? `TOKEN RECORDED · ${esc(row.symbol || 'YES')}` : 'NO TOKEN RECORDED'}</span>${row.watchlist ? '<span>WATCHLIST FLOOR</span>' : '<span>BELOW / OUTSIDE FLOOR</span>'}</div>
        <div class="detail-disclaimer"><b>RECORD ≠ PROOF</b><br>${row.token ? `The sealed record includes ${esc(row.symbol || 'a token')}. This is not a pre-token thesis.` : `The ${info.as_of} snapshot records no token here; it does not prove that no token exists. Neither this model nor the board predicts a launch or a reward.`}</div>
        <h3>FIELD PLAN <span style="color:#76847b">/ 5 CHECKPOINTS</span></h3>
        <ol class="farm-list">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </article>
      <aside class="detail-aside"><div class="section-kicker">SIGNAL PROFILE / #${String(row.rank).padStart(3, '0')}</div><h3>Snapshot fundamentals</h3>
        <div class="stat-line"><span>TVL</span><b>${money(row.tvl)}</b></div><div class="stat-line"><span>7D CHANGE</span><b class="${changeClass}">${change}</b></div>
        <div class="stat-line"><span>TRACKED FOR</span><b>${tenure}</b></div><div class="stat-line"><span>MARKET CAP</span><b>${row.token ? 'Token record' : 'Not recorded'}</b></div>
        <div class="mini-chart" aria-label="Illustrative, not historical">${heights.map((h) => `<i style="height:${h}%"></i>`).join('')}</div><div class="chart-caption"><span>MODEL ILLUSTRATION</span><span>NOT PRICE HISTORY</span></div>
        <div class="model-detail"><b>VALUE SCENARIO</b><br>20% of TVL × tenure × 7-day momentum. This is a relative model claim—not a target price, market cap forecast or probability.</div>
      </aside></section>`;
    $('back').addEventListener('click', () => { state.selected = ''; renderShell(); });
    window.scrollTo(0, 0);
  }

  function renderShell() {
    $('workspace').innerHTML = `<aside class="filters">
      <div class="filter-head"><span class="section-kicker">01 / DISCOVER</span><span class="filter-glyph">⌕</span></div>
      <label class="field-label" for="search">SEARCH RADAR</label><div class="search-wrap"><span>⌕</span><input id="search" type="search" placeholder="Protocol or chain" autocomplete="off"></div>
      <label class="field-label" for="status">TOKEN RECORD</label><select id="status"><option value="all">All protocols</option><option value="watchlist">Watchlist floor</option><option value="unrecorded">No token recorded</option><option value="recorded">Token recorded</option></select>
      <label class="field-label" for="category">CATEGORY</label><select id="category"><option value="">All categories</option></select>
      <label class="field-label" for="chain">CHAIN</label><select id="chain"><option value="">All chains</option></select>
      <div class="filter-rule"></div><div class="filter-count"><span>SHOWING</span><b id="result-count">—</b></div>
      <p class="filter-tip"><b>Radar note</b><br>The house's $50M floor does not limit this board. Use filters to explore below it.</p><div class="source-stamp">SOURCE<br><span>DefiLlama snapshot · <span id="source-date">${esc(info.as_of)}</span></span></div>
    </aside>
    <section class="board"><div class="board-head"><div><div class="section-kicker">02 / RANKED BOARD</div><h2>Launch watch</h2></div><div class="board-actions"><span class="sort-hint">SORT BY</span><button class="sort-pill active" id="sort-value" type="button">Implied value <span>↓</span></button></div></div>
    <div class="table-wrap"><table><thead><tr><th class="rank-col"><button data-sort="rank">RANK <span>↕</span></button></th><th><button data-sort="name">PROTOCOL <span>↕</span></button></th><th><button data-sort="tvl">TVL <span>↕</span></button></th><th><button data-sort="change">7D CHANGE <span>↕</span></button></th><th><button data-sort="value">IMPLIED VALUE <span>↕</span></button></th><th>RECORD</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
    <div class="table-foot"><span id="page-label">—</span><div class="pager"><button id="prev" type="button" aria-label="Previous page">←</button><button id="next" type="button" aria-label="Next page">→</button></div></div>
    <div class="model-strip"><span class="model-icon">ƒ</span><div><b>HOW THE SCENARIO WORKS</b><span>TVL × 20% × tenure factor × 7-day momentum factor. Snapshot inputs only; not a forecast.</span></div><button id="model-open" type="button" aria-label="Read model details">↗</button></div></section>`;
    fillFilters();
    bindControls();
    renderBoard();
  }

  function bindControls() {
    $('search').addEventListener('input', (e) => { state.query = e.target.value; state.page = 0; renderBoard(); });
    $('status').addEventListener('change', (e) => { state.status = e.target.value; state.page = 0; renderBoard(); });
    $('category').addEventListener('change', (e) => { state.category = e.target.value; state.page = 0; renderBoard(); });
    $('chain').addEventListener('change', (e) => { state.chain = e.target.value; state.page = 0; renderBoard(); });
    $('prev').addEventListener('click', () => { state.page--; renderBoard(); });
    $('next').addEventListener('click', () => { state.page++; renderBoard(); });
    document.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => {
      const field = button.dataset.sort;
      state.direction = field === state.sort ? -state.direction : (field === 'name' || field === 'rank' ? 1 : -1);
      state.sort = field;
      state.page = 0;
      renderBoard();
    }));
    $('sort-value').addEventListener('click', () => {
      state.direction = state.sort === 'value' ? -state.direction : -1;
      state.sort = 'value';
      state.page = 0;
      renderBoard();
    });
    $('model-open').addEventListener('click', showModel);
  }

  function showModel() {
    const t = $('toast');
    t.textContent = 'Implied value = TVL × 20% × tenure × momentum. Tenure = 0.82 + 0.08 ln(1 + tracked years), or 0.92 when unreported. Momentum = exp(0.7 × clipped 7-day change / 100), clipped to ±10%. No launch probability is modeled.';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 6000);
  }

  async function start() {
    const compressed = Uint8Array.from(atob(window.RADAR_BLOB), (c) => c.charCodeAt(0));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    info = JSON.parse(await new Response(stream).text());
    rows = info.rows.map((r, i) => {
      const age = r[6] ? Math.max(0, (Date.parse(`${info.as_of}T00:00:00Z`) - Date.parse(`${r[6]}T00:00:00Z`)) / 86400000 / 365.25) : null;
      const tenure = age === null ? .92 : .82 + .08 * Math.log1p(age);
      const momentum = Math.exp(.7 * Math.max(-10, Math.min(10, r[5] ?? 0)) / 100);
      return { slug: r[0], name: r[1], category: r[2], chains: r[3] || [], tvl: r[4], change: r[5], listed: r[6], symbol: r[7], token: r[8], watchlist: r[9], value: Math.round(r[4] * .2 * tenure * momentum), rank: i + 1 };
    });
    $('as-of').textContent = info.as_of;
    $('source-date').textContent = info.as_of;
    $('metric-total').textContent = fmt.format(rows.length);
    $('metric-watchlist').textContent = fmt.format(info.watchlist_count);
    $('metric-top').textContent = money(rows[0]?.value || 0);
    renderShell();
    if (state.selected) showDetail(state.selected);
  }

  start().catch((error) => {
    $('rows').innerHTML = `<tr><td colspan="7" class="loading">RADAR DATA ERROR · ${esc(error.message)}</td></tr>`;
  });
})();
