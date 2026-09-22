(() => {
  'use strict';

  /* ---------- Constants ---------- */

  const STORE_KEY = 'pennywise:v2';

  const DEFAULT_CATEGORIES = [
    { id: 'food', name: 'Food & Dining', emoji: '🍔', color: '#E4572E' },
    { id: 'groceries', name: 'Groceries', emoji: '🛒', color: '#29A36A' },
    { id: 'transport', name: 'Transport', emoji: '🚗', color: '#3B82F6' },
    { id: 'bills', name: 'Bills & Utilities', emoji: '💡', color: '#F5A524' },
    { id: 'housing', name: 'Housing', emoji: '🏠', color: '#8B5CF6' },
    { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#EC4899' },
    { id: 'health', name: 'Health', emoji: '💊', color: '#14B8A6' },
    { id: 'fun', name: 'Entertainment', emoji: '🎬', color: '#06B6D4' },
    { id: 'travel', name: 'Travel', emoji: '✈️', color: '#84CC16' },
    { id: 'education', name: 'Education', emoji: '📚', color: '#A16207' },
    { id: 'other', name: 'Other', emoji: '📦', color: '#64748B' },
  ];
  const EXTRA_COLORS = ['#D946EF', '#F43F5E', '#0EA5E9', '#65A30D', '#EA580C', '#7C3AED'];
  const FALLBACK_CATEGORY = DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
  const INCOME_BADGE = { emoji: '💰', color: '#0EA5E9' };

  const CURRENCIES = [
    'LKR', 'USD', 'EUR', 'GBP', 'INR', 'PKR', 'BDT', 'AED', 'SAR', 'QAR', 'KWD', 'CAD', 'AUD', 'NZD',
    'JPY', 'CNY', 'KRW', 'SGD', 'MYR', 'IDR', 'PHP', 'THB', 'TRY', 'EGP', 'NGN', 'ZAR', 'KES',
    'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'BRL', 'MXN', 'OMR', 'JOD', 'BHD',
  ];
  const REGION_CURRENCY = {
    US: 'USD', GB: 'GBP', IN: 'INR', PK: 'PKR', LK: 'LKR', BD: 'BDT', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD',
    CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', KR: 'KRW', SG: 'SGD', MY: 'MYR', ID: 'IDR',
    PH: 'PHP', TH: 'THB', TR: 'TRY', EG: 'EGP', NG: 'NGN', ZA: 'ZAR', KE: 'KES', CH: 'CHF', SE: 'SEK',
    NO: 'NOK', DK: 'DKK', PL: 'PLN', BR: 'BRL', MX: 'MXN',
    DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
  };

  // Best-effort category guess for auto-synced transactions, keyed to ids in DEFAULT_CATEGORIES.
  // Matched against the merchant name and/or the raw SMS text, case-insensitively.
  const CATEGORY_HINTS = {
    food: ['restaurant', 'cafe', 'coffee', 'kfc', 'pizza', 'dining', 'burger', 'bakery', 'hotel de', 'food court'],
    groceries: ['super', 'mart', 'grocery', 'cargills', 'keells', 'arpico', 'foodcity', 'laugfs'],
    transport: ['uber', 'pickme', 'taxi', 'cab', 'fuel', 'petrol', 'diesel', 'filling station', 'ioc', 'ceypetco'],
    bills: ['electricity', 'ceb', 'water board', 'nwsdb', 'utility', 'telecom', 'dialog', 'mobitel', 'slt', 'hutch', 'airtel', 'bill payment', 'amazon prime', 'netflix', 'spotify', 'youtube premium'],
    shopping: ['shop', 'store', 'fashion', 'mall', 'odel', 'amazon', 'daraz'],
    health: ['pharmacy', 'hospital', 'clinic', 'medical', 'asiri', 'nawaloka', 'durdans'],
    fun: ['cinema', 'movie', 'pvr', 'scope'],
    travel: ['airline', 'airways', 'hotel', 'booking.com', 'airbnb', 'expedia', 'ride'],
  };
  function guessCategory(text) {
    const t = String(text || '').toLowerCase();
    for (const [id, words] of Object.entries(CATEGORY_HINTS)) {
      if (words.some((w) => t.includes(w))) return id;
    }
    return 'other';
  }

  /* ---------- Small helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const tint = (hex, alpha = 0.16) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  };

  function guessCurrency() {
    try {
      const region = new Intl.Locale(navigator.language).maximize().region;
      return REGION_CURRENCY[region] || 'USD';
    } catch (e) {
      return 'USD';
    }
  }

  function isValidCurrency(code) {
    try { new Intl.NumberFormat(undefined, { style: 'currency', currency: code }); return true; }
    catch (e) { return false; }
  }

  /** Parses "12.5", "12,50", "1,234.56", "1,234" into integer cents, or NaN. */
  function parseAmount(str) {
    const s = String(str).trim().replace(/\s/g, '');
    if (!s) return NaN;
    let norm;
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) norm = s.replace(/,/g, '');
    else norm = s.replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(norm)) return NaN;
    return Math.round(parseFloat(norm) * 100);
  }

  /* ---------- State + storage ---------- */

  function freshAccount(overrides) {
    return {
      id: uid(),
      name: 'Main Account',
      currency: guessCurrency(),
      remoteTag: '',
      startingBalance: 0,
      startingDate: isoDate(new Date()),
      budget: 0,
      ...overrides,
    };
  }

  function freshState() {
    const acct = freshAccount({});
    return {
      accounts: [acct],
      activeAccountId: acct.id,
      transactions: [],
      settings: {
        lastCategory: 'food',
        categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
        syncUrl: '',
        syncSecret: '',
        syncCursor: 0,
        syncLastAt: 0,
      },
    };
  }

  function normalizeAccount(a) {
    if (!a || typeof a !== 'object') return null;
    if (typeof a.id !== 'string' || !a.id) return null;
    return {
      id: a.id,
      name: typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 40) : 'Account',
      currency: (typeof a.currency === 'string' && isValidCurrency(a.currency)) ? a.currency : 'LKR',
      remoteTag: typeof a.remoteTag === 'string' ? a.remoteTag.trim().slice(0, 40) : '',
      startingBalance: Number.isFinite(a.startingBalance) ? Math.round(a.startingBalance) : 0,
      startingDate: /^\d{4}-\d{2}-\d{2}$/.test(a.startingDate) ? a.startingDate : isoDate(new Date()),
      budget: Number.isFinite(a.budget) && a.budget > 0 ? Math.round(a.budget) : 0,
    };
  }

  /** Coerces anything loaded from storage or a backup file into a valid state. Migrates the old
   * single-ledger v1 shape (flat `expenses` + `settings.currency`/`budget`) into one default account. */
  function normalize(data) {
    const base = freshState();
    const src = (data && typeof data === 'object') ? data : {};
    const s = (src.settings && typeof src.settings === 'object') ? src.settings : {};
    const isLegacy = !Array.isArray(src.accounts) && Array.isArray(src.expenses);

    let categories = Array.isArray(s.categories)
      ? s.categories
          .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && /^#[0-9a-f]{6}$/i.test(c.color || ''))
          .map((c) => ({ id: c.id, name: c.name.slice(0, 40), emoji: String(c.emoji || '🏷️').slice(0, 8), color: c.color }))
      : [];
    if (!categories.length) categories = base.settings.categories;
    if (!categories.some((c) => c.id === 'other')) categories.push({ ...FALLBACK_CATEGORY });
    const knownCats = new Set(categories.map((c) => c.id));

    let accounts;
    if (isLegacy) {
      accounts = [freshAccount({
        id: 'default',
        name: 'Main Account',
        currency: (typeof s.currency === 'string' && isValidCurrency(s.currency)) ? s.currency : base.accounts[0].currency,
        budget: Number.isFinite(s.budget) && s.budget > 0 ? Math.round(s.budget) : 0,
      })];
    } else {
      accounts = (Array.isArray(src.accounts) ? src.accounts : []).map(normalizeAccount).filter(Boolean);
      if (!accounts.length) accounts = [freshAccount({})];
    }
    const knownAccounts = new Set(accounts.map((a) => a.id));
    const firstAccountId = accounts[0].id;

    const activeAccountId = knownAccounts.has(src.activeAccountId) ? src.activeAccountId : firstAccountId;

    const rawTx = isLegacy
      ? (src.expenses || []).map((e) => ({ ...e, accountId: 'default', type: 'debit' }))
      : (Array.isArray(src.transactions) ? src.transactions : []);

    const transactions = rawTx
      .filter((t) => t && Number.isFinite(t.amount) && t.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
      .map((t) => {
        const type = t.type === 'credit' ? 'credit' : 'debit';
        return {
          id: String(t.id || uid()),
          accountId: knownAccounts.has(t.accountId) ? t.accountId : firstAccountId,
          type,
          amount: Math.round(t.amount),
          category: type === 'debit' ? (knownCats.has(t.category) ? t.category : 'other') : '',
          date: t.date,
          note: String(t.note || '').slice(0, 200),
          createdAt: Number(t.createdAt) || Date.now(),
          remote: Boolean(t.remote),
          originalAmount: Number.isFinite(t.originalAmount) && t.originalAmount > 0 ? Math.round(t.originalAmount) : undefined,
          originalCurrency: (typeof t.originalCurrency === 'string' && isValidCurrency(t.originalCurrency)) ? t.originalCurrency : undefined,
          fxRate: Number.isFinite(t.fxRate) && t.fxRate > 0 ? t.fxRate : undefined,
          unconverted: Boolean(t.unconverted),
        };
      });

    return {
      accounts,
      activeAccountId,
      transactions,
      settings: {
        lastCategory: knownCats.has(s.lastCategory) ? s.lastCategory : 'food',
        categories,
        syncUrl: typeof s.syncUrl === 'string' && /^https:\/\//i.test(s.syncUrl) ? s.syncUrl.trim() : '',
        syncSecret: typeof s.syncSecret === 'string' ? s.syncSecret.trim().slice(0, 200) : '',
        syncCursor: Number.isFinite(s.syncCursor) && s.syncCursor >= 0 ? Math.floor(s.syncCursor) : 0,
        syncLastAt: Number.isFinite(s.syncLastAt) ? s.syncLastAt : 0,
      },
    };
  }

  let storageOk = true;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalize(JSON.parse(raw));
      const legacyRaw = localStorage.getItem('pennywise:v1'); // pre-accounts data, migrate once
      if (legacyRaw) return normalize(JSON.parse(legacyRaw));
    } catch (e) {
      storageOk = false;
    }
    return freshState();
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      storageOk = true;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      storageOk = false;
      toast('Could not save. Storage is full or blocked, so export a backup.');
    }
  }

  let state = load();

  const now0 = new Date();
  const ui = { tab: 'list', year: now0.getFullYear(), month: now0.getMonth(), query: '' };

  /* ---------- Accounts ---------- */

  const activeAccount = () => state.accounts.find((a) => a.id === state.activeAccountId) || state.accounts[0];
  const acctById = (id) => state.accounts.find((a) => a.id === id);

  function computeBalance(account) {
    let bal = account.startingBalance;
    for (const t of state.transactions) {
      if (t.accountId !== account.id || t.date < account.startingDate) continue;
      bal += t.type === 'credit' ? t.amount : -t.amount;
    }
    return bal;
  }

  /* ---------- Formatting ---------- */

  let moneyFmt;
  let compactFmt;
  function setFormatters() {
    const currency = activeAccount().currency;
    moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    compactFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
  }
  const money = (cents) => moneyFmt.format(cents / 100);
  const moneyCompact = (cents) => compactFmt.format(cents / 100);
  const moneyIn = (cents, currency) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100); }
    catch (e) { return `${currency} ${(cents / 100).toFixed(2)}`; }
  };

  const catById = (id) => state.settings.categories.find((c) => c.id === id) || FALLBACK_CATEGORY;
  const monthName = (y, m, opts) => new Date(y, m, 1).toLocaleDateString(undefined, opts);

  function dayLabel(iso) {
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (iso === isoDate(today)) return 'Today';
    if (iso === isoDate(yest)) return 'Yesterday';
    const d = parseISO(iso);
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString(undefined, opts);
  }

  const byNewest = (a, b) => (a.date === b.date ? b.createdAt - a.createdAt : (a.date < b.date ? 1 : -1));
  const inMonth = (t, y = ui.year, m = ui.month) => t.date.startsWith(monthKey(y, m));
  const sum = (items) => items.reduce((t, x) => t + x.amount, 0);

  /* ---------- Rendering: shell ---------- */

  function renderAccountBar() {
    const bar = $('#accountBar');
    bar.innerHTML = state.accounts.map((a) => (
      `<button type="button" class="acct-pill" data-id="${esc(a.id)}" role="tab" aria-selected="${a.id === state.activeAccountId}">${esc(a.name)}</button>`
    )).join('') + '<button type="button" class="acct-pill add" data-add-account>+ Account</button>';
  }

  function render() {
    if (!acctById(state.activeAccountId)) state.activeAccountId = state.accounts[0].id;
    setFormatters();
    renderAccountBar();

    $('#monthNav').hidden = ui.tab === 'settings';
    $('#pageTitle').hidden = ui.tab !== 'settings';
    $('#monthLabel').textContent = monthName(ui.year, ui.month, { month: 'long', year: 'numeric' });

    for (const tab of document.querySelectorAll('.tab')) {
      if (tab.dataset.tab === ui.tab) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    for (const name of ['list', 'stats', 'settings']) $(`#view-${name}`).hidden = ui.tab !== name;
    $('#fab').hidden = ui.tab !== 'list';

    if (ui.tab === 'list') renderList();
    else if (ui.tab === 'stats') renderStats();
    else renderSettings();
  }

  /* ---------- Rendering: transactions list ---------- */

  function txSubtitle(t, cat) {
    const parts = [];
    if (t.type === 'credit') parts.push('Income');
    else if (t.note) parts.push(cat.name);
    if (t.originalCurrency) {
      const orig = `${t.originalCurrency} ${(t.originalAmount / 100).toFixed(2)}`;
      parts.push(t.fxRate ? `${orig} @ ${t.fxRate.toFixed(2)}` : `${orig} ⚠ not converted`);
    }
    if (t.remote) parts.push('Auto · SMS');
    return parts.join(' · ');
  }

  function renderList() {
    const acct = activeAccount();
    const q = ui.query.trim().toLowerCase();
    const all = state.transactions.filter((t) => t.accountId === acct.id);
    let items;
    let head;

    if (q) {
      items = all.filter((t) => (
        t.note.toLowerCase().includes(q)
        || (t.category && catById(t.category).name.toLowerCase().includes(q))
        || (t.amount / 100).toFixed(2).includes(q)
      ));
      const spend = sum(items.filter((t) => t.type === 'debit')) - sum(items.filter((t) => t.type === 'credit'));
      head = `<div class="result-line">${items.length} result${items.length === 1 ? '' : 's'} · net ${money(spend)}</div>`;
    } else {
      items = all.filter((t) => inMonth(t));
      head = balanceHtml(acct) + summaryHtml(items, acct);
    }
    $('#summary').innerHTML = head;

    if (!items.length) {
      $('#entries').innerHTML = q
        ? '<div class="empty"><span class="emoji">🔍</span><strong>No matches</strong>Try a different search.</div>'
        : `<div class="empty"><span class="emoji">🧾</span><strong>Nothing in ${esc(monthName(ui.year, ui.month, { month: 'long' }))}</strong>Tap the + button to add something.</div>`;
      return;
    }

    const groups = new Map();
    for (const t of [...items].sort(byNewest)) {
      if (!groups.has(t.date)) groups.set(t.date, []);
      groups.get(t.date).push(t);
    }

    let html = '';
    for (const [date, list] of groups) {
      const dayNet = sum(list.filter((t) => t.type === 'debit')) - sum(list.filter((t) => t.type === 'credit'));
      html += `<section class="day"><div class="day-head"><span>${esc(dayLabel(date))}</span><span class="num">${money(Math.abs(dayNet))}</span></div><ul class="day-list">`;
      for (const t of list) {
        const cat = t.type === 'credit' ? INCOME_BADGE : catById(t.category);
        const sub = txSubtitle(t, cat);
        const title = t.note || (t.type === 'credit' ? 'Income' : cat.name);
        html += `<li><button type="button" class="row" data-id="${esc(t.id)}">
          <span class="badge" style="background:${tint(cat.color)}">${esc(cat.emoji)}</span>
          <span class="row-main"><span class="row-title">${esc(title)}</span>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}</span>
          <span class="row-amt${t.type === 'credit' ? ' credit' : ''}">${t.type === 'credit' ? '+' : ''}${money(t.amount)}</span></button></li>`;
      }
      html += '</ul></section>';
    }
    $('#entries').innerHTML = html;
  }

  function balanceHtml(acct) {
    const bal = computeBalance(acct);
    return `<div class="card balance-card"><span class="label">${esc(acct.name)} balance</span><span class="amt${bal < 0 ? ' neg' : ''}">${money(bal)}</span></div>`;
  }

  function summaryHtml(items, acct) {
    const total = sum(items.filter((t) => t.type === 'debit'));
    const today = new Date();
    const monthIndex = ui.year * 12 + ui.month;
    const nowIndex = today.getFullYear() * 12 + today.getMonth();
    const days = monthIndex === nowIndex ? today.getDate() : new Date(ui.year, ui.month + 1, 0).getDate();
    const avg = monthIndex > nowIndex ? 0 : Math.round(total / days);
    const budget = acct.budget;

    let budgetHtml = '';
    if (budget > 0) {
      const pct = Math.min(100, (total / budget) * 100);
      const over = total > budget;
      budgetHtml = `<div class="budget-bar${over ? ' over' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
        <div class="budget-text"><span class="${over ? 'over' : ''}">${over ? `Over by ${money(total - budget)}` : `${money(budget - total)} left`}</span><span>of ${money(budget)}</span></div>`;
    }

    return `<div class="card summary">
      <div class="label">Spent in ${esc(monthName(ui.year, ui.month, { month: 'long' }))}</div>
      <div class="total">${money(total)}</div>
      ${budgetHtml}
      <div class="meta"><span>${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span><span class="num">${money(avg)} / day</span></div>
    </div>`;
  }

  /* ---------- Rendering: stats ---------- */

  function categoryTotals(items) {
    const map = new Map();
    for (const t of items) map.set(t.category, (map.get(t.category) || 0) + t.amount);
    return [...map].map(([id, total]) => ({ cat: catById(id), total })).sort((a, b) => b.total - a.total);
  }

  function donutSvg(rows, total) {
    let acc = 0;
    const segs = rows.map((r) => {
      const pct = (r.total / total) * 100;
      const dash = rows.length > 1 ? Math.max(pct - 0.8, 0.2) : pct;
      const seg = `<circle cx="21" cy="21" r="15.9155" stroke="${r.cat.color}" stroke-width="5" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${25 - acc}"/>`;
      acc += pct;
      return seg;
    }).join('');
    return `<svg viewBox="0 0 42 42" role="img" aria-label="Spending by category"><circle cx="21" cy="21" r="15.9155" stroke="var(--track)" stroke-width="5"/>${segs}</svg>`;
  }

  function renderStats() {
    const acct = activeAccount();
    const forAccount = (y, m) => state.transactions.filter((t) => t.accountId === acct.id && t.type === 'debit' && inMonth(t, y, m));
    const items = forAccount(ui.year, ui.month);
    const total = sum(items);
    const host = $('#view-stats');

    const prev = new Date(ui.year, ui.month - 1, 1);
    const prevTotal = sum(forAccount(prev.getFullYear(), prev.getMonth()));
    let compare = '';
    if (prevTotal > 0 && total > 0) {
      const change = Math.round(((total - prevTotal) / prevTotal) * 100);
      const prevName = monthName(prev.getFullYear(), prev.getMonth(), { month: 'long' });
      compare = change === 0
        ? `<span class="sub">Same as ${esc(prevName)}</span>`
        : `<span class="sub"><span class="${change > 0 ? 'up' : 'down'}">${change > 0 ? '▲' : '▼'} ${Math.abs(change)}%</span> ${change > 0 ? 'more' : 'less'} than ${esc(prevName)}</span>`;
    }

    let html = `<div class="card stat-total"><span class="sub">Total spent</span><span class="big">${money(total)}</span>${compare}</div>`;

    if (!total) {
      html += '<div class="empty"><span class="emoji">📊</span><strong>Nothing to chart yet</strong>Add some expenses to see where your money goes.</div>';
    } else {
      const rows = categoryTotals(items);
      html += `<div class="card"><div class="donut">${donutSvg(rows, total)}<div class="donut-center"><b>${moneyCompact(total)}</b><span>${rows.length} categor${rows.length === 1 ? 'y' : 'ies'}</span></div></div>
        <ul class="breakdown">${rows.map((r) => {
          const pct = (r.total / total) * 100;
          return `<li><div class="brk-top"><span class="dot" style="background:${r.cat.color}"></span><span class="name">${esc(r.cat.emoji)} ${esc(r.cat.name)}</span><span class="pct">${pct < 1 ? '<1' : Math.round(pct)}%</span><span class="amt">${money(r.total)}</span></div>
            <div class="brk-bar"><i style="width:${pct}%;background:${r.cat.color}"></i></div></li>`;
        }).join('')}</ul></div>`;
    }

    // Six-month trend ending at the selected month.
    const totals = new Map();
    for (const t of state.transactions) {
      if (t.accountId !== acct.id || t.type !== 'debit') continue;
      const key = t.date.slice(0, 7);
      totals.set(key, (totals.get(key) || 0) + t.amount);
    }
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ui.year, ui.month - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(), total: totals.get(monthKey(d.getFullYear(), d.getMonth())) || 0 });
    }
    const max = Math.max(...months.map((x) => x.total), 1);
    html += `<h2 class="section-title">Last 6 months</h2><div class="card"><div class="trend">${months.map((x) => {
      const isCur = x.y === ui.year && x.m === ui.month;
      return `<button type="button" class="${isCur ? 'cur' : ''}" data-y="${x.y}" data-m="${x.m}" aria-label="${esc(monthName(x.y, x.m, { month: 'long', year: 'numeric' }))}: ${money(x.total)}">
        <span class="val">${x.total ? moneyCompact(x.total) : ''}</span><span class="col" style="height:${Math.max(2, (x.total / max) * 100)}px"></span>
        <span class="mon">${esc(monthName(x.y, x.m, { month: 'short' }))}</span></button>`;
    }).join('')}</div></div>`;

    host.innerHTML = html;
  }

  /* ---------- Rendering: settings ---------- */

  function currencyOptions(selected, namesFmt) {
    const codes = CURRENCIES.includes(selected) ? CURRENCIES : [selected, ...CURRENCIES];
    return codes.map((c) => `<option value="${c}"${c === selected ? ' selected' : ''}>${c}${namesFmt ? ' – ' + esc(namesFmt.of(c) || '') : ''}</option>`).join('');
  }

  function renderSettings() {
    const s = state.settings;
    let names = null;
    try { names = new Intl.DisplayNames(undefined, { type: 'currency' }); } catch (e) { /* fall back to codes */ }

    $('#view-settings').innerHTML = `
      <h2 class="section-title">Accounts</h2>
      <div class="card group">
        <ul class="cat-list">${state.accounts.map((a) => `<li>
          <span class="badge" style="background:${tint('#14161A')}">${a.id === state.activeAccountId ? '★' : '🏦'}</span>
          <span class="name">${esc(a.name)} <span style="color:var(--muted);font-weight:400">(${esc(a.currency)}${a.remoteTag ? ' · ' + esc(a.remoteTag) : ''})</span></span>
          <button type="button" class="link-btn" data-edit-account="${esc(a.id)}" style="color:var(--accent)">Edit</button></li>`).join('')}
        </ul>
      </div>
      <div class="card btn-stack">
        <button type="button" class="btn" data-add-account>+ Add account</button>
      </div>

      <h2 class="section-title">Categories</h2>
      <div class="card group">
        <ul class="cat-list">${s.categories.map((c) => `<li>
          <span class="badge" style="background:${tint(c.color)}">${esc(c.emoji)}</span><span class="name">${esc(c.name)}</span>
          ${c.id === 'other' ? '' : `<button type="button" class="link-btn" data-remove-cat="${esc(c.id)}">Remove</button>`}</li>`).join('')}
        </ul>
        <form class="cat-form" id="catForm">
          <input id="catEmoji" maxlength="8" placeholder="🏷️" aria-label="Emoji">
          <input id="catName" maxlength="40" placeholder="New category" aria-label="Category name" autocomplete="off">
          <button class="btn" type="submit">Add</button>
        </form>
      </div>

      <h2 class="section-title">Automatic sync (SMS → transactions)</h2>
      <div class="card group">
        <label class="field-stack"><span>Sync URL</span>
          <input id="syncUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false"
            placeholder="https://script.google.com/macros/s/…/exec" value="${esc(s.syncUrl)}"></label>
        <label class="field-stack"><span>Secret</span>
          <input id="syncSecret" type="text" autocomplete="off" spellcheck="false"
            placeholder="Shared secret from your script" value="${esc(s.syncSecret)}"></label>
      </div>
      <div class="card btn-stack">
        <button type="button" class="btn" data-act="sync">Sync now</button>
      </div>
      <p class="note">${syncStatusText(s)}
        Each account's Sync tag (edit an account above) must match the "account" value its iOS Shortcut sends.</p>

      <h2 class="section-title">Your data</h2>
      <div class="card btn-stack">
        <button type="button" class="btn" data-act="csv">Export as CSV</button>
        <button type="button" class="btn" data-act="backup">Back up (JSON)</button>
        <label class="btn file-btn">Restore from backup<input type="file" id="restore" accept="application/json,.json" hidden></label>
        <button type="button" class="btn danger" data-act="erase">Erase all data</button>
      </div>
      <p class="note">${state.transactions.length} entr${state.transactions.length === 1 ? 'y' : 'ies'} across ${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}, stored on this device only.
        ${storageOk ? '' : '<strong>Storage is unavailable, so changes will be lost when you close the app.</strong>'}
        Back up now and then, because clearing Safari data or deleting the app also deletes everything.
        A backup file includes your sync secret, so keep it as private as a password.</p>`;
  }

  function syncStatusText(s) {
    if (!s.syncUrl || !s.syncSecret) {
      return 'Auto-import bank SMS as transactions, free, via a Google Sheet and an iOS Shortcut. See the README for setup, then paste the Web App URL and secret above.';
    }
    if (!s.syncLastAt) return 'Set up but not synced yet. Tap "Sync now" once the iOS Shortcut has sent at least one transaction.';
    return `Last synced ${new Date(s.syncLastAt).toLocaleString()}. Opening the app checks for new transactions automatically.`;
  }

  /* ---------- Toast ---------- */

  let toastTimer;
  function toast(text, actionLabel, action) {
    const el = $('#toast');
    $('#toastText').textContent = text;
    const btn = $('#toastAction');
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || '';
    btn.onclick = () => { hideToast(); if (action) action(); };
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 3500);
  }
  function hideToast() { clearTimeout(toastTimer); $('#toast').hidden = true; }

  /* ---------- Add / edit transaction sheet ---------- */

  const sheet = $('#sheet');
  let editingId = null;

  function openSheet(tx) {
    editingId = tx ? tx.id : null;
    const acct = activeAccount();
    $('#sheetTitle').textContent = tx ? 'Edit entry' : 'New entry';
    $('#deleteBtn').hidden = !tx;
    $('#formError').hidden = true;

    const type = tx ? tx.type : 'debit';
    document.querySelector(`#typeToggle input[value="${type}"]`).checked = true;
    updateSheetForType(type);

    const symbol = moneyFmt.formatToParts(0).find((p) => p.type === 'currency');
    $('#curSymbol').textContent = symbol ? symbol.value : '';

    const selected = tx ? tx.category : state.settings.lastCategory;
    $('#chips').innerHTML = state.settings.categories.map((c) => `<label class="chip">
      <input type="radio" name="cat" value="${esc(c.id)}"${c.id === selected ? ' checked' : ''}><span>${esc(c.emoji)} ${esc(c.name)}</span></label>`).join('');

    $('#fxCurrency').innerHTML = CURRENCIES.filter((c) => c !== acct.currency).map((c) => `<option value="${c}">${c}</option>`).join('');
    if (tx && tx.originalCurrency) {
      $('#fxRow').hidden = false;
      $('#fxCurrency').value = tx.originalCurrency;
      $('#amount').value = String(tx.originalAmount / 100);
      $('#fxNote').textContent = `≈ ${money(tx.amount)} at ${tx.fxRate.toFixed(2)}`;
    } else {
      $('#fxRow').hidden = true;
      $('#amount').value = tx ? String(tx.amount / 100) : '';
      $('#fxNote').textContent = '';
    }
    fitAmount();
    $('#date').value = tx ? tx.date : isoDate(new Date());
    $('#note').value = tx ? tx.note : '';

    sheet.showModal();
    if (!tx) $('#amount').focus();
  }

  function updateSheetForType(type) {
    const isCredit = type === 'credit';
    $('#catLabel').hidden = isCredit;
    $('#chips').hidden = isCredit;
    $('#sheetTitle').textContent = editingId ? 'Edit entry' : (isCredit ? 'New income' : 'New expense');
  }
  document.querySelectorAll('#typeToggle input').forEach((r) => r.addEventListener('change', () => updateSheetForType(r.value)));

  function closeSheet() { if (sheet.open) sheet.close(); }

  // Size the amount box to its text so the currency symbol hugs the number.
  function fitAmount() {
    const input = $('#amount');
    input.style.width = `${Math.min(Math.max(input.value.length, 4) + 0.5, 11)}ch`;
  }
  $('#amount').addEventListener('input', fitAmount);

  $('#fxToggle').addEventListener('click', () => {
    const row = $('#fxRow');
    row.hidden = !row.hidden;
    $('#fxNote').textContent = '';
  });

  function showFormError(msg) {
    const el = $('#formError');
    el.textContent = msg;
    el.hidden = false;
  }

  async function submitExpense(ev) {
    ev.preventDefault();
    const acct = activeAccount();
    const type = document.querySelector('#typeToggle input:checked').value;
    const enteredAmount = parseAmount($('#amount').value);
    const date = $('#date').value;
    const checked = document.querySelector('#chips input:checked');
    const fxOn = !$('#fxRow').hidden;
    const fxCurrency = $('#fxCurrency').value;

    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) { showFormError('Enter an amount greater than zero.'); $('#amount').focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showFormError('Pick a date.'); return; }
    if (type === 'debit' && !checked) { showFormError('Pick a category.'); return; }

    const fields = {
      type, date, note: $('#note').value.trim(),
      category: type === 'debit' ? checked.value : '',
    };

    if (fxOn && fxCurrency !== acct.currency) {
      const saveBtn = $('#saveBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Converting…';
      const result = await fetchFxRate(fxCurrency);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      if (!result.ok) { showFormError(result.error); return; }
      fields.amount = Math.round(enteredAmount * result.rate);
      fields.originalAmount = enteredAmount;
      fields.originalCurrency = fxCurrency;
      fields.fxRate = result.rate;
      fields.unconverted = false;
    } else {
      fields.amount = enteredAmount;
      fields.originalAmount = undefined;
      fields.originalCurrency = undefined;
      fields.fxRate = undefined;
      fields.unconverted = false;
    }

    if (editingId) {
      const t = state.transactions.find((x) => x.id === editingId);
      if (t) { delete t.originalAmount; delete t.originalCurrency; delete t.fxRate; Object.assign(t, fields); }
    } else {
      state.transactions.push({ id: uid(), accountId: acct.id, createdAt: Date.now(), remote: false, ...fields });
    }
    if (type === 'debit') state.settings.lastCategory = fields.category;
    save();

    const d = parseISO(date);
    ui.year = d.getFullYear();
    ui.month = d.getMonth();
    ui.query = '';
    $('#search').value = '';
    closeSheet();
    render();
  }

  function deleteExpense(id) {
    const idx = state.transactions.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [removed] = state.transactions.splice(idx, 1);
    save();
    render();
    toast('Entry deleted', 'Undo', () => {
      state.transactions.push(removed);
      save();
      render();
    });
  }

  /* ---------- Add / edit account sheet ---------- */

  const accountSheet = $('#accountSheet');
  let editingAccountId = null;

  function openAccountSheet(account) {
    editingAccountId = account ? account.id : null;
    $('#accountSheetTitle').textContent = account ? 'Edit account' : 'New account';
    $('#acctDeleteBtn').hidden = !account || state.accounts.length < 2;
    $('#accountFormError').hidden = true;

    let names = null;
    try { names = new Intl.DisplayNames(undefined, { type: 'currency' }); } catch (e) { /* ignore */ }
    $('#acctCurrency').innerHTML = currencyOptions(account ? account.currency : guessCurrency(), names);

    $('#acctName').value = account ? account.name : '';
    $('#acctBalance').value = account ? String(account.startingBalance / 100) : '';
    $('#acctBalanceDate').value = account ? account.startingDate : isoDate(new Date());
    $('#acctBudget').value = account && account.budget ? String(account.budget / 100) : '';
    $('#acctTag').value = account ? account.remoteTag : '';

    accountSheet.showModal();
    if (!account) $('#acctName').focus();
  }

  function closeAccountSheet() { if (accountSheet.open) accountSheet.close(); }

  $('#accountForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = $('#acctName').value.trim();
    const errEl = $('#accountFormError');
    errEl.hidden = true;
    if (!name) { errEl.textContent = 'Give the account a name.'; errEl.hidden = false; return; }

    const balRaw = $('#acctBalance').value.trim();
    const balance = balRaw === '' ? 0 : parseAmount(balRaw);
    if (!Number.isFinite(balance)) { errEl.textContent = 'Enter a valid starting balance.'; errEl.hidden = false; return; }

    const budgetRaw = $('#acctBudget').value.trim();
    const budget = budgetRaw === '' ? 0 : parseAmount(budgetRaw);
    if (!Number.isFinite(budget) || budget < 0) { errEl.textContent = 'Enter a valid budget.'; errEl.hidden = false; return; }

    const tag = $('#acctTag').value.trim();
    if (state.accounts.some((a) => a.id !== editingAccountId && a.remoteTag && a.remoteTag === tag)) {
      errEl.textContent = 'Another account already uses that sync tag.'; errEl.hidden = false; return;
    }

    const fields = {
      name, budget,
      currency: $('#acctCurrency').value,
      startingBalance: balance,
      startingDate: $('#acctBalanceDate').value || isoDate(new Date()),
      remoteTag: tag,
    };

    if (editingAccountId) {
      const a = acctById(editingAccountId);
      if (a) Object.assign(a, fields);
    } else {
      const a = freshAccount(fields);
      state.accounts.push(a);
      state.activeAccountId = a.id;
    }
    save();
    closeAccountSheet();
    render();
  });

  $('#acctDeleteBtn').addEventListener('click', () => {
    if (!editingAccountId || state.accounts.length < 2) return;
    const acct = acctById(editingAccountId);
    const used = state.transactions.filter((t) => t.accountId === editingAccountId).length;
    const fallback = state.accounts.find((a) => a.id !== editingAccountId);
    const msg = used
      ? `Remove "${acct.name}"? Its ${used} entr${used === 1 ? 'y' : 'ies'} will move to "${fallback.name}".`
      : `Remove "${acct.name}"?`;
    if (!confirm(msg)) return;
    for (const t of state.transactions) if (t.accountId === editingAccountId) t.accountId = fallback.id;
    state.accounts = state.accounts.filter((a) => a.id !== editingAccountId);
    if (state.activeAccountId === editingAccountId) state.activeAccountId = fallback.id;
    save();
    closeAccountSheet();
    render();
  });

  /* ---------- Data import / export ---------- */

  async function saveFile(name, mime, text) {
    const file = new File([text], name, { type: mime });
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function csvCell(value) {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCSV() {
    const rows = [['Account', 'Date', 'Type', 'Category', 'Amount', 'Note']];
    for (const t of [...state.transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))) {
      const acct = acctById(t.accountId);
      rows.push([acct ? acct.name : '', t.date, t.type, t.category ? catById(t.category).name : '', (t.amount / 100).toFixed(2), t.note]);
    }
    const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    saveFile(`pennywise-${isoDate(new Date())}.csv`, 'text/csv', csv);
  }

  function exportBackup() {
    saveFile(`pennywise-backup-${isoDate(new Date())}.json`, 'application/json', JSON.stringify(state, null, 2));
  }

  async function restoreBackup(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || (!Array.isArray(parsed.transactions) && !Array.isArray(parsed.expenses))) throw new Error('not a backup');
      const next = normalize(parsed);
      if (!confirm(`Replace your current data with this backup (${next.transactions.length} entries, ${next.accounts.length} account(s))?`)) return;
      state = next;
      save();
      render();
      toast('Backup restored');
    } catch (e) {
      toast('That file is not a valid Pennywise backup.');
    }
  }

  /* ---------- SMS sync + live FX (Google Apps Script backend) ---------- */

  async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { signal: ctrl.signal, cache: 'no-store' }); }
    finally { clearTimeout(timer); }
  }

  // Some browsers/deployments block the plain fetch() to an Apps Script URL with a CORS
  // error even though the endpoint itself is fine. JSONP (a <script> tag) sidesteps CORS
  // entirely, so it's used as a fallback if the direct fetch fails for any reason.
  function jsonpFetch(url, ms) {
    return new Promise((resolve, reject) => {
      const cbName = `__pwcb${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => { cleanup(); reject(new Error('jsonp timeout')); }, ms);
      function cleanup() { delete window[cbName]; script.remove(); clearTimeout(timer); }
      window[cbName] = (data) => { cleanup(); resolve(data); };
      script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cbName}`;
      script.onerror = () => { cleanup(); reject(new Error('jsonp load error')); };
      document.head.appendChild(script);
    });
  }

  async function fetchJson(url, ms) {
    try {
      const res = await fetchWithTimeout(url, ms);
      return await res.json();
    } catch (err) {
      return jsonpFetch(url, ms);
    }
  }

  /** Live currency conversion for manual entries, via the Apps Script backend (it scrapes
   * COMBANK's published rate at the moment of the call — see backend/Code.gs.txt). */
  async function fetchFxRate(fromCurrency) {
    const { syncUrl, syncSecret } = state.settings;
    if (!syncUrl || !syncSecret) return { ok: false, error: 'Set up Automatic sync in Settings first — converting currencies needs it.' };
    try {
      const sep = syncUrl.includes('?') ? '&' : '?';
      const url = `${syncUrl}${sep}secret=${encodeURIComponent(syncSecret)}&action=rate&from=${encodeURIComponent(fromCurrency)}`;
      const data = await fetchJson(url, 15000);
      if (data && data.ok === true && Number.isFinite(data.rate) && data.rate > 0) return { ok: true, rate: data.rate };
      return { ok: false, error: (data && data.error) || `${fromCurrency} isn't on COMBANK's rate page.` };
    } catch (err) {
      return { ok: false, error: 'Could not reach the rate service. Check your connection.' };
    }
  }

  let syncing = false;

  /** Pulls new rows from the Apps Script sheet, routes each to the local account whose
   * Sync tag matches, and adds it as a debit or credit transaction. */
  async function syncNow(manual) {
    const { syncUrl, syncSecret } = state.settings;
    if (!syncUrl || !syncSecret) {
      if (manual) toast('Add a Sync URL and secret first.');
      return;
    }
    if (syncing) return;
    syncing = true;
    if (manual) toast('Syncing…');

    try {
      const sep = syncUrl.includes('?') ? '&' : '?';
      const url = `${syncUrl}${sep}secret=${encodeURIComponent(syncSecret)}&since=${state.settings.syncCursor}`;
      const data = await fetchJson(url, 20000);
      if (!data || data.ok !== true || !Array.isArray(data.rows)) throw new Error((data && data.error) || 'bad response');

      let added = 0;
      let unmatched = 0;
      const cancelled = [];

      for (const row of [...data.rows].sort((a, b) => Number(a.id) - Number(b.id))) {
        const rowId = Number(row.id);
        if (!Number.isFinite(rowId)) continue;
        state.settings.syncCursor = Math.max(state.settings.syncCursor, rowId);

        if (row.type === 'cancelled') { cancelled.push(row.merchant || row.raw || 'a transaction'); continue; }
        if (row.type !== 'debit' && row.type !== 'credit') continue;

        const account = state.accounts.find((a) => (a.remoteTag || '') === (row.account || ''));
        if (!account) { unmatched++; continue; }

        const rawAmount = Math.round(Number(row.amount) * 100);
        if (!Number.isFinite(rawAmount) || rawAmount <= 0) continue;

        const id = `remote:${rowId}`;
        if (state.transactions.some((x) => x.id === id)) continue;

        const date = /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : isoDate(new Date());
        const hasConverted = Number.isFinite(row.convertedAmount) && row.convertedAmount > 0;
        const currency = row.currency || account.currency;
        const unconverted = currency !== account.currency && !hasConverted;
        const amount = hasConverted ? Math.round(row.convertedAmount * 100) : rawAmount;

        const tx = {
          id, accountId: account.id, createdAt: Date.now(), remote: true,
          type: row.type, amount, date,
          note: String(row.merchant || row.raw || '').slice(0, 200),
          category: row.type === 'debit' ? guessCategory(`${row.merchant || ''} ${row.raw || ''}`) : '',
          unconverted,
        };
        if (currency !== account.currency) {
          tx.originalAmount = rawAmount;
          tx.originalCurrency = currency;
          if (Number.isFinite(row.fxRate) && row.fxRate > 0) tx.fxRate = row.fxRate;
        }
        state.transactions.push(tx);
        added++;
      }

      state.settings.syncLastAt = Date.now();
      save();
      if (added || unmatched || cancelled.length) render(); else if (ui.tab === 'settings') renderSettings();

      if (cancelled.length) {
        toast(`⚠ COMBANK reported ${cancelled.length} cancelled transaction${cancelled.length === 1 ? '' : 's'} (${cancelled[0]}) — check for a matching entry to remove.`);
      } else if (unmatched) {
        toast(`${unmatched} synced transaction${unmatched === 1 ? '' : 's'} had no matching account — check Sync tags in Settings.`);
      } else if (added) {
        toast(`Synced ${added} new entr${added === 1 ? 'y' : 'ies'} from SMS`);
      } else if (manual) {
        toast('Up to date — no new transactions.');
      }
    } catch (err) {
      if (manual) toast('Could not sync. Check the Sync URL and secret, then try again.');
    } finally {
      syncing = false;
    }
  }

  function maybeAutoSync() {
    if (!state.settings.syncUrl || !state.settings.syncSecret) return;
    if (Date.now() - (state.settings.syncLastAt || 0) < 30000) return; // avoid hammering on rapid foreground/background
    syncNow(false);
  }

  /* ---------- Events ---------- */

  function shiftMonth(delta) {
    const d = new Date(ui.year, ui.month + delta, 1);
    ui.year = d.getFullYear();
    ui.month = d.getMonth();
    render();
  }

  $('#prevMonth').addEventListener('click', () => shiftMonth(-1));
  $('#nextMonth').addEventListener('click', () => shiftMonth(1));
  $('#monthLabel').addEventListener('click', () => {
    const t = new Date();
    ui.year = t.getFullYear();
    ui.month = t.getMonth();
    render();
  });

  $('#accountBar').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-add-account]')) { openAccountSheet(null); return; }
    const pill = ev.target.closest('.acct-pill[data-id]');
    if (!pill) return;
    state.activeAccountId = pill.dataset.id;
    render();
  });

  document.querySelector('.tabbar').addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (!tab) return;
    ui.tab = tab.dataset.tab;
    render();
    window.scrollTo(0, 0);
  });

  $('#fab').addEventListener('click', () => openSheet());

  $('#entries').addEventListener('click', (ev) => {
    const row = ev.target.closest('.row');
    const tx = row && state.transactions.find((t) => t.id === row.dataset.id);
    if (tx) openSheet(tx);
  });

  $('#search').addEventListener('input', (ev) => { ui.query = ev.target.value; renderList(); });

  $('#view-stats').addEventListener('click', (ev) => {
    const bar = ev.target.closest('.trend button');
    if (!bar) return;
    ui.year = Number(bar.dataset.y);
    ui.month = Number(bar.dataset.m);
    render();
  });

  $('#expenseForm').addEventListener('submit', submitExpense);
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#deleteBtn').addEventListener('click', () => {
    const id = editingId;
    closeSheet();
    deleteExpense(id);
  });
  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) closeSheet(); });

  $('#accountSheetClose').addEventListener('click', closeAccountSheet);
  accountSheet.addEventListener('click', (ev) => { if (ev.target === accountSheet) closeAccountSheet(); });

  const settingsView = $('#view-settings');

  settingsView.addEventListener('change', (ev) => {
    if (ev.target.id === 'restore') {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (file) restoreBackup(file);
    } else if (ev.target.id === 'syncUrl') {
      const value = ev.target.value.trim();
      if (value && !/^https:\/\//i.test(value)) { toast('The Sync URL should start with https://'); render(); return; }
      if (value !== state.settings.syncUrl) { state.settings.syncCursor = 0; state.settings.syncLastAt = 0; }
      state.settings.syncUrl = value;
      save();
      render();
    } else if (ev.target.id === 'syncSecret') {
      state.settings.syncSecret = ev.target.value.trim();
      save();
      render();
    }
  });

  settingsView.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'catForm') return;
    ev.preventDefault();
    const name = $('#catName').value.trim();
    if (!name) return;
    const cats = state.settings.categories;
    if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) { toast('That category already exists.'); return; }
    const otherAt = cats.findIndex((c) => c.id === 'other'); // keep "Other" last
    cats.splice(otherAt < 0 ? cats.length : otherAt, 0, {
      id: uid(),
      name,
      emoji: $('#catEmoji').value.trim() || '🏷️',
      color: EXTRA_COLORS[cats.length % EXTRA_COLORS.length],
    });
    save();
    render();
  });

  settingsView.addEventListener('click', (ev) => {
    const editAcct = ev.target.closest('[data-edit-account]');
    if (editAcct) { openAccountSheet(acctById(editAcct.dataset.editAccount)); return; }
    if (ev.target.closest('[data-add-account]')) { openAccountSheet(null); return; }

    const remove = ev.target.closest('[data-remove-cat]');
    if (remove) {
      const id = remove.dataset.removeCat;
      const cat = catById(id);
      const used = state.transactions.filter((t) => t.category === id).length;
      const msg = used
        ? `Remove "${cat.name}"? Its ${used} entr${used === 1 ? 'y' : 'ies'} will move to "Other".`
        : `Remove "${cat.name}"?`;
      if (!confirm(msg)) return;
      for (const t of state.transactions) if (t.category === id) t.category = 'other';
      state.settings.categories = state.settings.categories.filter((c) => c.id !== id);
      if (state.settings.lastCategory === id) state.settings.lastCategory = 'other';
      save();
      render();
      return;
    }

    const act = ev.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'csv') exportCSV();
    else if (act.dataset.act === 'backup') exportBackup();
    else if (act.dataset.act === 'sync') syncNow(true);
    else if (act.dataset.act === 'erase') {
      if (!state.transactions.length) { toast('There is nothing to erase.'); return; }
      if (!confirm(`Permanently delete all ${state.transactions.length} entries across every account? This cannot be undone.`)) return;
      state.transactions = [];
      save();
      render();
      toast('All data erased');
    }
  });

  /* ---------- Start ---------- */

  render();
  maybeAutoSync();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybeAutoSync();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
