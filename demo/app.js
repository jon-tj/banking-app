'use strict';

/* =========================================================
   FBD Bank — clickable demo of shared accounts, one-way
   transfer (OWT) accounts and deposit routers.
   No backend. State lives in memory and in localStorage, so
   changes survive a refresh until "Reset demo" is used.
   ========================================================= */

const STORE = 'fbd-bank-demo';
const VERSION = 1;
const DAY = 864e5;
const DEPOSIT_LIMIT = 10000000; // per operation (UC-05)

/* ---------- helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => (n < 0 ? '−' : '') + '₩' + Math.abs(Math.round(n)).toLocaleString('en-US');
const digits = v => parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0;
const fmtDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtTime = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const go = hash => { location.hash = hash; };
const shortWon = n => n >= 1e6 ? `₩${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `₩${Math.round(n / 1e3)}k` : won(n);
const isCompact = () => window.innerWidth < 640;

function makeNo(type) {
  const prefix = { spending: '1002', savings: '1005', owt: '3333', router: '7979' }[type];
  const d = () => Math.floor(Math.random() * 10);
  return `${prefix}-${d()}${d()}-${Array.from({ length: 7 }, d).join('')}`;
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  arrows: '<path d="M4 7h15l-4-4"/><path d="M20 17H5l4 4"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  split: '<path d="M3 12h6"/><path d="M9 12c4 0 5-6 11-6"/><path d="M9 12c4 0 5 6 11 6"/><path d="m17 3 3 3-3 3"/><path d="m17 15 3 3-3 3"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V7M12 17v-1.5M15.5 12H17M7 12h1.5"/>',
  funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.7c1.8.7 3 2.5 3.5 5.3"/>',
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  graph: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="5" r="2"/><circle cx="19.5" cy="5" r="2"/><circle cx="12" cy="20.5" r="1.5"/><path d="m6.2 6.4 3.6 3.6M17.8 6.4l-3.6 3.6M12 15v4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  out: '<path d="M15 4h4v16h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
};

function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function toast(msg, kind = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `${icon(kind === 'error' ? 'x' : 'check')}<span>${msg}</span>`;
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('hide'), 3200);
  setTimeout(() => t.remove(), 3600);
}

/* ---------- account types ---------- */

const TYPES = {
  spending: { label: 'Spending', icon: 'card',
    blurb: 'Your everyday account. Receives deposits, pays bills and sends money to your other accounts.',
    rules: ['Deposits allowed', 'Transfer to spending, savings and OWT', 'Payments allowed', 'Share with managers (two-way)'] },
  savings: { label: 'Savings', icon: 'vault',
    blurb: 'Money set aside. Filled from spending or by your router, never by direct deposit.',
    rules: ['No direct deposits', 'Transfer to spending and savings', 'No payments', 'Share with managers (two-way)'] },
  owt: { label: 'One-way transfer', short: 'OWT', icon: 'funnel',
    blurb: 'A shared pot that money can only flow into. Contributors send money in; payers spend from it.',
    rules: ['No direct deposits', 'Money can only come in', 'Payments by people with pay rights', 'Invite contributors (one-way)'] },
};

const PURPOSES = { spending: 'Shared spending', savings: 'Shared savings' };

/* ---------- seed data ---------- */

const PERSONAS = [
  { id: 'minji', story: 'Shares “Our home” with Joon, pays hiking club dues and gives to church. Her salary goes through a router.' },
  { id: 'joon', story: 'Minji’s partner. Sends a fixed amount from every paycheck to “Our home” and can pay from it.' },
  { id: 'hana', story: 'Treasurer of Seoul Trail Club. Owns the club’s OWT and is the only one who can pay from it.' },
  { id: 'choi', story: 'Treasurer of Grace Church. Owns the building fund OWT that the congregation feeds.' },
];

function addTx(s, t) {
  s.seq += 1;
  const rec = { id: 't' + s.seq, ts: Date.now(), ...t };
  s.tx.push(rec);
  return rec;
}

// Splits a router deposit. Percentages are of the received amount; every
// rule is capped by what is left, and the remainder goes to `rest`.
function splitPlan(rt, amount) {
  let left = amount;
  const out = [];
  for (const rule of rt.rules) {
    if (!rule.to) continue;
    let a = rule.mode === 'pct' ? Math.floor(amount * rule.value / 100) : rule.value;
    a = Math.min(a, left);
    if (a <= 0) continue;
    out.push({ to: rule.to, amount: a, why: rule.mode === 'pct' ? `${rule.value}% rule` : `Fixed ${won(rule.value)} rule` });
    left -= a;
  }
  if (left > 0 && rt.rest) out.push({ to: rt.rest, amount: left, why: 'Remainder', rest: true });
  return out;
}

function routeDeposit(s, rt, amount, payer, memo, actor, ts = Date.now()) {
  const d = addTx(s, { type: 'deposit', to: rt.id, amount, payer, memo, actor, ts });
  splitPlan(rt, amount).forEach((p, i) =>
    addTx(s, { type: 'transfer', from: rt.id, to: p.to, amount: p.amount, actor: rt.owner, via: d.id, memo: p.why, ts: ts + i + 1 }));
  return d;
}

function seed() {
  const now = Date.now();
  const ago = (d, h = 10) => { const t = new Date(now - d * DAY); t.setHours(h, (d * 7) % 60, 0, 0); return t.getTime(); };
  let r = 11;
  const rand = (min, max) => { r = (r * 9301 + 49297) % 233280; return Math.round((min + (r / 233280) * (max - min)) / 100) * 100; };

  const s = {
    v: VERSION, seq: 0, me: null,
    settings: { collapse: false, period: '90', showOut: true },
    users: [
      { id: 'minji', name: 'Minji Park', email: 'minji@example.com', hue: 252 },
      { id: 'joon', name: 'Joon Lee', email: 'joon@example.com', hue: 198 },
      { id: 'hana', name: 'Hana Jung', email: 'hana@example.com', hue: 330 },
      { id: 'jiho', name: 'Ji-ho Han', email: 'jiho@example.com', hue: 150 },
      { id: 'seoyeon', name: 'Seo-yeon Oh', email: 'seoyeon@example.com', hue: 18 },
      { id: 'taemin', name: 'Tae-min Yoon', email: 'taemin@example.com', hue: 95 },
      { id: 'choi', name: 'Choi Young-ho', email: 'choi@example.com', hue: 38 },
      { id: 'grace', name: 'Grace Moon', email: 'grace@example.com', hue: 285 },
      { id: 'daniel', name: 'Daniel Kang', email: 'daniel@example.com', hue: 172 },
    ],
    accounts: [], routers: [], tx: [],
  };

  const acc = (id, type, owner, name, extra = {}) =>
    s.accounts.push({ id, type, owner, name, no: makeNo(type), members: [], created: ago(120), ...extra });

  const spend = {};
  for (const u of s.users) { spend[u.id] = 'sp-' + u.id; acc(spend[u.id], 'spending', u.id, 'Everyday'); }
  acc('sv-minji', 'savings', 'minji', 'Rainy day');
  acc('sv-joon', 'savings', 'joon', 'Wedding fund', { members: [{ user: 'minji', role: 'manager' }] });
  acc('home', 'owt', 'minji', 'Our home', { purpose: 'spending', members: [{ user: 'joon', role: 'contributor', pay: true }] });
  acc('club', 'owt', 'hana', 'Seoul Trail Club', { purpose: 'savings',
    members: ['minji', 'jiho', 'seoyeon', 'taemin'].map(user => ({ user, role: 'contributor', pay: false })) });
  acc('church', 'owt', 'choi', 'Grace Church building fund', { purpose: 'savings',
    members: ['minji', 'grace', 'daniel', 'joon'].map(user => ({ user, role: 'contributor', pay: false })) });

  const rMinji = { id: 'rt-minji', owner: 'minji', no: makeNo('router'), rest: spend.minji,
    rules: [{ to: 'home', mode: 'pct', value: 30 }, { to: 'sv-minji', mode: 'fixed', value: 200000 }] };
  const rJoon = { id: 'rt-joon', owner: 'joon', no: makeNo('router'), rest: spend.joon,
    rules: [{ to: 'home', mode: 'fixed', value: 800000 }] };
  s.routers.push(rMinji, rJoon);

  const tx = t => addTx(s, t);
  const xfer = (from, to, amount, actor, memo, ts) => tx({ type: 'transfer', from, to, amount, actor, memo, ts });
  const pay = (from, payee, amount, actor, ref, ts) => tx({ type: 'payment', from, payee, ref, amount, actor, ts });

  const opening = { minji: 1800000, joon: 2400000, hana: 900000, jiho: 600000, seoyeon: 750000, taemin: 500000, choi: 1500000, grace: 1100000, daniel: 950000 };
  for (const [u, amt] of Object.entries(opening)) tx({ type: 'deposit', to: spend[u], amount: amt, payer: 'Opening balance', actor: u, ts: ago(100) });

  for (let k = 2; k >= 0; k--) {
    const m = k * 30;
    routeDeposit(s, rMinji, 3400000, 'Hanbit Design', 'Salary', 'minji', ago(m + 12, 9));
    routeDeposit(s, rJoon, 3900000, 'Seoul Metro', 'Salary', 'joon', ago(m + 12, 9));
    pay('home', 'Mapo Realty', 1150000, k % 2 ? 'joon' : 'minji', 'Rent', ago(m + 6));
    pay('home', 'KEPCO', rand(60000, 95000), 'joon', 'Electricity', ago(m + 9, 20));
    pay(spend.minji, 'SK Telecom', 65000, 'minji', 'Phone bill', ago(m + 10, 7));
    pay(spend.joon, 'Spoany Gym', 89000, 'joon', 'Membership', ago(m + 4, 7));
    xfer(spend.joon, 'sv-joon', 300000, 'joon', 'Monthly saving', ago(m + 11));
    xfer(spend.minji, 'sv-joon', 200000, 'minji', 'Wedding fund', ago(m + 11, 14));
    ['hana', 'minji', 'jiho', 'seoyeon', 'taemin'].forEach((u, i) => xfer(spend[u], 'club', 30000, u, 'Monthly dues', ago(m + 2 + i, 19)));
    [['choi', 200000], ['grace', 120000], ['daniel', 80000], ['minji', 50000], ['joon', 30000]]
      .forEach(([u, a], i) => xfer(spend[u], 'church', a, u, 'Offering', ago(m + 3 + i, 11)));
  }
  routeDeposit(s, rMinji, 600000, 'Studio Ono', 'Freelance logo', 'minji', ago(40, 15));
  for (let d = 88; d > 0; d -= 7) pay('home', 'E-mart', rand(60000, 140000), d % 2 ? 'minji' : 'joon', 'Groceries', ago(d, 18));
  const shops = ['Blue Bottle', 'T-money', 'Kyobo Books', 'Olive Young', 'GS25'];
  for (let d = 85, i = 0; d > 0; d -= 4, i++) pay(spend.minji, shops[i % shops.length], rand(4500, 38000), 'minji', '', ago(d, 8));
  xfer(spend.jiho, 'club', 50000, 'jiho', 'Gear fund', ago(25, 21));
  pay('club', 'Jirisan cabin', 180000, 'hana', 'Deposit for October hike', ago(20));
  pay('church', 'Daesung Construction', 400000, 'choi', 'Roof repair', ago(33));
  xfer('sv-minji', spend.minji, 150000, 'minji', 'Concert tickets', ago(15));

  s.tx.sort((a, b) => a.ts - b.ts);
  return s;
}

/* ---------- state ---------- */

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && s.v === VERSION) return s;
  } catch { /* storage unavailable: fall back to fresh data */ }
  return seed();
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* demo keeps working in memory */ }
}

const user = id => state.users.find(u => u.id === id);
const acct = id => state.accounts.find(a => a.id === id);
const routerById = id => state.routers.find(r => r.id === id);
const routerOf = uid => state.routers.find(r => r.owner === uid);
const txById = id => state.tx.find(t => t.id === id);
const firstName = id => (user(id)?.name || 'Someone').split(' ')[0];
const ownerOf = id => (acct(id) || routerById(id))?.owner;

function balance(id) {
  let b = 0;
  for (const t of state.tx) {
    if (t.to === id) b += t.amount;
    if (t.from === id) b -= t.amount;
  }
  return b;
}

/* ---------- permissions ---------- */

function roleOf(uid, a) {
  if (!a) return null;
  if (a.owner === uid) return 'owner';
  return a.members.find(m => m.user === uid)?.role || null;
}

function canPayOwt(uid, a) {
  return a.owner === uid || !!a.members.find(m => m.user === uid)?.pay;
}

// view · share · transfer (send out) · receive (send in) · deposit · pay
function can(uid, a, act) {
  const role = roleOf(uid, a);
  if (!role) return false;
  if (a.type === 'owt') {
    if (act === 'view' || act === 'receive') return true;
    if (act === 'pay') return canPayOwt(uid, a);
    if (act === 'share') return role === 'owner';
    return false;
  }
  if (act === 'deposit' || act === 'pay') return a.type === 'spending';
  return ['view', 'share', 'transfer', 'receive'].includes(act);
}

function roleLabel(uid, a) {
  const role = roleOf(uid, a);
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  return canPayOwt(uid, a) ? 'Contributor · can pay' : 'Contributor';
}

// Returns why a transfer is not allowed, or '' when it is.
function transferBlock(uid, from, to) {
  if (!from || !to) return 'Choose both accounts.';
  if (from.id === to.id) return 'Choose two different accounts.';
  if (from.type === 'owt') return 'Money can only flow into a one-way transfer account. To spend from it, use Pay.';
  if (!can(uid, from, 'transfer')) return 'You have no transfer rights on this account.';
  if (!can(uid, to, 'receive')) return 'You have no access to the destination account.';
  if (from.type === 'savings' && to.type === 'owt') return 'Savings can’t go straight into an OWT account. Move the money to spending first.';
  return '';
}

function payBlock(uid, a) {
  if (!a) return 'Choose an account.';
  if (a.type === 'savings') return 'Payments can’t be made from savings. Transfer to spending first.';
  if (a.type === 'owt' && !canPayOwt(uid, a)) return 'You are a contributor without pay rights. Ask the owner to grant them.';
  if (!can(uid, a, 'pay')) return 'You have no pay rights on this account.';
  return '';
}

function depositBlock(target) {
  if (!target) return 'Choose where the money lands.';
  if (target.type === 'savings') return 'Savings can’t receive deposits directly. Deposit to spending or your router instead.';
  if (target.type === 'owt') return 'OWT accounts can’t receive deposits directly, so every won can be traced to a contributor.';
  return '';
}

const myAccounts = () => state.accounts.filter(a => roleOf(state.me, a));

// Label for an account or router, seen from the current user.
function label(id) {
  const rt = routerById(id);
  if (rt) return rt.owner === state.me ? 'Your router' : `${firstName(rt.owner)}’s router`;
  const a = acct(id);
  if (!a) return 'Closed account';
  if (a.type === 'owt' || a.owner === state.me) return a.name;
  return `${a.name} · ${firstName(a.owner)}`;
}

/* ---------- shared bits ---------- */

function avatar(uid, size = '') {
  const u = user(uid);
  const ini = (u?.name || '?').split(/[\s-]+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="avatar ${size}" style="--h:${u?.hue ?? 220}" title="${esc(u?.name)}">${esc(ini)}</span>`;
}

function people(a) { return [a.owner, ...a.members.map(m => m.user)]; }

function typeChip(a) {
  const t = TYPES[a.type];
  return `<span class="chip t-${a.type}">${icon(t.icon)}${t.short || t.label}</span>`;
}

function accountOptions(list, selected, blockFn) {
  return list.map(a => {
    const why = blockFn ? blockFn(a) : '';
    return `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${esc(label(a.id))} — ${TYPES[a.type].short || TYPES[a.type].label}${why ? ' (not allowed)' : ''}</option>`;
  }).join('');
}

function moneyInputs(root) {
  $$('.money', root).forEach(el => el.addEventListener('input', () => {
    const n = digits(el.value);
    el.value = n ? n.toLocaleString('en-US') : '';
  }));
}

function txRow(t, id) {
  const inc = t.to === id;
  const sub = [];
  let title, ic;
  if (t.type === 'deposit') {
    title = t.payer || 'Deposit'; ic = 'download';
    sub.push(routerById(id) ? 'Deposit to router' : 'Deposit');
    if (t.memo) sub.push(esc(t.memo));
  } else if (t.type === 'payment') {
    title = t.payee; ic = 'send';
    sub.push(t.ref ? esc(t.ref) : 'Payment');
  } else {
    const other = inc ? t.from : t.to;
    title = label(other); ic = routerById(other) ? 'split' : 'arrows';
    sub.push(inc ? 'Transfer in' : 'Transfer out');
    if (t.via) { const d = txById(t.via); if (d) sub.push(`${esc(d.payer)} ${esc((d.memo || '').toLowerCase())}`.trim()); }
    if (t.memo) sub.push(esc(t.memo));
  }
  const by = t.via ? `auto · ${t.actor === state.me ? 'your' : firstName(t.actor) + '’s'} router` : `by ${t.actor === state.me ? 'you' : esc(firstName(t.actor))}`;
  return `<li class="tx">
    <span class="tx-ic ${inc ? 'in' : 'out'}">${icon(ic)}</span>
    <div class="tx-main"><div class="tx-title">${esc(title)}</div><div class="tx-sub">${fmtDate(t.ts)} · ${sub.join(' · ')} · <span class="actor">${by}</span></div></div>
    <div class="tx-amt ${inc ? 'in' : 'out'}">${inc ? '+' : '−'}${won(t.amount).replace('−', '')}</div>
  </li>`;
}

function activity(id, limit = 30) {
  const list = state.tx.filter(t => t.to === id || t.from === id).sort((a, b) => b.ts - a.ts);
  if (!list.length) return `<div class="empty-sm">No transactions yet.</div>`;
  return `<ul class="txs">${list.slice(0, limit).map(t => txRow(t, id)).join('')}</ul>
    ${list.length > limit ? `<p class="muted small center">Showing the latest ${limit} of ${list.length} transactions.</p>` : ''}`;
}

function notFound(msg = 'This page doesn’t exist, or you don’t have access to it.') {
  return { html: `<div class="empty"><h2>Nothing here</h2><p class="muted">${msg}</p><a class="btn" href="#/home">Back to accounts</a></div>` };
}

/* =========================================================
   Pages
   ========================================================= */

function landing() {
  return {
    html: `
      <section class="landing">
        <div class="landing-copy">
          <span class="eyebrow">${icon('funnel')} Demo · fictitious money only</span>
          <h1>Banking for money<br>you share.</h1>
          <p class="lead">Split every paycheck automatically, pool money with your partner, club or church in one-way transfer accounts, and always see who sent what.</p>
          <a class="btn ghost" href="#/signup">${icon('plus')} Create a new user</a>
        </div>
        <div class="personas">
          <p class="muted small">Log in as one of the example users</p>
          ${PERSONAS.map(p => `
            <button class="persona" data-user="${p.id}">
              ${avatar(p.id, 'lg')}
              <span><strong>${esc(user(p.id).name)}</strong><span class="muted small">${p.story}</span></span>
              ${icon('chevron', 'chev')}
            </button>`).join('')}
        </div>
      </section>`,
    init() {
      $$('.persona').forEach(b => b.addEventListener('click', () => {
        state.me = b.dataset.user; save();
        toast(`Logged in as ${esc(user(state.me).name)}`);
        go('#/home');
      }));
    },
  };
}

function signup() {
  return {
    html: `
      <div class="narrow">
        <a class="back" href="#/login">${icon('back')} Back</a>
        <h1 class="page-title">Create a user</h1>
        <p class="muted">Nothing is sent anywhere. The password is only checked against the policy.</p>
        <form class="card form" id="f" novalidate>
          <label class="field"><span>Full name</span><input name="name" autocomplete="off" required></label>
          <label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="off" required></label>
          <label class="field"><span>Password</span><input name="pw" type="password" autocomplete="new-password" required>
            <small class="muted">At least 8 characters, with letters and digits.</small></label>
          <p class="form-error" id="err"></p>
          <button class="btn primary block">Create user</button>
        </form>
      </div>`,
    init() {
      $('#f').addEventListener('submit', ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const name = f.get('name').trim(), email = f.get('email').trim().toLowerCase(), pw = f.get('pw');
        let err = '';
        if (!name) err = 'Enter your name.';
        else if (!/^\S+@\S+\.\S+$/.test(email)) err = 'Enter a valid e-mail address.';
        else if (state.users.some(u => u.email === email)) err = 'A user with this e-mail already exists.';
        else if (pw.length < 8 || !/[a-z]/i.test(pw) || !/\d/.test(pw)) err = 'The password needs at least 8 characters, with letters and digits.';
        $('#err').textContent = err;
        if (err) return;
        const id = 'u' + Date.now().toString(36);
        state.users.push({ id, name, email, hue: Math.floor(Math.random() * 360), created: true });
        state.me = id; save();
        toast(`Welcome, ${esc(name.split(' ')[0])}`);
        go('#/home');
      });
    },
  };
}

function accountCard(a) {
  const ppl = people(a);
  let extra = '';
  if (a.type === 'owt') {
    const since = Date.now() - 30 * DAY;
    const inflow = state.tx.filter(t => t.to === a.id && t.ts >= since).reduce((s, t) => s + t.amount, 0);
    extra = `<span class="inflow">+${won(inflow)} <span class="muted">· 30 days</span></span>`;
  } else if (ppl.length > 1) {
    extra = `<span class="muted small">Shared with ${ppl.length - 1}</span>`;
  }
  return `<a class="acard t-${a.type}" href="#/account/${a.id}">
    <div class="acard-top">${typeChip(a)}<span class="role">${roleLabel(state.me, a)}</span></div>
    <div class="acard-name">${esc(a.name)}${a.owner !== state.me && a.type !== 'owt' ? ` <span class="muted">· ${esc(firstName(a.owner))}</span>` : ''}</div>
    <div class="acard-no">${a.no}${a.purpose ? ` · ${PURPOSES[a.purpose]}` : ''}</div>
    <div class="acard-bal">${won(balance(a.id))}</div>
    <div class="acard-foot"><span class="stack">${ppl.slice(0, 5).map(u => avatar(u, 'sm')).join('')}${ppl.length > 5 ? `<span class="avatar sm more">+${ppl.length - 5}</span>` : ''}</span>${extra}</div>
  </a>`;
}

function home() {
  const me = state.me;
  const mine = myAccounts();
  const owned = mine.filter(a => a.owner === me && a.type !== 'owt');
  const shared = mine.filter(a => a.owner !== me && a.type !== 'owt');
  const owts = mine.filter(a => a.type === 'owt');
  const total = owned.reduce((s, a) => s + balance(a.id), 0);
  const rt = routerOf(me);
  const section = (title, list, note) => list.length ? `
    <section class="sect"><div class="sect-head"><h2>${title}</h2>${note ? `<span class="muted small">${note}</span>` : ''}</div>
    <div class="grid">${list.map(accountCard).join('')}</div></section>` : '';
  const hour = new Date().getHours();

  return {
    html: `
      <section class="hero">
        <div class="hero-main">
          <span class="hero-hi">Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${esc(firstName(me))}</span>
          <div class="hero-label">Total in accounts you own</div>
          <div class="hero-total">${won(total)}</div>
          <div class="quick">
            <a class="qbtn" href="#/deposit">${icon('download')}<span>Deposit</span></a>
            <a class="qbtn" href="#/transfer">${icon('arrows')}<span>Transfer</span></a>
            <a class="qbtn" href="#/pay">${icon('send')}<span>Pay</span></a>
            <a class="qbtn" href="#/new">${icon('plus')}<span>New account</span></a>
          </div>
        </div>
        <a class="hero-router" href="#/router">
          ${rt ? `
            <div class="hr-top">${icon('split')} Router <span class="pill">Virtual</span></div>
            <div class="hr-no">${rt.no}</div>
            <div class="hr-desc">Give this number to your employer. Every deposit is split automatically:</div>
            <ul class="hr-rules">${rt.rules.map(r => `<li>${r.mode === 'pct' ? r.value + '%' : won(r.value)} → ${esc(label(r.to))}</li>`).join('')}<li>Rest → ${esc(label(rt.rest))}</li></ul>
          ` : `
            <div class="hr-top">${icon('split')} Router</div>
            <div class="hr-desc">Get a virtual account number that splits every incoming deposit between your accounts and shared OWT accounts.</div>
            <span class="hr-cta">Set up router ${icon('chevron')}</span>`}
        </a>
      </section>
      ${mine.length ? '' : `
        <div class="empty">${icon('card', 'big')}<h2>Open your first account</h2>
        <p class="muted">Start with a spending account. Then add savings, or a one-way transfer account to pool money with others.</p>
        <a class="btn primary" href="#/new">${icon('plus')} New account</a></div>`}
      ${section('Your accounts', owned)}
      ${section('Shared with you', shared, 'You are a manager on these accounts')}
      ${section('One-way transfer accounts', owts, 'Money flows in only. Open one to see who contributes.')}`,
  };
}

/* ---------- account pages ---------- */

function accountHead(a) {
  return `
    <a class="back" href="#/home">${icon('back')} Accounts</a>
    <section class="acct-head t-${a.type}">
      <div>
        <div class="acct-chips">${typeChip(a)}<span class="role">${roleLabel(state.me, a)}</span>${a.purpose ? `<span class="role">${PURPOSES[a.purpose]}</span>` : ''}</div>
        <h1>${esc(a.name)}</h1>
        <button class="no-copy" data-copy="${a.no}" title="Copy account number">${a.no} ${icon('copy')}</button>
        ${a.owner !== state.me ? `<div class="muted small">Owned by ${esc(user(a.owner).name)}</div>` : ''}
      </div>
      <div class="acct-bal"><span>Balance</span><strong>${won(balance(a.id))}</strong></div>
    </section>`;
}

function copyInit() {
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => {
    try { navigator.clipboard.writeText(b.dataset.copy); } catch { /* clipboard blocked */ }
    toast('Account number copied');
  }));
}

function actionBtn(href, ic, text, allowed, why, primary = false) {
  return allowed
    ? `<a class="btn ${primary ? 'primary' : ''}" href="${href}">${icon(ic)} ${text}</a>`
    : `<span class="btn disabled" title="${esc(why)}">${icon('lock')} ${text}</span>`;
}

function peoplePanel(a) {
  const isOwt = a.type === 'owt';
  return `<aside class="card side">
    <div class="side-head"><h3>${isOwt ? 'Contributors' : 'People with access'}</h3><span class="muted small">${people(a).length}</span></div>
    <ul class="ppl">
      ${people(a).map(u => {
        const m = a.members.find(x => x.user === u);
        const r = u === a.owner ? 'Owner' : isOwt ? (m.pay ? 'Contributor · can pay' : 'Contributor') : 'Manager';
        return `<li>${avatar(u)}<span><strong>${esc(user(u).name)}${u === state.me ? ' <span class="muted">(you)</span>' : ''}</strong><span class="muted small">${r}</span></span></li>`;
      }).join('')}
    </ul>
    <a class="btn block" href="#/account/${a.id}/share">${icon('users')} ${can(state.me, a, 'share') ? (isOwt ? 'Invite contributors' : 'Manage sharing') : 'View sharing'}</a>
  </aside>`;
}

function accountPage(id) {
  const a = acct(id);
  if (!a || !roleOf(state.me, a)) return notFound();
  if (a.type === 'owt') return owtPage(a);
  const me = state.me;
  const note = a.type === 'savings'
    ? `${icon('info')} Savings can’t receive deposits or make payments. Fill it from spending, or point a router rule here.`
    : `${icon('info')} Spending accounts accept deposits and payments, and can send money to savings and OWT accounts.`;
  return {
    html: `
      ${accountHead(a)}
      <div class="actions">
        ${actionBtn(`#/deposit?to=${a.id}`, 'download', 'Deposit', can(me, a, 'deposit'), depositBlock(a), true)}
        ${actionBtn(`#/transfer?from=${a.id}`, 'arrows', 'Transfer', can(me, a, 'transfer'), '')}
        ${actionBtn(`#/pay?from=${a.id}`, 'send', 'Pay', can(me, a, 'pay'), payBlock(me, a))}
      </div>
      <p class="note">${note}</p>
      <div class="two-col">
        <section class="card"><div class="side-head"><h3>Activity</h3><span class="muted small">Every entry shows who acted</span></div>${activity(a.id)}</section>
        ${peoplePanel(a)}
      </div>`,
    init: copyInit,
  };
}

/* ---------- OWT graph ---------- */

function owtFlows(a, period) {
  const since = period === 'all' ? 0 : Date.now() - Number(period) * DAY;
  const by = new Map(people(a).map(u => [u, { user: u, amount: 0, count: 0 }]));
  let out = 0, outCount = 0;
  for (const t of state.tx) {
    if (t.ts < since) continue;
    if (t.to === a.id) {
      const u = ownerOf(t.from);
      if (!by.has(u)) by.set(u, { user: u, amount: 0, count: 0, former: true });
      const e = by.get(u); e.amount += t.amount; e.count += 1;
    } else if (t.from === a.id) { out += t.amount; outCount += 1; }
  }
  return { rows: [...by.values()], out, outCount };
}

function graphSVG(a, opts) {
  const me = state.me;
  const { rows, out, outCount } = owtFlows(a, opts.period);
  const totalIn = rows.reduce((s, r) => s + r.amount, 0);
  let nodes;
  if (opts.collapse) {
    const mine = rows.find(r => r.user === me) || { user: me, amount: 0, count: 0 };
    const rest = rows.filter(r => r.user !== me);
    nodes = [mine, { others: true, n: rest.length, amount: rest.reduce((s, r) => s + r.amount, 0), count: rest.reduce((s, r) => s + r.count, 0) }];
  } else {
    nodes = rows.slice().sort((x, y) => (y.user === me) - (x.user === me) || y.amount - x.amount);
  }

  // Phones get a narrower canvas, so the text is not scaled down to nothing.
  const compact = isCompact();
  const W = compact ? 420 : 680, cx = W / 2, cy = 200, RX = compact ? 145 : 235, RY = compact ? 165 : 160;
  const money = compact ? shortWon : won;
  const n = nodes.length;
  const span = n <= 2 ? 150 : Math.min(220, 60 + n * 30);
  const max = Math.max(1, ...nodes.map(d => d.amount));
  const OR = compact ? 50 : 56, NR = compact ? 26 : 28;

  const arrow = (x1, y1, x2, y2, r1, r2, w, cls, lbl) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const sx = x1 + ux * r1, sy = y1 + uy * r1, tx = x2 - ux * r2, ty = y2 - uy * r2;
    const hs = Math.max(9, w + 6), bx = tx - ux * hs, by = ty - uy * hs, px = -uy * hs * 0.6, py = ux * hs * 0.6;
    const mx = sx + (bx - sx) * 0.5, my = sy + (by - sy) * 0.5;
    const tw = lbl.length * 7.2 + 18;
    return `<g class="edge ${cls}">
      <line x1="${sx}" y1="${sy}" x2="${bx}" y2="${by}" stroke-width="${w}"/>
      ${cls.includes('zero') ? '' : `<line class="flow" x1="${sx}" y1="${sy}" x2="${bx}" y2="${by}" stroke-width="${Math.max(1.5, w * 0.35)}"/>`}
      <polygon points="${tx},${ty} ${bx + px},${by + py} ${bx - px},${by - py}"/>
      <g class="pill-g"><rect x="${mx - tw / 2}" y="${my - 12}" width="${tw}" height="24" rx="12"/><text x="${mx}" y="${my + 4.5}">${lbl}</text></g>
    </g>`;
  };

  let edges = '', circles = '';
  let top = cy - OR - 10, bottom = cy + OR + 10;
  nodes.forEach((d, i) => {
    const deg = n === 1 ? 90 : 90 + span / 2 - i * span / (n - 1);
    const rad = deg * Math.PI / 180;
    const x = cx + RX * Math.cos(rad), y = cy - RY * Math.sin(rad);
    const w = d.amount ? 2 + 9 * Math.sqrt(d.amount / max) : 1.5;
    const isMe = !d.others && d.user === me;
    edges += arrow(x, y, cx, cy, NR + 4, OR + 4, w, `${isMe ? 'me' : ''} ${d.amount ? '' : 'zero'}`, money(d.amount));
    const share = totalIn ? Math.round(d.amount / totalIn * 100) : 0;
    const name = d.others ? `Others` : isMe ? 'You' : firstName(d.user);
    const sub = compact ? `${share}%` : d.others ? `${d.n} ${d.n === 1 ? 'person' : 'people'} · ${share}%` : `${d.count} transfer${d.count === 1 ? '' : 's'} · ${share}%`;
    const hue = d.others ? 220 : user(d.user)?.hue ?? 220;
    const ini = d.others ? `+${d.n}` : (user(d.user)?.name || '?').split(/[\s-]+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    // Nodes above the centre get their label on top, so it never sits on their own edge.
    const above = y < cy - 40;
    const ny = above ? y - NR - 26 : y + NR + 18;
    top = Math.min(top, above ? ny - 18 : y - NR - 6);
    bottom = Math.max(bottom, above ? y + NR + 6 : ny + 24);
    circles += `<g class="node ${isMe ? 'me' : ''} ${d.others ? 'others' : ''}" style="--h:${hue}">
      <circle cx="${x}" cy="${y}" r="${NR}"/>
      <text class="ini" x="${x}" y="${y + 5}">${esc(ini)}</text>
      <text class="nm" x="${x}" y="${ny}">${esc(name)}</text>
      <text class="sb" x="${x}" y="${ny + 16}">${sub}</text>
    </g>`;
  });

  let outPart = '';
  if (opts.showOut) {
    const py = Math.max(cy + 170, bottom + 40);
    bottom = py + 30;
    outPart = arrow(cx, cy, cx, py, OR + 4, 26, out ? 3 : 1.5, `outflow ${out ? '' : 'zero'}`, money(out)) + `
      <g class="paynode"><rect x="${cx - 88}" y="${py - 22}" width="176" height="44" rx="14"/>
      <text class="nm" x="${cx}" y="${py - 1}">Payments out</text>
      <text class="sb" x="${cx}" y="${py + 14}">${outCount} payment${outCount === 1 ? '' : 's'}</text></g>`;
  }

  return `<svg class="graph" viewBox="0 ${top} ${W} ${bottom - top}" role="img" aria-label="Money flowing into ${esc(a.name)}: ${won(totalIn)} from ${rows.length} people">
    ${edges}${outPart}${circles}
    <g class="owt-node"><circle cx="${cx}" cy="${cy}" r="${OR}"/>
      <text class="cap" x="${cx}" y="${cy - 14}">OWT balance</text>
      <text class="bal" x="${cx}" y="${cy + 8}">${won(balance(a.id))}</text>
      <text class="cap" x="${cx}" y="${cy + 27}">${money(totalIn)} in</text></g>
  </svg>`;
}

function breakdown(a, period) {
  const { rows } = owtFlows(a, period);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return `<table class="bd">
    <thead><tr><th>Contributor</th><th class="num">Transfers</th><th class="num">Total in</th><th class="share">Share</th></tr></thead>
    <tbody>${rows.sort((x, y) => y.amount - x.amount).map(r => {
      const pct = total ? r.amount / total * 100 : 0;
      return `<tr class="${r.user === state.me ? 'me' : ''}">
        <td><span class="bd-who">${avatar(r.user, 'sm')} ${esc(user(r.user)?.name)}${r.user === state.me ? ' <span class="muted">(you)</span>' : ''}${r.former ? ' <span class="muted small">former</span>' : ''}</span></td>
        <td class="num">${r.count}</td><td class="num strong">${won(r.amount)}</td>
        <td class="share"><div class="share-cell"><span class="sbar"><span style="width:${pct}%;--h:${user(r.user)?.hue ?? 220}"></span></span><span class="small muted">${Math.round(pct)}%</span></div></td></tr>`;
    }).join('')}</tbody></table>`;
}

function owtPage(a) {
  const me = state.me;
  const st = state.settings;
  const seg = (name, val, text) => `<button type="button" data-k="${name}" data-v="${val}" class="${String(st[name]) === String(val) ? 'on' : ''}">${text}</button>`;
  return {
    html: `
      ${accountHead(a)}
      <div class="actions">
        ${actionBtn(`#/transfer?to=${a.id}`, 'arrows', 'Contribute', true, '', true)}
        ${actionBtn(`#/pay?from=${a.id}`, 'send', 'Pay', can(me, a, 'pay'), payBlock(me, a))}
        ${actionBtn(`#/account/${a.id}/share`, 'users', a.owner === me ? 'Invite contributors' : 'Contributors', true, '')}
      </div>
      <p class="note">${icon('funnel')} Money can only flow into this account: by transfer from a contributor’s spending account or a router. Nothing can be transferred out. ${can(me, a, 'pay') ? 'You can pay from it.' : 'Only people with pay rights can pay from it.'}</p>

      <section class="card graph-card">
        <div class="graph-head">
          <div><h3>Who fills this account</h3><span class="muted small">Line width shows how much each contributor has sent in.</span></div>
          <div class="controls">
            <div class="seg" role="group" aria-label="Contributors">${seg('collapse', false, 'Each contributor')}${seg('collapse', true, 'You vs. others')}</div>
            <div class="seg" role="group" aria-label="Period">${seg('period', '30', '30 days')}${seg('period', '90', '90 days')}${seg('period', 'all', 'All time')}</div>
            <label class="switch"><input type="checkbox" id="showOut" ${st.showOut ? 'checked' : ''}><span></span> Payments out</label>
          </div>
        </div>
        <div id="graph">${graphSVG(a, st)}</div>
        <div id="bd">${breakdown(a, st.period)}</div>
      </section>

      <div class="two-col">
        <section class="card"><div class="side-head"><h3>Activity</h3><span class="muted small">Every entry shows who acted</span></div>${activity(a.id)}</section>
        ${peoplePanel(a)}
      </div>`,
    init() {
      copyInit();
      const redraw = () => {
        save();
        $('#graph').innerHTML = graphSVG(a, st);
        $('#bd').innerHTML = breakdown(a, st.period);
        $$('.seg button').forEach(b => b.classList.toggle('on', String(st[b.dataset.k]) === b.dataset.v));
      };
      $$('.seg button').forEach(b => b.addEventListener('click', () => {
        st[b.dataset.k] = b.dataset.k === 'collapse' ? b.dataset.v === 'true' : b.dataset.v;
        redraw();
      }));
      $('#showOut').addEventListener('change', ev => { st.showOut = ev.target.checked; redraw(); });
      let wasCompact = isCompact();
      onResize = () => { if (isCompact() !== wasCompact) { wasCompact = isCompact(); redraw(); } };
    },
  };
}

/* ---------- sharing ---------- */

function sharePage(id, fresh) {
  const a = acct(id);
  if (!a || !roleOf(state.me, a)) return notFound();
  const me = state.me;
  const isOwt = a.type === 'owt';
  const canShare = can(me, a, 'share');
  const isOwner = a.owner === me;
  const candidates = state.users.filter(u => !people(a).includes(u.id));

  const row = u => {
    const m = a.members.find(x => x.user === u);
    let right = '';
    if (u === a.owner) right = `<span class="role">Owner</span>`;
    else if (isOwt) {
      right = `<label class="switch ${isOwner ? '' : 'ro'}" title="Can pay from this account"><input type="checkbox" data-pay="${u}" ${m.pay ? 'checked' : ''} ${isOwner ? '' : 'disabled'}><span></span> Can pay</label>
        ${isOwner ? `<button class="icon-btn" data-remove="${u}" title="Remove">${icon('trash')}</button>` : ''}`;
    } else {
      right = `<span class="role">Manager</span>${isOwner ? `<button class="icon-btn" data-remove="${u}" title="Remove">${icon('trash')}</button>` : ''}`;
    }
    return `<li>${avatar(u)}<span class="grow"><strong>${esc(user(u).name)}${u === me ? ' <span class="muted">(you)</span>' : ''}</strong><span class="muted small">${esc(user(u).email)}</span></span>${right}</li>`;
  };

  return {
    html: `
      <div class="narrow wide">
        <a class="back" href="#/account/${a.id}">${icon('back')} ${esc(a.name)}</a>
        ${fresh ? `<div class="banner">${icon('check')}<div><strong>${esc(a.name)} is open.</strong> Invite people now, or <a href="#/account/${a.id}">skip for now</a>.</div></div>` : ''}
        <h1 class="page-title">${isOwt ? 'Contributors' : 'Sharing'}</h1>
        <div class="explain ${isOwt ? 't-owt' : ''}">
          <div class="dir">${isOwt
            ? `${avatar(me, 'sm')}<span class="flow-arrow one">→</span><span class="chip t-owt">${icon('funnel')}OWT</span><span class="muted small">one-way</span>`
            : `${avatar(me, 'sm')}<span class="flow-arrow">⇄</span><span class="chip t-${a.type}">${icon(TYPES[a.type].icon)}${TYPES[a.type].label}</span><span class="muted small">two-way</span>`}</div>
          <p>${isOwt
            ? 'Contributors can send money into this account and see its balance and activity. They can never transfer money out. Turn on <strong>Can pay</strong> for people who should be able to pay bills from it, like a partner or a treasurer.'
            : 'Managers get the same rights as the owner: see the balance and activity, transfer money in and out, and invite other managers. Every transaction records who made it.'}</p>
        </div>
        <section class="card">
          <ul class="ppl big">${people(a).map(row).join('')}</ul>
        </section>
        ${canShare ? `
          <form class="card form invite" id="inv">
            <h3>${isOwt ? 'Invite a contributor' : 'Invite a manager'}</h3>
            ${candidates.length ? `
              <div class="row">
                <label class="field grow"><span>User</span><select name="user">${candidates.map(u => `<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join('')}</select></label>
                ${isOwt ? `<label class="switch"><input type="checkbox" name="pay"><span></span> Can pay</label>` : ''}
                <button class="btn primary">${icon('plus')} Invite</button>
              </div>` : `<p class="muted">Everyone in the demo already has access.</p>`}
          </form>` : `<p class="note">${icon('lock')} Only ${isOwt ? 'the owner' : 'the owner and managers'} can change who has access.</p>`}
      </div>`,
    init() {
      $('#inv')?.addEventListener('submit', ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const u = f.get('user');
        a.members.push(isOwt ? { user: u, role: 'contributor', pay: f.get('pay') === 'on' } : { user: u, role: 'manager' });
        save();
        toast(`${esc(user(u).name)} is now a ${isOwt ? 'contributor' : 'manager'}`);
        render();
      });
      $$('[data-remove]').forEach(b => b.addEventListener('click', () => {
        a.members = a.members.filter(m => m.user !== b.dataset.remove);
        save(); toast(`${esc(user(b.dataset.remove).name)} no longer has access`); render();
      }));
      $$('[data-pay]').forEach(c => c.addEventListener('change', () => {
        a.members.find(m => m.user === c.dataset.pay).pay = c.checked;
        save(); toast(`${esc(firstName(c.dataset.pay))} ${c.checked ? 'can now pay from' : 'can no longer pay from'} ${esc(a.name)}`);
      }));
    },
  };
}

/* ---------- new account ---------- */

function newAccount() {
  return {
    html: `
      <div class="narrow wide">
        <a class="back" href="#/home">${icon('back')} Accounts</a>
        <h1 class="page-title">Open an account</h1>
        <form id="f" class="form">
          <div class="types">
            ${Object.entries(TYPES).map(([k, t], i) => `
              <label class="type t-${k}">
                <input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''}>
                <span class="type-ic">${icon(t.icon)}</span>
                <strong>${t.label}</strong>
                <span class="muted small">${t.blurb}</span>
                <ul>${t.rules.map(r => `<li>${r}</li>`).join('')}</ul>
              </label>`).join('')}
          </div>
          <div class="card">
            <label class="field"><span>Name</span><input name="name" placeholder="Everyday" autocomplete="off" required></label>
            <div class="field" id="purpose" hidden><span>What is it for?</span>
              <div class="seg">
                <label><input type="radio" name="purpose" value="spending" checked><span>Shared spending</span></label>
                <label><input type="radio" name="purpose" value="savings"><span>Shared savings</span></label>
              </div>
              <small class="muted">Only a label. Both work the same way: money flows in, payers spend from it.</small>
            </div>
            <p class="muted small">The account gets a new account number and starts at ₩0.</p>
            <button class="btn primary">${icon('plus')} Open account</button>
          </div>
        </form>
      </div>`,
    init() {
      const f = $('#f');
      const sync = () => {
        const t = f.type.value;
        $('#purpose').hidden = t !== 'owt';
        f.elements.name.placeholder = { spending: 'Everyday', savings: 'Holiday', owt: 'Our home' }[t];
      };
      f.addEventListener('change', sync);
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const type = f.type.value;
        const name = f.elements.name.value.trim() || f.elements.name.placeholder;
        const a = { id: 'a' + Date.now().toString(36), type, owner: state.me, name, no: makeNo(type), members: [], created: Date.now() };
        if (type === 'owt') a.purpose = f.purpose.value;
        state.accounts.push(a); save();
        toast(`${esc(name)} opened`);
        go(`#/account/${a.id}/share?new=1`);
      });
    },
  };
}

/* ---------- money movement ---------- */

function rulesCard() {
  const ok = icon('check', 'ok'), no = icon('x', 'no');
  return `<aside class="card side rules">
    <h3>What can go where</h3>
    <table>
      <thead><tr><th>From ↓ To →</th><th>Spending</th><th>Savings</th><th>OWT</th></tr></thead>
      <tbody>
        <tr><th>Spending</th><td>${ok}</td><td>${ok}</td><td>${ok}</td></tr>
        <tr><th>Savings</th><td>${ok}</td><td>${ok}</td><td>${no}</td></tr>
        <tr><th>OWT</th><td>${no}</td><td>${no}</td><td>${no}</td></tr>
      </tbody>
    </table>
    <p class="muted small">Money in an OWT account can only leave as a payment, made by someone with pay rights. You also need access to both accounts.</p>
  </aside>`;
}

function transferPage(q) {
  const me = state.me;
  const mine = myAccounts();
  const froms = mine;
  const tos = mine.filter(a => can(me, a, 'receive'));
  const pre = {
    from: q.get('from') || mine.find(a => a.owner === me && a.type === 'spending')?.id,
    to: q.get('to') || '',
  };
  return {
    html: `
      <div class="pagehead"><h1 class="page-title">Transfer</h1><p class="muted">Move money between accounts you have access to.</p></div>
      <div class="two-col">
        <form class="card form" id="f">
          <label class="field"><span>From</span><select name="from">${accountOptions(froms, pre.from)}</select><small class="bal-hint" id="fromBal"></small></label>
          <label class="field"><span>To</span><select name="to"><option value="">Choose…</option>${accountOptions(tos, pre.to)}</select></label>
          <label class="field"><span>Amount (KRW)</span><input class="money" name="amount" inputmode="numeric" placeholder="0" autocomplete="off"></label>
          <label class="field"><span>Message <span class="muted">(optional)</span></span><input name="memo" maxlength="60" autocomplete="off"></label>
          <p class="verdict" id="verdict"></p>
          <button class="btn primary block" id="go">${icon('arrows')} Transfer</button>
        </form>
        ${rulesCard()}
      </div>`,
    init() {
      const f = $('#f');
      moneyInputs(f);
      const check = () => {
        const from = acct(f.from.value), to = acct(f.to.value);
        $('#fromBal').textContent = from ? `Balance ${won(balance(from.id))}` : '';
        const why = f.to.value ? transferBlock(me, from, to) : '';
        const v = $('#verdict');
        v.className = 'verdict ' + (why ? 'bad' : f.to.value ? 'good' : '');
        v.innerHTML = why ? `${icon('x')} ${why}` : f.to.value ? `${icon('check')} ${esc(TYPES[from.type].label)} → ${esc(TYPES[to.type].short || TYPES[to.type].label)} is allowed.` : '';
        $('#go').disabled = !!why;
        return why;
      };
      f.addEventListener('change', check);
      check();
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const why = check() || (!f.to.value && 'Choose a destination.');
        const amount = digits(f.amount.value);
        if (why) return toast(why, 'error');
        if (amount <= 0) return toast('Enter an amount above ₩0.', 'error');
        addTx(state, { type: 'transfer', from: f.from.value, to: f.to.value, amount, actor: me, memo: f.memo.value.trim() });
        save();
        toast(`Sent ${won(amount)} to ${esc(label(f.to.value))}`);
        go(`#/account/${f.to.value}`);
      });
    },
  };
}

function payPage(q) {
  const me = state.me;
  const mine = myAccounts();
  const pre = q.get('from') || mine.find(a => a.owner === me && a.type === 'spending')?.id;
  const payees = ['E-mart', 'KEPCO', 'Mapo Realty', 'Coupang', 'Jirisan cabin'];
  return {
    html: `
      <div class="pagehead"><h1 class="page-title">Pay</h1><p class="muted">Pay someone outside the bank. Recorded on your side only.</p></div>
      <div class="two-col">
        <form class="card form" id="f">
          <label class="field"><span>Pay from</span><select name="from">${accountOptions(mine, pre, a => payBlock(me, a))}</select><small class="bal-hint" id="fromBal"></small></label>
          <label class="field"><span>Payee</span><input name="payee" autocomplete="off" placeholder="Name of shop or person"></label>
          <div class="quickpick">${payees.map(p => `<button type="button" class="tag" data-payee="${p}">${p}</button>`).join('')}</div>
          <label class="field"><span>Reference <span class="muted">(optional)</span></span><input name="ref" maxlength="60" autocomplete="off"></label>
          <label class="field"><span>Amount (KRW)</span><input class="money" name="amount" inputmode="numeric" placeholder="0" autocomplete="off"></label>
          <p class="verdict" id="verdict"></p>
          <button class="btn primary block" id="go">${icon('send')} Pay</button>
        </form>
        <aside class="card side rules">
          <h3>Who can pay from what</h3>
          <ul class="checklist">
            <li>${icon('check', 'ok')} Spending — owner and managers</li>
            <li>${icon('check', 'ok')} OWT — owner, and contributors with <em>Can pay</em></li>
            <li>${icon('x', 'no')} Savings — never; move money to spending first</li>
          </ul>
          <p class="muted small">Balances may go below zero. The demo has no overdraft limit.</p>
        </aside>
      </div>`,
    init() {
      const f = $('#f');
      moneyInputs(f);
      const check = () => {
        const a = acct(f.from.value);
        $('#fromBal').textContent = a ? `Balance ${won(balance(a.id))}` : '';
        const why = payBlock(me, a);
        const v = $('#verdict');
        v.className = 'verdict ' + (why ? 'bad' : 'good');
        v.innerHTML = why ? `${icon('x')} ${why}` : `${icon('check')} You can pay from ${esc(label(a.id))}.`;
        $('#go').disabled = !!why;
        return why;
      };
      f.addEventListener('change', check);
      $$('[data-payee]').forEach(b => b.addEventListener('click', () => { f.payee.value = b.dataset.payee; }));
      check();
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const why = check();
        const amount = digits(f.amount.value);
        const payee = f.payee.value.trim();
        if (why) return toast(why, 'error');
        if (!payee) return toast('Enter a payee.', 'error');
        if (amount <= 0) return toast('Enter an amount above ₩0.', 'error');
        addTx(state, { type: 'payment', from: f.from.value, payee, ref: f.ref.value.trim(), amount, actor: me });
        save();
        toast(`Paid ${won(amount)} to ${esc(payee)}`);
        go(`#/account/${f.from.value}`);
      });
    },
  };
}

function depositPage(q) {
  const me = state.me;
  const mine = myAccounts();
  const rt = routerOf(me);
  const pre = q.get('to') || (rt ? rt.id : mine.find(a => can(me, a, 'deposit'))?.id);
  return {
    html: `
      <div class="pagehead"><h1 class="page-title">Deposit</h1><p class="muted">Simulate money arriving from outside the bank, like a salary or a cash deposit.</p></div>
      <div class="two-col">
        <form class="card form" id="f">
          <label class="field"><span>Deposit to</span><select name="to">
            ${rt ? `<option value="${rt.id}" ${pre === rt.id ? 'selected' : ''}>Your router — ${rt.no}</option>` : ''}
            ${accountOptions(mine, pre, depositBlock)}
          </select></label>
          <label class="field"><span>Sent by</span><input name="payer" autocomplete="off" value="Hanbit Design"></label>
          <label class="field"><span>Message <span class="muted">(optional)</span></span><input name="memo" maxlength="60" autocomplete="off" value="Salary"></label>
          <label class="field"><span>Amount (KRW)</span><input class="money" name="amount" inputmode="numeric" value="3,000,000" autocomplete="off"><small class="muted">Up to ${won(DEPOSIT_LIMIT)} per deposit.</small></label>
          <p class="verdict" id="verdict"></p>
          <button class="btn primary block" id="go">${icon('download')} Deposit</button>
        </form>
        <aside class="card side" id="side"></aside>
      </div>`,
    init() {
      const f = $('#f');
      moneyInputs(f);
      const check = () => {
        const isRouter = rt && f.to.value === rt.id;
        const target = isRouter ? null : acct(f.to.value);
        const why = isRouter ? '' : depositBlock(target);
        const v = $('#verdict');
        v.className = 'verdict ' + (why ? 'bad' : 'good');
        v.innerHTML = why ? `${icon('x')} ${why}` : `${icon('check')} ${isRouter ? 'The deposit will be split by your router.' : 'Deposits to spending accounts are allowed.'}`;
        $('#go').disabled = !!why;
        $('#side').innerHTML = isRouter
          ? `<h3>${icon('split')} How it will be split</h3>${splitPreview(rt, digits(f.amount.value))}<a class="btn block" href="#/router">Edit router rules</a>`
          : `<h3>Where can deposits go?</h3><ul class="checklist">
              <li>${icon('check', 'ok')} Spending accounts</li>
              <li>${icon('check', 'ok')} Your router’s virtual number</li>
              <li>${icon('x', 'no')} Savings</li><li>${icon('x', 'no')} One-way transfer accounts</li></ul>
              <p class="muted small">Savings and OWT accounts are only filled by transfers, so every won in them can be traced back to a person.</p>
              ${rt ? '' : `<a class="btn block" href="#/router">${icon('split')} Set up a router</a>`}`;
        return why;
      };
      f.addEventListener('input', check);
      f.addEventListener('change', check);
      check();
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const why = check();
        const amount = digits(f.amount.value);
        if (why) return toast(why, 'error');
        if (amount <= 0) return toast('Enter an amount above ₩0.', 'error');
        if (amount > DEPOSIT_LIMIT) return toast(`Deposits are limited to ${won(DEPOSIT_LIMIT)}.`, 'error');
        const payer = f.payer.value.trim() || 'Cash deposit', memo = f.memo.value.trim();
        if (rt && f.to.value === rt.id) {
          routeDeposit(state, rt, amount, payer, memo, me);
          save(); toast(`${won(amount)} received and split by your router`);
          go('#/router');
        } else {
          addTx(state, { type: 'deposit', to: f.to.value, amount, payer, memo, actor: me });
          save(); toast(`${won(amount)} deposited`);
          go(`#/account/${f.to.value}`);
        }
      });
    },
  };
}

/* ---------- router ---------- */

function splitPreview(rt, amount) {
  if (!amount) return `<p class="muted small">Enter an amount to see the split.</p>`;
  const plan = splitPlan(rt, amount);
  return `<ul class="split">${plan.map(p => {
    const a = acct(p.to);
    return `<li class="${a ? 't-' + a.type : ''}">
      <span class="split-bar"><span style="width:${p.amount / amount * 100}%"></span></span>
      <span class="split-row"><span>${esc(label(p.to))} <span class="muted small">${p.why}</span></span><strong>${won(p.amount)}</strong></span>
    </li>`;
  }).join('')}</ul>`;
}

function routerPage() {
  const me = state.me;
  const rt = routerOf(me);
  const targets = myAccounts().filter(a => can(me, a, 'receive'));
  const spendings = targets.filter(a => a.type === 'spending' && a.owner === me);

  if (!rt) {
    return {
      html: `
        <div class="narrow wide">
          <div class="router-intro card">
            <span class="type-ic big t-router">${icon('split')}</span>
            <h1 class="page-title">Router</h1>
            <p class="lead">A router is a virtual account number. Whatever lands in it is split right away: a percentage or a fixed amount to each account you choose, and the rest to your spending account.</p>
            <p class="muted">Use it as your salary account to fund savings and shared OWT accounts automatically.</p>
            ${spendings.length
              ? `<button class="btn primary" id="mk">${icon('plus')} Create my router</button>`
              : `<p class="note">${icon('info')} You need a spending account first, to receive what’s left over.</p><a class="btn primary" href="#/new">${icon('plus')} Open a spending account</a>`}
          </div>
        </div>`,
      init() {
        $('#mk')?.addEventListener('click', () => {
          state.routers.push({ id: 'rt-' + me, owner: me, no: makeNo('router'), rest: spendings[0].id, rules: [] });
          save(); toast('Router created'); render();
        });
      },
    };
  }

  const draft = { rest: rt.rest, rules: rt.rules.map(r => ({ ...r })) };
  const opt = (sel, includeEmpty) => (includeEmpty ? '<option value="">Choose account…</option>' : '') + targets.map(a =>
    `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(label(a.id))} — ${TYPES[a.type].short || TYPES[a.type].label}</option>`).join('');
  const deposits = state.tx.filter(t => t.to === rt.id).sort((a, b) => b.ts - a.ts).slice(0, 6);

  return {
    html: `
      <a class="back" href="#/home">${icon('back')} Accounts</a>
      <section class="acct-head t-router">
        <div>
          <div class="acct-chips"><span class="chip t-router">${icon('split')}Router</span><span class="role">Virtual account</span></div>
          <h1>Your router</h1>
          <button class="no-copy" data-copy="${rt.no}">${rt.no} ${icon('copy')}</button>
          <div class="muted small">Never holds money. Deposits are split the moment they arrive.</div>
        </div>
        <a class="btn primary" href="#/deposit?to=${rt.id}">${icon('download')} Simulate a deposit</a>
      </section>

      <div class="two-col">
        <form class="card form" id="f">
          <h3>Rules <span class="muted small">applied top to bottom</span></h3>
          <div id="rules"></div>
          <button type="button" class="btn ghost" id="add">${icon('plus')} Add rule</button>
          <label class="field rest"><span>Everything left goes to</span><select name="rest">${opt(draft.rest)}</select></label>
          <div class="row end"><button type="button" class="btn" id="undo">Discard changes</button><button class="btn primary">${icon('check')} Save rules</button></div>
        </form>
        <aside class="card side">
          <h3>Preview</h3>
          <label class="field"><span>If this lands in your router</span><input class="money" id="sample" inputmode="numeric" value="3,000,000"></label>
          <div id="preview"></div>
          <p class="muted small">Percentages are of the amount received. Each rule only takes what is left, so the total never exceeds the deposit.</p>
        </aside>
      </div>

      <section class="card">
        <div class="side-head"><h3>Recent deposits</h3><span class="muted small">Each deposit and the transfers it caused</span></div>
        ${deposits.length ? `<ul class="routed">${deposits.map(d => `
          <li><div class="routed-head"><span>${icon('download')} <strong>${esc(d.payer)}</strong> <span class="muted small">${fmtTime(d.ts)}${d.memo ? ' · ' + esc(d.memo) : ''}</span></span><strong>${won(d.amount)}</strong></div>
          <ul>${state.tx.filter(t => t.via === d.id).map(t => `<li><span>↳ ${esc(label(t.to))} <span class="muted small">${esc(t.memo)}</span></span><span>${won(t.amount)}</span></li>`).join('')}</ul></li>`).join('')}</ul>`
          : '<div class="empty-sm">No deposits yet. Try “Simulate a deposit”.</div>'}
      </section>`,
    init() {
      copyInit();
      const f = $('#f');
      moneyInputs(document);
      const preview = () => { $('#preview').innerHTML = splitPreview({ ...rt, ...draft }, digits($('#sample').value)); };
      const drawRules = () => {
        $('#rules').innerHTML = draft.rules.length ? draft.rules.map((r, i) => `
          <div class="rule" data-i="${i}">
            <span class="rule-n">${i + 1}</span>
            <select data-f="to" aria-label="Send to">${opt(r.to, true)}</select>
            <div class="seg mini">
              <button type="button" data-f="mode" data-v="pct" class="${r.mode === 'pct' ? 'on' : ''}">%</button>
              <button type="button" data-f="mode" data-v="fixed" class="${r.mode === 'fixed' ? 'on' : ''}">₩</button>
            </div>
            <input data-f="value" inputmode="numeric" value="${r.mode === 'pct' ? r.value : r.value.toLocaleString('en-US')}" aria-label="${r.mode === 'pct' ? 'Percent' : 'Amount'}">
            <button type="button" class="icon-btn" data-f="del" title="Remove rule">${icon('trash')}</button>
          </div>`).join('') : '<p class="muted small">No rules yet: everything goes to the account below.</p>';
        preview();
      };
      $('#rules').addEventListener('input', ev => {
        const i = ev.target.closest('.rule')?.dataset.i; if (i == null) return;
        const r = draft.rules[i], k = ev.target.dataset.f;
        if (k === 'to') r.to = ev.target.value;
        if (k === 'value') {
          r.value = r.mode === 'pct' ? Math.min(100, digits(ev.target.value)) : digits(ev.target.value);
          ev.target.value = r.mode === 'pct' ? (r.value || '') : (r.value ? r.value.toLocaleString('en-US') : '');
        }
        preview();
      });
      $('#rules').addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return;
        const i = b.closest('.rule').dataset.i;
        if (b.dataset.f === 'del') draft.rules.splice(i, 1);
        if (b.dataset.f === 'mode' && draft.rules[i].mode !== b.dataset.v) {
          draft.rules[i].mode = b.dataset.v;
          draft.rules[i].value = b.dataset.v === 'pct' ? 10 : 100000;
        }
        drawRules();
      });
      $('#add').addEventListener('click', () => { draft.rules.push({ to: '', mode: 'pct', value: 10 }); drawRules(); });
      f.rest.addEventListener('change', () => { draft.rest = f.rest.value; preview(); });
      $('#sample').addEventListener('input', preview);
      $('#undo').addEventListener('click', () => render());
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        if (draft.rules.some(r => !r.to)) return toast('Choose an account for every rule.', 'error');
        if (draft.rules.some(r => r.value <= 0)) return toast('Every rule needs a value above zero.', 'error');
        const pct = draft.rules.filter(r => r.mode === 'pct').reduce((s, r) => s + r.value, 0);
        rt.rules = draft.rules; rt.rest = draft.rest; save();
        toast(pct > 100 ? 'Rules saved. Percentages add up to more than 100%, so later rules may get nothing.' : 'Router rules saved');
        render();
      });
      drawRules();
    },
  };
}

/* =========================================================
   Header and routing
   ========================================================= */

function renderHeader(page) {
  const me = state.me && user(state.me);
  const tab = (key, href, ic, text) => `<a href="${href}" class="${page === key ? 'active' : ''}">${icon(ic)}<span>${text}</span></a>`;
  const switchable = state.users.filter(u => PERSONAS.some(p => p.id === u.id) || u.created);
  $('#topbar').innerHTML = `
    <div class="bar">
      <a class="brand" href="#/${me ? 'home' : 'login'}"><span class="logo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-8.5z"/></svg></span>FBD Bank</a>
      ${me ? `
        <nav class="tabs">
          ${tab('home', '#/home', 'home', 'Accounts')}
          ${tab('transfer', '#/transfer', 'arrows', 'Transfer')}
          ${tab('pay', '#/pay', 'send', 'Pay')}
          ${tab('deposit', '#/deposit', 'download', 'Deposit')}
          ${tab('router', '#/router', 'split', 'Router')}
        </nav>
        <details class="who">
          <summary>${avatar(me.id, 'sm')}<span class="who-name">${esc(me.name)}</span></summary>
          <div class="menu">
            <div class="menu-label">Switch user</div>
            ${switchable.map(u => `<button data-switch="${u.id}" class="${u.id === me.id ? 'cur' : ''}">${avatar(u.id, 'sm')} ${esc(u.name)}${u.id === me.id ? icon('check') : ''}</button>`).join('')}
            <hr>
            <button data-act="reset">${icon('reset')} Reset demo data</button>
            <button data-act="out">${icon('out')} Log out</button>
          </div>
        </details>` : ''}
    </div>`;
  $$('[data-switch]').forEach(b => b.addEventListener('click', () => {
    state.me = b.dataset.switch; save();
    toast(`Now viewing as ${esc(user(state.me).name)}`);
    const [path] = location.hash.split('?');
    location.hash = path.startsWith('#/account') ? '#/home' : path;
    render();
  }));
  $('[data-act="reset"]')?.addEventListener('click', () => {
    const me = state.me;
    state = seed(); state.me = user(me) ? me : null; save();
    toast('Demo data reset');
    go('#/home'); render();
  });
  $('[data-act="out"]')?.addEventListener('click', () => { state.me = null; save(); go('#/login'); });
}

let lastPath = null;
let onResize = null;

function render() {
  const [path, query] = location.hash.slice(1).split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(query || '');
  if (!state.me || !user(state.me)) state.me = null;
  let key = parts[0] || (state.me ? 'home' : 'login');
  if (!state.me && key !== 'signup') key = 'login';
  if (state.me && (key === 'login' || key === 'signup')) key = 'home';

  let page;
  switch (key) {
    case 'login': page = landing(); break;
    case 'signup': page = signup(); break;
    case 'home': page = home(); break;
    case 'new': page = newAccount(); break;
    case 'account': page = parts[2] === 'share' ? sharePage(parts[1], q.get('new')) : accountPage(parts[1]); break;
    case 'transfer': page = transferPage(q); break;
    case 'pay': page = payPage(q); break;
    case 'deposit': page = depositPage(q); break;
    case 'router': page = routerPage(); break;
    default: page = notFound();
  }
  renderHeader(key === 'account' || key === 'new' ? 'home' : key);
  onResize = null;
  $('#app').innerHTML = page.html;
  page.init?.();
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

window.addEventListener('hashchange', render);
window.addEventListener('resize', () => onResize?.());
document.addEventListener('click', ev => {
  const menu = $('.who[open]');
  if (menu && !menu.contains(ev.target)) menu.removeAttribute('open');
});
render();
