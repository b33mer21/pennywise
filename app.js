(() => {
  'use strict';

  /* ---------- Constants ---------- */

  const STORE_KEY = 'pennywise:v1';

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

  const CURRENCIES = [
    'USD', 'EUR', 'GBP', 'INR', 'PKR', 'BDT', 'AED', 'SAR', 'QAR', 'KWD', 'CAD', 'AUD', 'NZD',
    'JPY', 'CNY', 'KRW', 'SGD', 'MYR', 'IDR', 'PHP', 'THB', 'TRY', 'EGP', 'NGN', 'ZAR', 'KES',
    'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'BRL', 'MXN',
  ];
  const REGION_CURRENCY = {
    US: 'USD', GB: 'GBP', IN: 'INR', PK: 'PKR', BD: 'BDT', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD',
    CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', KR: 'KRW', SG: 'SGD', MY: 'MYR', ID: 'IDR',
    PH: 'PHP', TH: 'THB', TR: 'TRY', EG: 'EGP', NG: 'NGN', ZA: 'ZAR', KE: 'KES', CH: 'CHF', SE: 'SEK',
    NO: 'NOK', DK: 'DKK', PL: 'PLN', BR: 'BRL', MX: 'MXN',
    DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR',
  };

  /* ---------- Small helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const sum = (items) => items.reduce((t, e) => t + e.amount, 0);
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

  function freshState() {
    return {
      expenses: [],
      settings: {
        currency: guessCurrency(),
        budget: 0,
        lastCategory: 'food',
        categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      },
    };
  }

  /** Coerces anything loaded from storage or a backup file into a valid state. */
  function normalize(data) {
    const base = freshState();
    const src = (data && typeof data === 'object') ? data : {};
    const s = (src.settings && typeof src.settings === 'object') ? src.settings : {};

    let categories = Array.isArray(s.categories)
      ? s.categories
          .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && /^#[0-9a-f]{6}$/i.test(c.color || ''))
          .map((c) => ({ id: c.id, name: c.name.slice(0, 40), emoji: String(c.emoji || '🏷️').slice(0, 8), color: c.color }))
      : [];
    if (!categories.length) categories = base.settings.categories;
    if (!categories.some((c) => c.id === 'other')) categories.push({ ...FALLBACK_CATEGORY });
    const known = new Set(categories.map((c) => c.id));

    const expenses = (Array.isArray(src.expenses) ? src.expenses : [])
      .filter((e) => e && Number.isFinite(e.amount) && e.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
      .map((e) => ({
        id: String(e.id || uid()),
        amount: Math.round(e.amount),
        category: known.has(e.category) ? e.category : 'other',
        date: e.date,
        note: String(e.note || '').slice(0, 200),
        createdAt: Number(e.createdAt) || Date.now(),
      }));

    return {
      expenses,
      settings: {
        currency: (typeof s.currency === 'string' && isValidCurrency(s.currency)) ? s.currency : base.settings.currency,
        budget: Number.isFinite(s.budget) && s.budget > 0 ? Math.round(s.budget) : 0,
        lastCategory: known.has(s.lastCategory) ? s.lastCategory : 'food',
        categories,
      },
    };
  }

  let storageOk = true;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalize(JSON.parse(raw));
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

  /* ---------- Formatting ---------- */

  let moneyFmt;
  let compactFmt;
  function setFormatters() {
    const currency = state.settings.currency;
    moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    compactFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
  }
  const money = (cents) => moneyFmt.format(cents / 100);
  const moneyCompact = (cents) => compactFmt.format(cents / 100);

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
  const inMonth = (e, y = ui.year, m = ui.month) => e.date.startsWith(monthKey(y, m));

  /* ---------- Rendering: shell ---------- */

  function render() {
    setFormatters();

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

  /* ---------- Rendering: expenses list ---------- */

  function renderList() {
    const q = ui.query.trim().toLowerCase();
    let items;
    let head;

    if (q) {
      items = state.expenses.filter((e) => (
        e.note.toLowerCase().includes(q)
        || catById(e.category).name.toLowerCase().includes(q)
        || (e.amount / 100).toFixed(2).includes(q)
      ));
      head = `<div class="result-line">${items.length} result${items.length === 1 ? '' : 's'} · ${money(sum(items))}</div>`;
    } else {
      items = state.expenses.filter((e) => inMonth(e));
      head = summaryHtml(items);
    }
    $('#summary').innerHTML = head;

    if (!items.length) {
      $('#entries').innerHTML = q
        ? '<div class="empty"><span class="emoji">🔍</span><strong>No matches</strong>Try a different search.</div>'
        : `<div class="empty"><span class="emoji">🧾</span><strong>No expenses in ${esc(monthName(ui.year, ui.month, { month: 'long' }))}</strong>Tap the + button to add one.</div>`;
      return;
    }

    const groups = new Map();
    for (const e of [...items].sort(byNewest)) {
      if (!groups.has(e.date)) groups.set(e.date, []);
      groups.get(e.date).push(e);
    }

    let html = '';
    for (const [date, list] of groups) {
      html += `<section class="day"><div class="day-head"><span>${esc(dayLabel(date))}</span><span class="num">${money(sum(list))}</span></div><ul class="day-list">`;
      for (const e of list) {
        const cat = catById(e.category);
        html += `<li><button type="button" class="row" data-id="${esc(e.id)}">
          <span class="badge" style="background:${tint(cat.color)}">${esc(cat.emoji)}</span>
          <span class="row-main"><span class="row-title">${esc(e.note || cat.name)}</span>${e.note ? `<span class="row-sub">${esc(cat.name)}</span>` : ''}</span>
          <span class="row-amt">${money(e.amount)}</span></button></li>`;
      }
      html += '</ul></section>';
    }
    $('#entries').innerHTML = html;
  }

  function summaryHtml(items) {
    const total = sum(items);
    const today = new Date();
    const monthIndex = ui.year * 12 + ui.month;
    const nowIndex = today.getFullYear() * 12 + today.getMonth();
    const days = monthIndex === nowIndex ? today.getDate() : new Date(ui.year, ui.month + 1, 0).getDate();
    const avg = monthIndex > nowIndex ? 0 : Math.round(total / days);
    const budget = state.settings.budget;

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
      <div class="meta"><span>${items.length} expense${items.length === 1 ? '' : 's'}</span><span class="num">${money(avg)} / day</span></div>
    </div>`;
  }

  /* ---------- Rendering: stats ---------- */

  function categoryTotals(items) {
    const map = new Map();
    for (const e of items) map.set(e.category, (map.get(e.category) || 0) + e.amount);
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
    const items = state.expenses.filter((e) => inMonth(e));
    const total = sum(items);
    const host = $('#view-stats');

    const prev = new Date(ui.year, ui.month - 1, 1);
    const prevTotal = sum(state.expenses.filter((e) => inMonth(e, prev.getFullYear(), prev.getMonth())));
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
    for (const e of state.expenses) {
      const key = e.date.slice(0, 7);
      totals.set(key, (totals.get(key) || 0) + e.amount);
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

  function renderSettings() {
    const s = state.settings;
    let names = null;
    try { names = new Intl.DisplayNames(undefined, { type: 'currency' }); } catch (e) { /* fall back to codes */ }
    const codes = CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES];

    $('#view-settings').innerHTML = `
      <div class="card group">
        <label class="field"><span>Currency</span>
          <select id="currency">${codes.map((c) => `<option value="${c}"${c === s.currency ? ' selected' : ''}>${c}${names ? ' – ' + esc(names.of(c) || '') : ''}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Monthly budget</span>
          <input id="budget" inputmode="decimal" autocomplete="off" placeholder="None" value="${s.budget ? s.budget / 100 : ''}">
        </label>
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

      <h2 class="section-title">Your data</h2>
      <div class="card btn-stack">
        <button type="button" class="btn" data-act="csv">Export as CSV</button>
        <button type="button" class="btn" data-act="backup">Back up (JSON)</button>
        <label class="btn file-btn">Restore from backup<input type="file" id="restore" accept="application/json,.json" hidden></label>
        <button type="button" class="btn danger" data-act="erase">Erase all data</button>
      </div>
      <p class="note">${state.expenses.length} expense${state.expenses.length === 1 ? '' : 's'} stored on this device only. Nothing is sent anywhere.
        ${storageOk ? '' : '<strong>Storage is unavailable, so changes will be lost when you close the app.</strong>'}
        Back up now and then, because clearing Safari data or deleting the app also deletes your expenses.</p>`;
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

  /* ---------- Add / edit sheet ---------- */

  const sheet = $('#sheet');
  let editingId = null;

  function openSheet(expense) {
    editingId = expense ? expense.id : null;
    $('#sheetTitle').textContent = expense ? 'Edit expense' : 'New expense';
    $('#deleteBtn').hidden = !expense;
    $('#formError').hidden = true;

    const symbol = moneyFmt.formatToParts(0).find((p) => p.type === 'currency');
    $('#curSymbol').textContent = symbol ? symbol.value : '';

    const selected = expense ? expense.category : state.settings.lastCategory;
    $('#chips').innerHTML = state.settings.categories.map((c) => `<label class="chip">
      <input type="radio" name="cat" value="${esc(c.id)}"${c.id === selected ? ' checked' : ''}><span>${esc(c.emoji)} ${esc(c.name)}</span></label>`).join('');

    $('#amount').value = expense ? String(expense.amount / 100) : '';
    fitAmount();
    $('#date').value = expense ? expense.date : isoDate(new Date());
    $('#note').value = expense ? expense.note : '';

    sheet.showModal();
    if (!expense) $('#amount').focus();
  }

  function closeSheet() { if (sheet.open) sheet.close(); }

  // Size the amount box to its text so the currency symbol hugs the number.
  function fitAmount() {
    const input = $('#amount');
    input.style.width = `${Math.min(Math.max(input.value.length, 4) + 0.5, 11)}ch`;
  }
  $('#amount').addEventListener('input', fitAmount);

  function showFormError(msg) {
    const el = $('#formError');
    el.textContent = msg;
    el.hidden = false;
  }

  function submitExpense(ev) {
    ev.preventDefault();
    const amount = parseAmount($('#amount').value);
    const date = $('#date').value;
    const checked = document.querySelector('#chips input:checked');

    if (!Number.isFinite(amount) || amount <= 0) { showFormError('Enter an amount greater than zero.'); $('#amount').focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showFormError('Pick a date.'); return; }
    if (!checked) { showFormError('Pick a category.'); return; }

    const fields = { amount, date, category: checked.value, note: $('#note').value.trim() };
    if (editingId) {
      const e = state.expenses.find((x) => x.id === editingId);
      if (e) Object.assign(e, fields);
    } else {
      state.expenses.push({ id: uid(), createdAt: Date.now(), ...fields });
    }
    state.settings.lastCategory = fields.category;
    save();

    // Jump to the month of the saved expense so it's visible right away.
    const d = parseISO(date);
    ui.year = d.getFullYear();
    ui.month = d.getMonth();
    ui.query = '';
    $('#search').value = '';
    closeSheet();
    render();
  }

  function deleteExpense(id) {
    const idx = state.expenses.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const [removed] = state.expenses.splice(idx, 1);
    save();
    render();
    toast('Expense deleted', 'Undo', () => {
      state.expenses.push(removed);
      save();
      render();
    });
  }

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
    const rows = [['Date', 'Category', 'Amount', 'Note']];
    for (const e of [...state.expenses].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))) {
      rows.push([e.date, catById(e.category).name, (e.amount / 100).toFixed(2), e.note]);
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
      if (!parsed || !Array.isArray(parsed.expenses)) throw new Error('not a backup');
      const next = normalize(parsed);
      if (!confirm(`Replace your current data with this backup (${next.expenses.length} expenses)?`)) return;
      state = next;
      save();
      render();
      toast('Backup restored');
    } catch (e) {
      toast('That file is not a valid Pennywise backup.');
    }
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
    const expense = row && state.expenses.find((e) => e.id === row.dataset.id);
    if (expense) openSheet(expense);
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

  const settingsView = $('#view-settings');

  settingsView.addEventListener('change', (ev) => {
    if (ev.target.id === 'currency') {
      state.settings.currency = ev.target.value;
      save();
      render();
    } else if (ev.target.id === 'budget') {
      const raw = ev.target.value.trim();
      const cents = raw === '' ? 0 : parseAmount(raw);
      if (!Number.isFinite(cents) || cents < 0) { toast('Enter a valid budget amount.'); render(); return; }
      state.settings.budget = cents;
      save();
      render();
    } else if (ev.target.id === 'restore') {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (file) restoreBackup(file);
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
    const remove = ev.target.closest('[data-remove-cat]');
    if (remove) {
      const id = remove.dataset.removeCat;
      const cat = catById(id);
      const used = state.expenses.filter((e) => e.category === id).length;
      const msg = used
        ? `Remove "${cat.name}"? Its ${used} expense${used === 1 ? '' : 's'} will move to "Other".`
        : `Remove "${cat.name}"?`;
      if (!confirm(msg)) return;
      for (const e of state.expenses) if (e.category === id) e.category = 'other';
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
    else if (act.dataset.act === 'erase') {
      if (!state.expenses.length) { toast('There is nothing to erase.'); return; }
      if (!confirm(`Permanently delete all ${state.expenses.length} expenses? This cannot be undone.`)) return;
      state.expenses = [];
      save();
      render();
      toast('All expenses erased');
    }
  });

  /* ---------- Start ---------- */

  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
