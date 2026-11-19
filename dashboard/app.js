// Token Radar, radar-2 dashboard. It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable and
// sortable table, a per-protocol detail panel with the model's own inputs
// and the protocol's farm plan, and a separate Live token view. No network:
// every byte it shows is in data.js. Hashes drive the views for links and
// screenshots: #detail-<slug>, #filter-<category>, #tab-live.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var boardEl = document.getElementById('board');
  boardEl.setAttribute('aria-busy', 'false');
  var state = { q: '', category: 'all', tab: 'pre', sort: 'implied', dir: -1, selected: null };

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function age(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.round(days) + 'd';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Fill the category filter from the board's own categories.
  var cats = {};
  DATA.rows.forEach(function (r) { if (r.category) cats[r.category] = true; });
  var catSel = document.getElementById('category');
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c; catSel.appendChild(o);
  });

  // The hash is the view's address: detail, filter and tab, for screenshots.
  function readHash() {
    var h = (location.hash || '').slice(1);
    if (!h) return;
    var parts = h.split('&');
    parts.forEach(function (part) {
      if (part.indexOf('detail-') === 0) state.selected = part.slice(7);
      else if (part.indexOf('filter-') === 0) {
        state.category = decodeURIComponent(part.slice(7));
        catSel.value = state.category;
      } else if (part === 'tab-live') state.tab = 'live';
    });
  }
  readHash();

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().indexOf(q) >= 0 ||
        r.slug.toLowerCase().indexOf(q) >= 0 ||
        (r.chains || []).join(' ').toLowerCase().indexOf(q) >= 0
      );
    });
  }
  function sorted(list) {
    var key = state.sort;
    var dir = state.dir;
    function val(r) {
      if (key === 'tvl') return r.tvl_usd;
      if (key === 'growth') return r.change_7d === null ? -9999 : r.change_7d;
      if (key === 'age') return r.age_days === null ? -1 : r.age_days;
      if (key === 'name') return r.name.toLowerCase();
      return r.implied_value_usd;
    }
    return list.slice().sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.rank - b.rank;
    });
  }

  function renderStats() {
    var top = DATA.rows[0];
    document.getElementById('asof').textContent = 'Snapshot ' + DATA.as_of + ' · DefiLlama · ' + DATA.source;
    document.getElementById('stats').innerHTML =
      '<div class="stat"><b>' + DATA.board_size + '</b><span>ranked rows</span></div>' +
      '<div class="stat"><b>' + DATA.watchlist_size + '</b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + DATA.early_size + '</b><span>early, below the floor</span></div>' +
      '<div class="stat"><b>' + DATA.live_size + '</b><span>live tokens set aside</span></div>' +
      '<div class="stat"><b>' + esc(top ? top.name : '—') + '</b><span>top: ' + (top ? usd(top.implied_value_usd) : '') + '</span></div>';
    document.getElementById('model').innerHTML =
      '<strong>Model radar-2.</strong> Implied value = <code>TVL × 0.18 × growth × tenure</code>, ' +
      'growth clamps the 7-day change to −20…+40% and multiplies by <code>1 + 0.8 × change</code>, ' +
      'tenure is <code>0.75 + 0.25 × (1 − e^(−age/2y))</code> (0.85 when the listing date is unknown). ' +
      'It uses only the snapshot’s TVL, 7-day change and tracked age — no name is special-cased, ' +
      'and “records no token” is DefiLlama’s record, never proof that no token exists. ' +
      'Implied values are a scenario, not a forecast of a launch, an airdrop or a price.';
  }

  function renderTable() {
    var tbody = document.getElementById('rows');
    var hint = document.getElementById('hint');
    document.getElementById('tab-pre').setAttribute('aria-selected', state.tab === 'pre' ? 'true' : 'false');
    document.getElementById('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    if (state.tab === 'live') {
      hint.textContent = 'Live tokens already trade: shown at the market’s own capitalisation, never ranked against pre-token protocols.';
      tbody.innerHTML = DATA.live.map(function (r) {
        return '<tr data-slug="' + esc(r.slug) + '" data-live="1"><td class="num">—</td><td><strong>' + esc(r.name) + '</strong><br><span style="color:var(--muted)">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td><td class="num">' + usd(r.tvl_usd) + '</td>' +
          '<td class="num ' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : '') + '">' + pct(r.change_7d) + '</td>' +
          '<td>—</td><td class="num">' + usd(r.mcap_usd) + '</td>' +
          '<td><span class="badge live">live token</span></td></tr>';
      }).join('');
      return;
    }
    var list = sorted(filtered());
    hint.textContent = list.length + ' of ' + DATA.board_size + ' pre-token protocols' +
      (state.category !== 'all' ? ' in ' + state.category : '') +
      (state.q ? ' matching “' + state.q + '”' : '') + '. Click a row for its detail and farm plan.';
    tbody.innerHTML = list.slice(0, 200).map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong><br><span style="color:var(--muted)">' + esc(r.slug) + ' · ' + esc((r.chains || []).slice(0, 2).join(', ')) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="num">' + usd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : '') + '">' + pct(r.change_7d) + '</td>' +
        '<td>' + age(r.age_days) + '</td>' +
        '<td class="num"><strong>' + usd(r.implied_value_usd) + '</strong></td>' +
        '<td>' + (r.watchlist ? '<span class="badge watch">watchlist</span>' : '<span class="badge">pre-token</span>') + '</td></tr>';
    }).join('');
    if (list.length > 200) {
      hint.textContent += ' Showing the first 200 — narrow the search or filter to see the rest.';
    }
  }

  function renderDetail() {
    var box = document.getElementById('detail');
    var row = null;
    var live = null;
    if (state.selected) {
      for (var i = 0; i < DATA.rows.length; i++) {
        if (DATA.rows[i].slug === state.selected) { row = DATA.rows[i]; break; }
      }
      if (!row) {
        for (var j = 0; j < DATA.live.length; j++) {
          if (DATA.live[j].slug === state.selected) { live = DATA.live[j]; break; }
        }
      }
    }
    if (live) {
      box.innerHTML =
        '<h2>' + esc(live.name) + '</h2>' +
        '<p class="meta">' + esc(live.slug) + ' · ' + esc(live.category || 'no category') + ' · ' + esc((live.chains || []).join(', ')) + '</p>' +
        '<dl>' +
        '<dt>Market cap</dt><dd>' + usd(live.mcap_usd) + '</dd>' +
        '<dt>TVL</dt><dd>' + usd(live.tvl_usd) + '</dd>' +
        '<dt>7-day change</dt><dd>' + pct(live.change_7d) + '</dd>' +
        '</dl>' +
        '<p>This protocol’s token already trades, so it is not ranked on the pre-token board: the board is for launches still to come. Its value here is the market’s own capitalisation, not a model’s implied value, and there is no pre-token farm plan for it.</p>';
      return;
    }
    if (!row) {
      box.innerHTML = '<p class="empty"><strong>Detail view.</strong><br>Click any row to see its model inputs and its farm plan here — TVL, 7-day change, tracked age, growth and tenure multipliers, and six concrete steps with cost and time.</p>';
      return;
    }
    var steps = (row.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    box.innerHTML =
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="meta">Rank ' + row.rank + ' · ' + esc(row.slug) + ' · ' + esc(row.category || 'no category') + ' · ' + esc((row.chains || []).join(', ')) + '</p>' +
      '<dl>' +
      '<dt>Implied value</dt><dd>' + usd(row.implied_value_usd) + '</dd>' +
      '<dt>TVL</dt><dd>' + usd(row.tvl_usd) + '</dd>' +
      '<dt>7-day change</dt><dd>' + pct(row.change_7d) + '</dd>' +
      '<dt>Tracked</dt><dd>' + age(row.age_days) + '</dd>' +
      '<dt>Growth ×</dt><dd>' + row.growth_multiplier + '</dd>' +
      '<dt>Tenure ×</dt><dd>' + row.tenure_multiplier + '</dd>' +
      '<dt>Token</dt><dd>none recorded</dd>' +
      '</dl>' +
      '<h3>Farm plan</h3><ol>' + steps + '</ol>' +
      '<p class="meta">No reward is promised. “Records no token” is the snapshot’s record, not proof none exists.</p>';
  }

  function render() { renderStats(); renderTable(); renderDetail(); }

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderTable(); });
  catSel.addEventListener('change', function (e) { state.category = e.target.value; renderTable(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderTable(); });
  document.getElementById('tab-pre').addEventListener('click', function () { state.tab = 'pre'; renderTable(); });
  document.getElementById('tab-live').addEventListener('click', function () { state.tab = 'live'; renderTable(); });
  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = -1; }
      renderTable();
    });
  });
  document.getElementById('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.selected = tr.getAttribute('data-slug');
    renderTable(); renderDetail();
  });

  render();
})();
