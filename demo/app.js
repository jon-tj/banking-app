'use strict';

/* =========================================================
   FBD Bank — clickable prototype of the revised proposal
   (docs/interim/FBD_Interim.md).
   Building blocks: personal accounts, groups that hold one-way
   transfer (OWT) accounts, and routers. Templates only combine
   these blocks. No backend: state lives in memory and in
   localStorage until "Reset demo data" is used.
   ========================================================= */

const STORE = 'fbd-bank-demo';
const VERSION = 4;
const DAY = 864e5;
const DEPOSIT_LIMIT = 10000000; // per operation (UC-08)
const PAGE_SIZE = 30;

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
const uniq = list => [...new Set(list)];

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
  heart: '<path d="M12 20s-7-4.5-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.5-9 9-9 9z"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8c-2-4-6-4-6-1.5S9 8 12 8zm0 0c2-4 6-4 6-1.5S15 8 12 8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  out: '<path d="M15 4h4v16h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
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

/* ---------- building blocks, templates, visibility ---------- */

const TYPES = {
  spending: { label: 'Spending', icon: 'card',
    blurb: 'Your everyday account. Receives deposits and transfers, pays bills, and sends money to your groups.',
    rules: ['Deposits allowed', 'Anyone can send to it by number', 'Payments allowed', 'Only you can use it'] },
  savings: { label: 'Savings', icon: 'vault',
    blurb: 'Money set aside. Filled from your own accounts or by your router, never by direct deposit.',
    rules: ['No direct deposits', 'Only moves between your own accounts', 'No payments', 'Only you can use it'] },
  owt: { label: 'Group account', short: 'Group', icon: 'funnel' },
};

const TEMPLATES = {
  couple: { label: 'Couple', icon: 'heart', visibility: 'members', name: 'Our home',
    blurb: 'One household account for two. Each partner’s router sends part of every income there.',
    bullets: ['One shared account', 'Your partner can pay bills', 'Both see who put in what'] },
  club: { label: 'Club', icon: 'users', visibility: 'members', name: 'My club',
    blurb: 'Members pay dues to one club number, which splits them into budgets.',
    bullets: ['Club number with split rules', 'One account per budget', 'Members see who contributed most'] },
  church: { label: 'Church', icon: 'gift', visibility: 'private', name: 'Building fund',
    blurb: 'A fund the congregation gives to. Each member sees only their own giving.',
    bullets: ['One fund account', 'Giving stays private', 'Treasurer sees every gift'] },
  custom: { label: 'Custom', icon: 'funnel', visibility: 'members', name: 'Shared pot',
    blurb: 'One shared account. Choose every setting yourself.',
    bullets: ['One shared account', 'Choose who sees what', 'Add budgets later'] },
};

const VIS = {
  members: { label: 'Members', icon: 'users',
    text: 'Members see every member’s contributions, ranked by total. Nobody outside the group sees anything.' },
  private: { label: 'Private', icon: 'lock',
    text: 'Members cannot see who contributed what: each sees only their own contributions and the total. The owner and payers see every contribution.' },
};

const ROLES = { owner: 'Owner', payer: 'Payer', contributor: 'Contributor' };

/* ---------- money movement (shared by seed and pages) ---------- */

function addTx(s, t) {
  s.seq += 1;
  const rec = { id: 't' + s.seq, ts: Date.now(), ...t };
  s.tx.push(rec);
  return rec;
}

// Splits an amount arriving at a router (DR-05). Percentages are of the
// received amount, rounded down; every rule is capped by what is left; the
// remainder goes to `rest`.
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

// Records the transfers caused by an incoming amount. They carry the actor of
// the incoming amount, so a split through a group router is credited to the
// member who paid.
function routeIn(s, rt, incoming) {
  splitPlan(rt, incoming.amount).forEach((p, i) => addTx(s, {
    type: 'transfer', from: rt.id, to: p.to, amount: p.amount,
    actor: incoming.actor, via: incoming.id, memo: p.why, ts: incoming.ts + i + 1,
  }));
}

function deposit(s, to, amount, payer, memo, actor, ts = Date.now()) {
  const t = addTx(s, { type: 'deposit', to, amount, payer, memo, actor, ts });
  const rt = s.routers.find(r => r.id === to);
  if (rt) routeIn(s, rt, t);
  return t;
}

function transfer(s, from, to, amount, actor, memo, ts = Date.now()) {
  const t = addTx(s, { type: 'transfer', from, to, amount, actor, memo, ts });
  const rt = s.routers.find(r => r.id === to);
  if (rt) routeIn(s, rt, t);
  return t;
}

/* ---------- seed data ---------- */

const PERSONAS = [
  { id: 'minji', story: 'Shares “Our home” with Joon. Her salary goes through a router that feeds the home, her savings and the church fund.' },
  { id: 'joon', story: 'Minji’s partner and a payer on “Our home”. His router sends ₩800,000 of every paycheck there.' },
  { id: 'hana', story: 'Treasurer of Seoul Trail Club. Dues are split into Marketing, Materials and Joint exercises.' },
  { id: 'jiho', story: 'Member of Seoul Trail Club. Pays dues to the club number and sees who contributed most.' },
  { id: 'choi', story: 'Treasurer of Grace Church. Giving to the building fund is private; members see only their own.' },
];

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
    accounts: [], groups: [], routers: [], tx: [],
  };

  const acc = (id, type, extra) => s.accounts.push({ id, type, no: makeNo(type), created: ago(120), ...extra });
  const grp = (id, name, template, owner, members) =>
    s.groups.push({ id, name, template, visibility: TEMPLATES[template].visibility, owner, members, created: ago(120) });
  const contributors = ids => ids.map(user => ({ user, role: 'contributor' }));

  const spend = {};
  for (const u of s.users) { spend[u.id] = 'sp-' + u.id; acc(spend[u.id], 'spending', { owner: u.id, name: 'Everyday' }); }
  acc('sv-minji', 'savings', { owner: 'minji', name: 'Rainy day' });
  acc('sv-joon', 'savings', { owner: 'joon', name: 'Wedding fund' });

  grp('g-home', 'Our home', 'couple', 'minji', [{ user: 'joon', role: 'payer' }]);
  acc('home', 'owt', { group: 'g-home', name: 'Our home' });

  grp('g-club', 'Seoul Trail Club', 'club', 'hana', contributors(['minji', 'jiho', 'seoyeon', 'taemin']));
  s.groups[s.groups.length - 1].members.push({ user: 'joon', role: 'contributor', state: 'invited', invited: ago(1) });
  acc('club-mkt', 'owt', { group: 'g-club', name: 'Marketing' });
  acc('club-mat', 'owt', { group: 'g-club', name: 'Materials' });
  acc('club-trips', 'owt', { group: 'g-club', name: 'Joint exercises' });

  grp('g-church', 'Grace Church', 'church', 'choi', contributors(['grace', 'daniel', 'joon', 'minji']));
  acc('church', 'owt', { group: 'g-church', name: 'Building fund' });

  s.routers.push(
    { id: 'rt-minji', owner: 'minji', no: makeNo('router'), rest: spend.minji,
      rules: [{ to: 'home', mode: 'pct', value: 30 }, { to: 'sv-minji', mode: 'fixed', value: 200000 }, { to: 'church', mode: 'fixed', value: 50000 }] },
    { id: 'rt-joon', owner: 'joon', no: makeNo('router'), rest: spend.joon,
      rules: [{ to: 'home', mode: 'fixed', value: 800000 }, { to: 'sv-joon', mode: 'fixed', value: 300000 }] },
    { id: 'rt-club', group: 'g-club', no: makeNo('router'), rest: 'club-trips',
      rules: [{ to: 'club-mkt', mode: 'pct', value: 20 }, { to: 'club-mat', mode: 'pct', value: 30 }] },
  );

  const pay = (from, payee, amount, actor, ref, ts) => addTx(s, { type: 'payment', from, payee, ref, amount, actor, ts });

  const opening = { minji: 1800000, joon: 2400000, hana: 900000, jiho: 600000, seoyeon: 750000, taemin: 500000, choi: 1500000, grace: 1100000, daniel: 950000 };
  for (const [u, amt] of Object.entries(opening)) deposit(s, spend[u], amt, 'Opening balance', '', u, ago(100));

  for (let k = 2; k >= 0; k--) {
    const m = k * 30;
    deposit(s, 'rt-minji', 3400000, 'Hanbit Design', 'Salary', 'minji', ago(m + 12, 9));
    deposit(s, 'rt-joon', 3900000, 'Seoul Metro', 'Salary', 'joon', ago(m + 12, 9));
    pay('home', 'Mapo Realty', 1150000, k % 2 ? 'joon' : 'minji', 'Rent', ago(m + 6));
    pay('home', 'KEPCO', rand(60000, 95000), 'joon', 'Electricity', ago(m + 9, 20));
    pay(spend.minji, 'SK Telecom', 65000, 'minji', 'Phone bill', ago(m + 10, 7));
    pay(spend.joon, 'Spoany Gym', 89000, 'joon', 'Membership', ago(m + 4, 7));
    ['hana', 'minji', 'jiho', 'seoyeon', 'taemin'].forEach((u, i) => transfer(s, spend[u], 'rt-club', 30000, u, 'Monthly dues', ago(m + 2 + i, 19)));
    [['choi', 200000], ['grace', 120000], ['daniel', 80000], ['joon', 30000]]
      .forEach(([u, a], i) => transfer(s, spend[u], 'church', a, u, 'Offering', ago(m + 3 + i, 11)));
  }
  deposit(s, 'rt-minji', 600000, 'Studio Ono', 'Freelance logo', 'minji', ago(40, 15));
  for (let d = 70; d > 0; d -= 7) pay('home', 'E-mart', rand(60000, 140000), d % 2 ? 'minji' : 'joon', 'Groceries', ago(d, 18));
  const shops = ['Blue Bottle', 'T-money', 'Kyobo Books', 'Olive Young', 'GS25'];
  for (let d = 85, i = 0; d > 0; d -= 4, i++) pay(spend.minji, shops[i % shops.length], rand(4500, 38000), 'minji', '', ago(d, 8));
  transfer(s, spend.jiho, 'club-mat', 50000, 'jiho', 'Gear fund', ago(25, 21));
  pay('club-trips', 'Jirisan cabin', 120000, 'hana', 'Deposit for October hike', ago(20));
  pay('club-mat', 'Alpine Shop', 60000, 'hana', 'Ropes and first-aid kit', ago(12));
  pay('club-mkt', 'Instagram ads', 40000, 'hana', 'Autumn recruiting', ago(9));
  pay('church', 'Daesung Construction', 400000, 'choi', 'Roof repair', ago(33));
  transfer(s, 'sv-minji', spend.minji, 150000, 'minji', 'Concert tickets', ago(15));

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
const group = id => state.groups.find(g => g.id === id);
const routerById = id => state.routers.find(r => r.id === id);
const routerOf = uid => state.routers.find(r => r.owner === uid);
const groupRouter = gid => state.routers.find(r => r.group === gid);
const groupAccounts = gid => state.accounts.filter(a => a.group === gid && !a.closed);
const txById = id => state.tx.find(t => t.id === id);
const firstName = id => (user(id)?.name || 'Someone').split(' ')[0];
const target = id => acct(id) || routerById(id);
const groupOf = x => x && group(x.group);

function balance(id) {
  let b = 0;
  for (const t of state.tx) {
    if (t.to === id) b += t.amount;
    if (t.from === id) b -= t.amount;
  }
  return b;
}
const groupBalance = gid => groupAccounts(gid).reduce((s, a) => s + balance(a.id), 0);

function byNumber(no) {
  const d = String(no).replace(/\D/g, '');
  if (!d) return null;
  return [...state.accounts.filter(a => !a.closed), ...state.routers].find(x => x.no.replace(/\D/g, '') === d) || null;
}

/* ---------- roles and rules ---------- */

// A membership is 'active', or 'invited' / 'declined' until the user accepts
// (UC-06 A7). Only active members have a role in the group.
const isActive = m => (m.state || 'active') === 'active';

function groupRole(uid, g) {
  if (!g || !uid) return null;
  if (g.owner === uid) return 'owner';
  const m = g.members.find(x => x.user === uid);
  return m && isActive(m) ? m.role : null;
}
const members = g => [{ user: g.owner, role: 'owner' }, ...g.members.filter(isActive)];
const invitationsFor = uid => state.groups.filter(g => g.members.some(m => m.user === uid && m.state === 'invited'));
const isPayer = (uid, g) => ['owner', 'payer'].includes(groupRole(uid, g));
const seesAll = (uid, g) => g.visibility !== 'private' || isPayer(uid, g);

const myPersonal = () => state.accounts.filter(a => a.owner === state.me && !a.closed);
const myGroups = () => state.groups.filter(g => groupRole(state.me, g));

const NOT_FROM_SAVINGS = 'Savings can’t go straight into a group. Move the money to spending first.';

// Returns why a transfer is not allowed, or '' when it is (UC-07).
function transferBlock(uid, from, to) {
  if (!from || !to) return 'Choose both accounts.';
  if (from.id === to.id) return 'Choose two different accounts.';
  if (from.owner !== uid) return 'You can only send from your own personal accounts.';
  if (routerById(to.id)) {
    if (to.group) {
      if (!groupRole(uid, group(to.group))) return 'Only members can send to this group number.';
      return from.type === 'savings' ? NOT_FROM_SAVINGS : '';
    }
    return to.owner === uid ? '' : 'A router only accepts money from its owner.';
  }
  if (to.type === 'owt') {
    if (!groupRole(uid, group(to.group))) return 'Only members can send money to a group account.';
    return from.type === 'savings' ? NOT_FROM_SAVINGS : '';
  }
  if (to.type === 'savings' && to.owner !== uid) return 'Savings only accept money from their owner.';
  if (from.type === 'savings' && to.owner !== uid) return 'Savings can only be moved to your own accounts.';
  return '';
}

// Returns why a payment is not allowed, or '' when it is (UC-09).
function payBlock(uid, a, amount = 0) {
  if (!a) return 'Choose an account.';
  if (a.type === 'savings') return 'Payments can’t be made from savings. Transfer to spending first.';
  if (a.type === 'owt') {
    if (!isPayer(uid, group(a.group))) return 'Only the owner and payers can pay from this group. Ask the owner to make you a payer.';
    if (amount && balance(a.id) - amount < 0) return `Group accounts can’t go below zero. ${esc(a.name)} has ${won(balance(a.id))}.`;
    return '';
  }
  return a.owner === uid ? '' : 'You can only pay from your own accounts.';
}

// Returns why a deposit is not allowed, or '' when it is (UC-08).
function depositBlock(uid, t) {
  if (!t) return 'Choose where the money lands.';
  if (routerById(t.id)) return t.owner === uid ? '' : 'You can only deposit to your own router.';
  if (t.type === 'savings') return 'Savings can’t receive deposits directly. Deposit to spending or your router instead.';
  if (t.type === 'owt') return 'Group accounts can’t receive deposits directly, so every won can be traced to a member.';
  return t.owner === uid ? '' : 'You can only deposit to your own accounts.';
}

// Label for an account or router, seen from the current user.
function label(id) {
  const rt = routerById(id);
  if (rt) {
    if (rt.group) { const g = group(rt.group); return `${g.name} · ${g.template === 'club' ? 'club' : 'group'} number`; }
    return rt.owner === state.me ? 'Your router' : `${firstName(rt.owner)}’s router`;
  }
  const a = acct(id);
  if (!a) return 'Closed account';
  if (a.group) {
    const g = group(a.group);
    return a.name === g.name ? a.name : `${g.name} · ${a.name}`;
  }
  return a.owner === state.me ? a.name : `${a.name} · ${firstName(a.owner)}`;
}

const kindOf = x => routerById(x.id) ? (x.group ? 'split between its accounts' : 'Router') : (TYPES[x.type].short || TYPES[x.type].label);

/* ---------- shared bits ---------- */

function avatar(uid, size = '') {
  const u = user(uid);
  const ini = (u?.name || '?').split(/[\s-]+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="avatar ${size}" style="--h:${u?.hue ?? 220}" title="${esc(u?.name)}">${esc(ini)}</span>`;
}

function typeChip(a) {
  const t = TYPES[a.type];
  return `<span class="chip t-${a.type}">${icon(t.icon)}${t.short || t.label}</span>`;
}
const templateChip = g => `<span class="chip t-owt">${icon(TEMPLATES[g.template].icon)}${TEMPLATES[g.template].label}</span>`;
const visChip = g => `<span class="chip v-${g.visibility}" title="${esc(VIS[g.visibility].text)}">${icon(VIS[g.visibility].icon)}${VIS[g.visibility].label}</span>`;

function options(list, selected, blockFn) {
  return list.map(x => {
    const why = blockFn ? blockFn(x) : '';
    return `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(label(x.id))} — ${kindOf(x)}${why ? ' (not allowed)' : ''}</option>`;
  }).join('');
}

function moneyInputs(root) {
  $$('.money', root).forEach(el => el.addEventListener('input', () => {
    const n = digits(el.value);
    el.value = n ? n.toLocaleString('en-US') : '';
  }));
}

function copyInit() {
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => {
    try { navigator.clipboard.writeText(b.dataset.copy); } catch { /* clipboard blocked */ }
    toast('Account number copied');
  }));
}

// An action that may be blocked. The reason is collected and shown as text
// under the buttons, so it is visible on phones too.
function actions(list) {
  const reasons = [];
  const btns = list.map(({ href, ic, text, allowed = true, why = '', primary = false }) => {
    if (allowed) return `<a class="btn ${primary ? 'primary' : ''}" href="${href}">${icon(ic)} ${text}</a>`;
    if (why) reasons.push(`<strong>${text}:</strong> ${why}`);
    return `<span class="btn disabled" aria-disabled="true">${icon('lock')} ${text}</span>`;
  });
  return `<div class="actions">${btns.join('')}</div>${reasons.length ? `<p class="why">${icon('lock')}<span>${reasons.join('<br>')}</span></p>` : ''}`;
}

function notFound(msg = 'This page doesn’t exist, or you don’t have access to it.') {
  return { html: `<div class="empty"><h2>Nothing here</h2><p class="muted">${msg}</p><a class="btn" href="#/home">Back to accounts</a></div>` };
}

/* ---------- activity ---------- */

const isGroupSide = id => !!(acct(id)?.group || routerById(id)?.group);

function txRow(t, inside, hideOthers) {
  const inc = inside.has(t.to);
  const sub = [];
  let title, ic, by = t.actor === state.me ? 'by you' : `by ${esc(firstName(t.actor))}`;
  if (t.type === 'deposit') {
    title = t.payer || 'Deposit'; ic = 'download';
    sub.push(routerById(t.to) ? 'Deposit to router' : 'Deposit');
    if (t.memo) sub.push(esc(t.memo));
  } else if (t.type === 'payment') {
    title = t.payee; ic = 'send';
    sub.push(t.ref ? esc(t.ref) : 'Payment');
    if (inside.size > 1) sub.push(`from ${esc(acct(t.from)?.name)}`);
  } else if (inc && isGroupSide(t.to)) {
    // A contribution: named after the member, not their private account.
    const hidden = hideOthers && t.actor !== state.me;
    title = hidden ? 'A member' : t.actor === state.me ? 'You' : user(t.actor)?.name;
    ic = t.via ? 'split' : 'arrows';
    sub.push('Contribution');
    const cause = t.via && txById(t.via);
    const src = cause && routerById(cause.to);
    if (src && !src.group) sub.push(hidden ? 'via router' : `via ${t.actor === state.me ? 'your' : esc(firstName(t.actor)) + '’s'} router`);
    if (src && src.group && !inside.has(src.id)) sub.push('via group number');
    if (routerById(t.to)) sub.push(`split into ${splitPlan(routerById(t.to), t.amount).length} accounts`);
    else if (inside.size > 1) sub.push(`to ${esc(acct(t.to)?.name)}`);
    if (t.memo && !t.via) sub.push(esc(t.memo));
    if (t.via && cause?.memo) sub.push(esc(cause.memo));
    if (hidden) by = '';
  } else {
    const other = inc ? t.from : t.to;
    title = label(other); ic = routerById(other) ? 'split' : 'arrows';
    sub.push(inc ? 'Transfer in' : 'Transfer out');
    if (t.via) { const d = txById(t.via); if (d?.payer) sub.push(`${esc(d.payer)} ${esc((d.memo || '').toLowerCase())}`.trim()); }
    if (t.memo) sub.push(esc(t.memo));
    if (t.via) by = 'auto · router';
  }
  return `<li class="tx">
    <span class="tx-ic ${inc ? 'in' : 'out'}">${icon(ic)}</span>
    <div class="tx-main"><div class="tx-title">${esc(title)}</div><div class="tx-sub">${fmtDate(t.ts)} · ${sub.join(' · ')}${by ? ` · <span class="actor">${by}</span>` : ''}</div></div>
    <div class="tx-amt ${inc ? 'in' : 'out'}">${inc ? '+' : '−'}${won(t.amount).replace('−', '')}</div>
  </li>`;
}

// History of a set of accounts (UC-10). Transfers between two accounts in the
// set (a group router filling its own subaccounts) are left out.
function activityList(ids, filter) {
  return state.tx
    .filter(t => (ids.has(t.to) || ids.has(t.from)) && !(ids.has(t.to) && ids.has(t.from)))
    .filter(t => filter === 'all' || (filter === 'in' ? ids.has(t.to) : t.type === 'payment'))
    .sort((a, b) => b.ts - a.ts);
}

function activityCard(note = 'Every entry shows who acted') {
  return `<section class="card"><div class="side-head"><h3>Activity</h3><span class="muted small">${note}</span></div>
    <div class="seg mini filters" role="group" aria-label="Show">
      <button type="button" data-f="all" class="on">All</button><button type="button" data-f="in">Money in</button><button type="button" data-f="out">Payments</button>
    </div><div id="act"></div></section>`;
}

function activityInit(ids, hideOthers = false) {
  let filter = 'all', limit = PAGE_SIZE;
  const draw = () => {
    const list = activityList(ids, filter);
    $('#act').innerHTML = list.length
      ? `<ul class="txs">${list.slice(0, limit).map(t => txRow(t, ids, hideOthers)).join('')}</ul>
         ${list.length > limit ? `<button type="button" class="btn block" id="more">Show all ${list.length} transactions</button>` : ''}`
      : '<div class="empty-sm">No transactions here.</div>';
    $('#more')?.addEventListener('click', () => { limit = Infinity; draw(); });
    $$('.filters button').forEach(b => b.classList.toggle('on', b.dataset.f === filter));
  };
  $$('.filters button').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; limit = PAGE_SIZE; draw(); }));
  draw();
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
          <p class="lead">A household account for two, a club with budgets, a church fund. Route part of every income automatically, choose who sees what, and always know who sent what.</p>
          <div class="row">
            <a class="btn ghost" href="#/signup">${icon('plus')} Create a new user</a>
          </div>
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

/* ---------- home ---------- */

function fedBy(id) {
  const rt = routerOf(state.me);
  if (!rt) return '';
  const r = rt.rules.find(x => x.to === id);
  if (r) return r.mode === 'pct' ? `${r.value}% of your income` : `${won(r.value)} per income`;
  return rt.rest === id ? 'Router remainder' : '';
}

function accountCard(a) {
  const fed = fedBy(a.id);
  return `<a class="acard t-${a.type}" href="#/account/${a.id}">
    <div class="acard-top">${typeChip(a)}<span class="role">Owner</span></div>
    <div class="acard-name">${esc(a.name)}</div>
    <div class="acard-no">${a.no}</div>
    <div class="acard-bal">${won(balance(a.id))}</div>
    <div class="acard-foot">${fed ? `<span class="muted small">${icon('split')} ${fed}</span>` : '<span></span>'}</div>
  </a>`;
}

function inflow30(ids) {
  const since = Date.now() - 30 * DAY;
  return state.tx.filter(t => t.ts >= since && t.type === 'transfer' && ids.has(t.to) && !ids.has(t.from)).reduce((s, t) => s + t.amount, 0);
}

function groupCard(g) {
  const ppl = members(g).map(m => m.user);
  const accts = groupAccounts(g.id);
  const ids = new Set(accts.map(a => a.id));
  return `<a class="acard t-owt" href="#/group/${g.id}">
    <div class="acard-top">${templateChip(g)}<span class="role">${ROLES[groupRole(state.me, g)]}</span></div>
    <div class="acard-name">${esc(g.name)}</div>
    <div class="acard-no">${accts.length === 1 ? accts[0].no : `${accts.length} accounts`} · ${VIS[g.visibility].label}</div>
    <div class="acard-bal">${won(groupBalance(g.id))}</div>
    <div class="acard-foot"><span class="stack">${ppl.slice(0, 5).map(u => avatar(u, 'sm')).join('')}${ppl.length > 5 ? `<span class="avatar sm more">+${ppl.length - 5}</span>` : ''}</span>
      <span class="inflow" title="Received in the last 30 days">+${won(inflow30(ids))} <span class="muted">/ 30d</span></span></div>
  </a>`;
}

function home() {
  const me = state.me;
  const personal = myPersonal();
  const groups = myGroups();
  const invites = invitationsFor(me);
  const total = personal.reduce((s, a) => s + balance(a.id), 0);
  const rt = routerOf(me);
  const hour = new Date().getHours();
  return {
    html: `
      <section class="hero">
        <div class="hero-main">
          <span class="hero-hi">Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${esc(firstName(me))}</span>
          <div class="hero-label">Total in your personal accounts</div>
          <div class="hero-total">${won(total)}</div>
          <div class="quick">
            <a class="qbtn" href="#/deposit">${icon('download')}<span>Deposit</span></a>
            <a class="qbtn" href="#/transfer">${icon('arrows')}<span>Transfer</span></a>
            <a class="qbtn" href="#/pay">${icon('send')}<span>Pay</span></a>
            <a class="qbtn" href="#/setup">${icon('users')}<span>New group</span></a>
          </div>
        </div>
        <a class="hero-router" href="#/router">
          ${rt ? `
            <div class="hr-top">${icon('split')} Router <span class="pill">Virtual</span></div>
            <div class="hr-no">${rt.no}</div>
            <div class="hr-desc">Give this number to your employer. Every income is split automatically:</div>
            <ul class="hr-rules">${rt.rules.map(r => `<li>${r.mode === 'pct' ? r.value + '%' : won(r.value)} → ${esc(label(r.to))}</li>`).join('')}<li>Rest → ${esc(label(rt.rest))}</li></ul>
          ` : `
            <div class="hr-top">${icon('split')} Router</div>
            <div class="hr-desc">Get a virtual account number that splits every income between your accounts and your groups.</div>
            <span class="hr-cta">Set up router ${icon('chevron')}</span>`}
        </a>
      </section>
      ${invites.length ? `
        <section class="sect"><div class="sect-head"><h2>Invitations</h2><span class="muted small">You join a group only if you accept.</span></div>
        <div class="invites">${invites.map(g => {
          const m = g.members.find(x => x.user === me);
          return `<div class="card invite-card">
            <div class="acct-chips">${templateChip(g)}${visChip(g)}</div>
            <h3>${esc(g.name)}</h3>
            <p class="muted">${esc(user(g.owner).name)} invites you as a <strong>${m.role}</strong>: ${m.role === 'payer' ? 'you can send money in and pay from the group' : 'you can send money in and see the group’s balance and payments'}.</p>
            <p class="note">${icon(VIS[g.visibility].icon)}<span><strong>${VIS[g.visibility].label}:</strong> ${VIS[g.visibility].text}</span></p>
            <div class="row end"><button class="btn" data-decline="${g.id}">Decline</button><button class="btn primary" data-accept="${g.id}">${icon('check')} Accept and join</button></div>
          </div>`;
        }).join('')}</div></section>` : ''}
      ${personal.length || groups.length ? '' : `
        <div class="empty">${icon('card', 'big')}<h2>Open your first account</h2>
        <p class="muted">Start with a spending account. Then set up a group to share money with your partner, club or church.</p>
        <a class="btn primary" href="#/new">${icon('plus')} New account</a></div>`}
      ${personal.length ? `
        <section class="sect"><div class="sect-head"><h2>Your accounts</h2><a class="small" href="#/new">${icon('plus')} New account</a></div>
        <div class="grid">${personal.map(accountCard).join('')}</div></section>` : ''}
      <section class="sect"><div class="sect-head"><h2>Groups</h2><span class="muted small">Money flows in from members and leaves only as payments.</span></div>
        <div class="grid">${groups.map(groupCard).join('')}
          <a class="acard add" href="#/setup">${icon('plus')}<strong>Set up a group</strong><span class="muted small">Couple, club, church or custom</span></a>
        </div></section>`,
    init() {
      const answer = (gid, accept) => {
        const g = group(gid), m = g.members.find(x => x.user === me);
        m.state = accept ? 'active' : 'declined';
        if (accept) m.joined = Date.now();
        save();
        toast(accept ? `You joined ${esc(g.name)}` : `Invitation to ${esc(g.name)} declined`);
        if (accept) go(`#/group/${gid}`); else render();
      };
      $$('[data-accept]').forEach(b => b.addEventListener('click', () => answer(b.dataset.accept, true)));
      $$('[data-decline]').forEach(b => b.addEventListener('click', () => answer(b.dataset.decline, false)));
    },
  };
}

/* ---------- personal account page ---------- */

function accountPage(id) {
  const a = acct(id);
  if (a?.group) return groupPage(a.group, new URLSearchParams(`acct=${a.id}`));
  if (!a || a.owner !== state.me) return notFound();
  const me = state.me;
  const rt = routerOf(me);
  const rules = rt ? [...rt.rules.filter(r => r.to === a.id).map(r => r.mode === 'pct' ? `${r.value}% of each income` : `${won(r.value)} of each income`), ...(rt.rest === a.id ? ['Whatever is left after the other rules'] : [])] : [];
  const note = a.type === 'savings'
    ? `${icon('info')}<span>Savings can’t receive deposits or make payments, and only move between your own accounts. Fill it from spending, or point a router rule here.`
    : `${icon('info')}<span>Spending accounts accept deposits and payments. Anyone can send money here using the account number.`;
  return {
    html: `
      <a class="back" href="#/home">${icon('back')} Accounts</a>
      <section class="acct-head t-${a.type}">
        <div>
          <div class="acct-chips">${typeChip(a)}<span class="role">Owner</span></div>
          <h1>${esc(a.name)}</h1>
          <button class="no-copy" data-copy="${a.no}" title="Copy account number">${a.no} ${icon('copy')}</button>
        </div>
        <div class="acct-bal"><span>Balance</span><strong>${won(balance(a.id))}</strong></div>
      </section>
      ${actions([
        { href: `#/deposit?to=${a.id}`, ic: 'download', text: 'Deposit', allowed: !depositBlock(me, a), why: depositBlock(me, a), primary: true },
        { href: `#/transfer?from=${a.id}`, ic: 'arrows', text: 'Transfer' },
        { href: `#/pay?from=${a.id}`, ic: 'send', text: 'Pay', allowed: !payBlock(me, a), why: payBlock(me, a) },
      ])}
      <p class="note">${note}</span></p>
      <div class="two-col">
        ${activityCard()}
        <aside class="card side">
          <h3>${icon('split')} Router</h3>
          ${rules.length ? `<ul class="checklist">${rules.map(r => `<li>${icon('check', 'ok')}<span>${r}</span></li>`).join('')}</ul>`
            : `<p class="muted small">No router rule sends money here.</p>`}
          <a class="btn block" href="#/router">${rt ? 'Edit router rules' : 'Set up a router'}</a>
        </aside>
      </div>`,
    init() { copyInit(); activityInit(new Set([a.id])); },
  };
}

/* ---------- contributions graph ---------- */

function groupFlows(g, period) {
  const since = period === 'all' ? 0 : Date.now() - Number(period) * DAY;
  const ids = new Set(groupAccounts(g.id).map(a => a.id));
  const by = new Map(members(g).map(m => [m.user, { user: m.user, amount: 0, count: 0 }]));
  const counted = new Set();
  let out = 0, outCount = 0;
  for (const t of state.tx) {
    if (t.ts < since) continue;
    if (t.type === 'transfer' && ids.has(t.to) && !ids.has(t.from)) {
      if (!by.has(t.actor)) by.set(t.actor, { user: t.actor, amount: 0, count: 0, former: true });
      if (!(by.get(t.actor).first <= t.ts)) by.get(t.actor).first = t.ts;
      const e = by.get(t.actor);
      e.amount += t.amount;
      const key = t.via || t.id; // a split counts as one contribution
      if (!counted.has(key)) { counted.add(key); e.count += 1; }
    } else if (t.type === 'payment' && ids.has(t.from)) { out += t.amount; outCount += 1; }
  }
  return { rows: [...by.values()], out, outCount };
}

// Largest total first; ties go to the earliest first contribution (DR-07).
const byContribution = (x, y) => y.amount - x.amount || (x.first ?? Infinity) - (y.first ?? Infinity);

function graphSVG(g, opts) {
  const me = state.me;
  const { rows, out, outCount } = groupFlows(g, opts.period);
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
    const name = d.others ? 'Others' : isMe ? 'You' : firstName(d.user);
    const sub = compact ? `${share}%` : d.others ? `${d.n} ${d.n === 1 ? 'person' : 'people'} · ${share}%` : `${d.count} contribution${d.count === 1 ? '' : 's'} · ${share}%`;
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

  return `<svg class="graph" viewBox="0 ${top} ${W} ${bottom - top}" role="img" aria-label="Money flowing into ${esc(g.name)}: ${won(totalIn)} from ${rows.length} people">
    ${edges}${outPart}${circles}
    <g class="owt-node"><circle cx="${cx}" cy="${cy}" r="${OR}"/>
      <text class="cap" x="${cx}" y="${cy - 14}">Group balance</text>
      <text class="bal" x="${cx}" y="${cy + 8}">${money(groupBalance(g.id))}</text>
      <text class="cap" x="${cx}" y="${cy + 27}">${money(totalIn)} in</text></g>
  </svg>`;
}

function breakdown(g, period, restricted) {
  let { rows } = groupFlows(g, period);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (restricted) {
    const mine = rows.find(r => r.user === state.me) || { user: state.me, amount: 0, count: 0 };
    const rest = rows.filter(r => r.user !== state.me);
    rows = [mine, { others: true, n: rest.length, amount: rest.reduce((s, r) => s + r.amount, 0), count: rest.reduce((s, r) => s + r.count, 0) }];
  }
  return `<table class="bd">
    <thead><tr><th>Member</th><th class="num">Contributions</th><th class="num">Total in</th><th class="share">Share</th></tr></thead>
    <tbody>${rows.sort(byContribution).map(r => {
      const pct = total ? r.amount / total * 100 : 0;
      const who = r.others
        ? `<span class="avatar sm more">+${r.n}</span> Other members <span class="muted small">private</span>`
        : `${avatar(r.user, 'sm')} ${esc(user(r.user)?.name)}${r.user === state.me ? ' <span class="muted">(you)</span>' : ''}${r.former ? ' <span class="muted small">former</span>' : ''}`;
      return `<tr class="${r.user === state.me && !r.others ? 'me' : ''}">
        <td><span class="bd-who">${who}</span></td>
        <td class="num">${r.count}</td><td class="num strong">${won(r.amount)}</td>
        <td class="share"><div class="share-cell"><span class="sbar"><span style="width:${pct}%;--h:${r.others ? 220 : user(r.user)?.hue ?? 220}"></span></span><span class="small muted">${Math.round(pct)}%</span></div></td></tr>`;
    }).join('')}</tbody></table>`;
}

/* ---------- group pages ---------- */

function groupNumber(g) {
  const rt = groupRouter(g.id);
  return rt ? rt.no : groupAccounts(g.id)[0]?.no || '';
}

function groupHead(g, back = '#/home', backText = 'Accounts') {
  const role = groupRole(state.me, g);
  const rt = groupRouter(g.id);
  return `
    <a class="back" href="${back}">${icon('back')} ${backText}</a>
    <section class="acct-head t-owt">
      <div>
        <div class="acct-chips">${templateChip(g)}<span class="role">${ROLES[role]}</span>${visChip(g)}</div>
        <h1>${esc(g.name)}</h1>
        <button class="no-copy" data-copy="${groupNumber(g)}" title="Copy number">${groupNumber(g)} ${icon('copy')}</button>
        <div class="muted small">${rt ? 'Group number: payments to it are split into the accounts below. ' : ''}${g.owner !== state.me ? `Owned by ${esc(user(g.owner).name)}` : ''}</div>
      </div>
      <div class="acct-bal"><span>Group balance</span><strong>${won(groupBalance(g.id))}</strong></div>
    </section>`;
}

function ruleText(rt, id) {
  if (!rt) return '';
  const r = rt.rules.find(x => x.to === id);
  if (r) return r.mode === 'pct' ? `${r.value}% split` : `${won(r.value)} split`;
  return rt.rest === id ? 'Remainder' : '';
}

function groupPage(gid, q) {
  const g = group(gid);
  const me = state.me;
  if (!g || !groupRole(me, g)) return notFound();
  const accts = groupAccounts(gid);
  const rt = groupRouter(gid);
  const sel = accts.find(a => a.id === q.get('acct'));
  const payer = isPayer(me, g);
  const restricted = !seesAll(me, g);
  const st = state.settings;
  const seg = (name, val, text) => `<button type="button" data-k="${name}" data-v="${val}" class="${String(st[name]) === String(val) ? 'on' : ''}">${text}</button>`;
  const payFrom = sel || accts[0];
  const ids = new Set(sel ? [sel.id] : [...accts.map(a => a.id), ...(rt ? [rt.id] : [])]);
  const opts = () => ({ ...st, collapse: restricted || st.collapse });
  return {
    html: `
      ${groupHead(g)}
      ${actions([
        { href: `#/transfer?to=${sel ? sel.id : rt ? rt.id : accts[0].id}`, ic: 'arrows', text: 'Contribute', primary: true },
        { href: `#/pay?from=${payFrom.id}`, ic: 'send', text: 'Pay', allowed: payer, why: payBlock(me, payFrom) },
        { href: `#/group/${g.id}/settings`, ic: 'sliders', text: g.owner === me ? 'Members & settings' : 'Members' },
      ])}
      <p class="note">${icon('funnel')}<span>Money can only flow into this group, by transfer from a member’s spending account or a router. It leaves only as payments by the owner and payers. <strong>${VIS[g.visibility].label}:</strong> ${VIS[g.visibility].text}</span></p>

      ${accts.length > 1 ? `
        <section class="sect first"><div class="sect-head"><h2>Accounts</h2><span class="muted small">${rt ? 'Payments to the group number are split by these rules.' : ''}</span></div>
        <div class="grid">${accts.map(a => `
          <a class="acard t-owt ${sel?.id === a.id ? 'sel' : ''}" href="#/group/${g.id}${sel?.id === a.id ? '' : '?acct=' + a.id}">
            <div class="acard-top">${typeChip(a)}${rt ? `<span class="role">${ruleText(rt, a.id) || 'No rule'}</span>` : ''}</div>
            <div class="acard-name">${esc(a.name)}</div>
            <div class="acard-no">${a.no}</div>
            <div class="acard-bal">${won(balance(a.id))}</div>
            <div class="acard-foot"><span class="muted small">${sel?.id === a.id ? 'Showing this account · click to show all' : 'Show activity'}</span></div>
          </a>`).join('')}</div></section>` : ''}

      <section class="card graph-card">
        <div class="graph-head">
          <div><h3>Who fills this group</h3><span class="muted small">${restricted ? 'Giving is private in this group: you see your own contributions and the total.' : 'Line width shows how much each member has put in.'}</span></div>
          <div class="controls">
            ${restricted ? '' : `<div class="seg" role="group" aria-label="Members">${seg('collapse', false, 'Each member')}${seg('collapse', true, 'You vs. others')}</div>`}
            <div class="seg" role="group" aria-label="Period">${seg('period', '30', '30 days')}${seg('period', '90', '90 days')}${seg('period', 'all', 'All time')}</div>
            <label class="switch"><input type="checkbox" id="showOut" ${st.showOut ? 'checked' : ''}><span></span> Payments out</label>
          </div>
        </div>
        <div id="graph">${graphSVG(g, opts())}</div>
        <div id="bd">${breakdown(g, st.period, restricted)}</div>
      </section>

      <div class="two-col">
        ${activityCard(sel ? `${esc(sel.name)} only` : restricted ? 'Other members’ names are hidden' : 'Every entry shows who acted')}
        <aside class="card side">
          <div class="side-head"><h3>Members</h3><span class="muted small">${members(g).length}</span></div>
          <ul class="ppl">${members(g).map(m => `<li>${avatar(m.user)}<span><strong>${esc(user(m.user).name)}${m.user === me ? ' <span class="muted">(you)</span>' : ''}</strong><span class="muted small">${ROLES[m.role]}</span></span></li>`).join('')}</ul>
          <a class="btn block" href="#/group/${g.id}/settings">${icon('sliders')} ${g.owner === me ? 'Members & settings' : 'View members'}</a>
        </aside>
      </div>`,
    init() {
      copyInit();
      activityInit(ids, restricted);
      const redraw = () => {
        save();
        $('#graph').innerHTML = graphSVG(g, opts());
        $('#bd').innerHTML = breakdown(g, st.period, restricted);
        $$('.graph-card .seg button').forEach(b => b.classList.toggle('on', String(st[b.dataset.k]) === b.dataset.v));
      };
      $$('.graph-card .seg button').forEach(b => b.addEventListener('click', () => {
        st[b.dataset.k] = b.dataset.k === 'collapse' ? b.dataset.v === 'true' : b.dataset.v;
        redraw();
      }));
      $('#showOut').addEventListener('change', ev => { st.showOut = ev.target.checked; redraw(); });
      let wasCompact = isCompact();
      onResize = () => { if (isCompact() !== wasCompact) { wasCompact = isCompact(); redraw(); } };
    },
  };
}

function settingsPage(gid) {
  const g = group(gid);
  const me = state.me;
  if (!g || !groupRole(me, g)) return notFound();
  const owner = g.owner === me;
  const accts = groupAccounts(gid);
  const rt = groupRouter(gid);
  const candidates = state.users.filter(u => !groupRole(u.id, g) && !g.members.some(m => m.user === u.id && m.state === 'invited'));
  const pending = g.members.filter(m => !isActive(m));
  const roleSelect = m => `<select class="mini-select" data-role="${m.user}" aria-label="Role of ${esc(user(m.user).name)}">
      <option value="payer" ${m.role === 'payer' ? 'selected' : ''}>Payer</option>
      <option value="contributor" ${m.role === 'contributor' ? 'selected' : ''}>Contributor</option></select>`;
  const usedByRouter = id => state.routers.some(r => r.rest === id || r.rules.some(x => x.to === id));
  return {
    html: `
      <div class="narrow wide">
        <a class="back" href="#/group/${g.id}">${icon('back')} ${esc(g.name)}</a>
        <h1 class="page-title">${owner ? 'Members & settings' : 'Members'}</h1>

        <section class="card">
          <h3>Who sees contributions</h3>
          ${owner ? `<div class="vis-pick">${Object.entries(VIS).map(([k, v]) => `
            <label class="vis ${g.visibility === k ? 'on' : ''}"><input type="radio" name="vis" value="${k}" ${g.visibility === k ? 'checked' : ''}>
              <span class="vis-top">${icon(v.icon)} <strong>${v.label}</strong></span><span class="muted small">${v.text}</span></label>`).join('')}</div>`
            : `<p class="note">${icon(VIS[g.visibility].icon)} <span><strong>${VIS[g.visibility].label}.</strong> ${VIS[g.visibility].text}</span></p>`}
        </section>

        <section class="card">
          <div class="side-head"><h3>Members</h3><span class="muted small">Payers can pay from the group. Contributors can only send money in.</span></div>
          <ul class="ppl big">${members(g).map(m => `<li>${avatar(m.user)}<span class="grow"><strong>${esc(user(m.user).name)}${m.user === me ? ' <span class="muted">(you)</span>' : ''}</strong><span class="muted small">${esc(user(m.user).email)}</span></span>
            ${m.role === 'owner' || !owner ? `<span class="role">${ROLES[m.role]}</span>` : `${roleSelect(m)}<button class="icon-btn" data-remove="${m.user}" title="Remove">${icon('trash')}</button>`}</li>`).join('')}
            ${owner ? pending.map(m => `<li class="pending">${avatar(m.user)}<span class="grow"><strong>${esc(user(m.user).name)}</strong><span class="muted small">${esc(user(m.user).email)}</span></span>
              <span class="role ${m.state}">${m.state === 'invited' ? `Invited as ${m.role} · waiting` : 'Declined'}</span><button class="icon-btn" data-remove="${m.user}" title="${m.state === 'invited' ? 'Withdraw invitation' : 'Remove'}">${icon('trash')}</button></li>`).join('') : ''}</ul>
          ${owner ? (candidates.length ? `
            <form class="row invite" id="inv">
              <label class="field grow"><span>Invite</span><select name="user">${candidates.map(u => `<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join('')}</select></label>
              <label class="field"><span>Role</span><select name="role"><option value="contributor">Contributor</option><option value="payer">Payer</option></select></label>
              <button class="btn primary">${icon('plus')} Invite</button>
            </form>
            <p class="muted small">Invited users see that this group’s contributions are ${VIS[g.visibility].label.toLowerCase()}, and join only if they accept.</p>` : '<p class="muted">Everyone in the demo is already a member or invited.</p>')
            : `<button class="btn" id="leave">${icon('out')} Leave group</button>`}
        </section>

        <section class="card">
          <div class="side-head"><h3>Accounts</h3><span class="muted small">Each account is a budget. Payments are made from a specific account.</span></div>
          <ul class="ppl big">${accts.map(a => `<li><span class="type-ic">${icon('funnel')}</span><span class="grow"><strong>${esc(a.name)}</strong><span class="muted small">${a.no}${rt ? ' · ' + (ruleText(rt, a.id) || 'no rule') : ''}</span></span>
            <strong class="num">${won(balance(a.id))}</strong>
            ${owner && accts.length > 1 ? `<button class="icon-btn" data-close="${a.id}" title="${balance(a.id) ? 'Only empty accounts can be closed' : usedByRouter(a.id) ? 'Remove router rules for this account first' : 'Close account'}" ${balance(a.id) || usedByRouter(a.id) ? 'disabled' : ''}>${icon('trash')}</button>` : ''}</li>`).join('')}</ul>
          ${owner ? `<form class="row" id="addAcct"><label class="field grow"><span>New account</span><input name="name" placeholder="e.g. Snacks" autocomplete="off"></label><button class="btn">${icon('plus')} Add account</button></form>` : ''}
        </section>

        <section class="card">
          <div class="side-head"><h3>${icon('split')} Group number</h3></div>
          ${rt ? `<p><strong class="mono">${rt.no}</strong> <span class="muted small">— members pay here, and the amount is split:</span></p>
              <ul class="hr-rules light">${rt.rules.map(r => `<li>${r.mode === 'pct' ? r.value + '%' : won(r.value)} → ${esc(acct(r.to)?.name)}</li>`).join('')}<li>Rest → ${esc(acct(rt.rest)?.name)}</li></ul>
              ${owner ? `<a class="btn" href="#/group/${g.id}/router">Edit split rules</a>` : ''}`
            : `<p class="muted">Members pay straight into ${accts.length === 1 ? 'the account' : 'one of the accounts'}. A group number splits each payment between the accounts automatically.</p>
               ${owner ? `<button class="btn" id="mkRouter">${icon('plus')} Create a group number</button>` : ''}`}
        </section>
      </div>`,
    init() {
      $$('input[name="vis"]').forEach(r => r.addEventListener('change', () => {
        g.visibility = r.value; save(); toast(`Contributions are now ${VIS[r.value].label.toLowerCase()}`); render();
      }));
      $$('[data-role]').forEach(s => s.addEventListener('change', () => {
        g.members.find(m => m.user === s.dataset.role).role = s.value; save();
        toast(`${esc(firstName(s.dataset.role))} is now a ${s.value}`);
      }));
      $$('[data-remove]').forEach(b => b.addEventListener('click', () => {
        const m = g.members.find(x => x.user === b.dataset.remove);
        g.members = g.members.filter(x => x.user !== b.dataset.remove);
        save(); toast(m?.state === 'invited' ? `Invitation to ${esc(user(b.dataset.remove).name)} withdrawn` : `${esc(user(b.dataset.remove).name)} is no longer a member`); render();
      }));
      $('#inv')?.addEventListener('submit', ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        g.members = g.members.filter(m => m.user !== f.get('user')); // replaces a declined invitation
        g.members.push({ user: f.get('user'), role: f.get('role'), state: 'invited', invited: Date.now() });
        save(); toast(`Invitation sent to ${esc(user(f.get('user')).name)}`); render();
      });
      $('#leave')?.addEventListener('click', () => {
        g.members = g.members.filter(m => m.user !== me);
        save(); toast(`You left ${esc(g.name)}`); go('#/home');
      });
      $$('[data-close]').forEach(b => b.addEventListener('click', () => {
        acct(b.dataset.close).closed = true; save(); toast('Account closed'); render();
      }));
      $('#addAcct')?.addEventListener('submit', ev => {
        ev.preventDefault();
        const name = ev.target.elements.name.value.trim();
        if (!name) return toast('Enter a name for the account.', 'error');
        state.accounts.push({ id: 'a' + Date.now().toString(36), type: 'owt', group: g.id, name, no: makeNo('owt'), created: Date.now() });
        save(); toast(`${esc(name)} added`); render();
      });
      $('#mkRouter')?.addEventListener('click', () => {
        state.routers.push({ id: 'rt-' + g.id, group: g.id, no: makeNo('router'), rest: accts[0].id, rules: [] });
        save(); go(`#/group/${g.id}/router`);
      });
    },
  };
}

/* ---------- setup from template (UC-04) ---------- */

function setupPage(q) {
  const me = state.me;
  const startWith = TEMPLATES[q.get('template')] ? q.get('template') : 'couple';
  const others = state.users.filter(u => u.id !== me);
  let budgets = [['Marketing', 20], ['Materials', 30], ['Joint exercises', 50]];
  return {
    html: `
      <div class="narrow wider">
        <a class="back" href="#/home">${icon('back')} Accounts</a>
        <h1 class="page-title">Set up a group</h1>
        <p class="muted">Pick the template closest to your group. It only creates ordinary accounts, rules and settings, and you can change all of them later.</p>
        <form id="f" class="form">
          <div class="types four">
            ${Object.entries(TEMPLATES).map(([k, t]) => `
              <label class="type t-owt">
                <input type="radio" name="template" value="${k}" ${k === startWith ? 'checked' : ''}>
                <span class="type-ic">${icon(t.icon)}</span>
                <strong>${t.label}</strong>
                <span class="muted small">${t.blurb}</span>
                <ul>${t.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
              </label>`).join('')}
          </div>
          <div class="card form" id="cfg"></div>
        </form>
      </div>`,
    init() {
      const f = $('#f');
      const draw = () => {
        const k = f.template.value, t = TEMPLATES[k];
        const vis = Object.entries(VIS).map(([v, d]) => `
          <label class="vis ${t.visibility === v ? 'on' : ''}"><input type="radio" name="vis" value="${v}" ${t.visibility === v ? 'checked' : ''}>
            <span class="vis-top">${icon(d.icon)} <strong>${d.label}</strong></span><span class="muted small">${d.text}</span></label>`).join('');
        $('#cfg').innerHTML = `
          <h3>${icon(t.icon)} ${t.label}</h3>
          <label class="field"><span>Name</span><input name="gname" value="${esc(t.name)}" autocomplete="off"></label>
          ${k === 'couple' ? `
            <label class="field"><span>Partner</span><select name="partner">${others.map(u => `<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join('')}</select>
              <small class="muted">Invited as a payer, so both of you can pay bills. They join when they accept.</small></label>
            <label class="field"><span>Your router sends this share of every income here</span>
              <div class="row nowrap"><input name="pct" class="pct" inputmode="numeric" value="30"><span class="muted">%</span></div>
              <small class="muted">${routerOf(me) ? 'A rule is added to your router.' : 'A router is created for you, with the rest going to your spending account.'} Your partner sets their own share.</small></label>` : ''}
          ${k === 'club' ? `
            <div class="field"><span>Budgets</span>
              <div id="budgets"></div>
              <button type="button" class="btn ghost" id="addB">${icon('plus')} Add budget</button>
              <small class="muted" id="bsum"></small></div>` : ''}
          <div class="field"><span>Who sees contributions</span><div class="vis-pick">${vis}</div></div>
          <p class="form-error" id="err"></p>
          <button class="btn primary">${icon('check')} Create ${t.label.toLowerCase()} group</button>`;
        if (k === 'club') drawBudgets();
        $$('input[name="vis"]').forEach(r => r.addEventListener('change', () =>
          $$('.vis', $('#cfg')).forEach(l => l.classList.toggle('on', l.querySelector('input').checked))));
        $('#addB')?.addEventListener('click', () => { budgets.push(['', 0]); drawBudgets(); });
      };
      const drawBudgets = () => {
        const sum = budgets.reduce((s, b) => s + b[1], 0);
        $('#budgets').innerHTML = budgets.map(([n, p], i) => `
          <div class="budget" data-i="${i}">
            <input data-f="name" value="${esc(n)}" placeholder="Budget name" aria-label="Budget name">
            <div class="row nowrap"><input data-f="pct" class="pct" inputmode="numeric" value="${p}" aria-label="Percent"><span class="muted">%</span></div>
            <button type="button" class="icon-btn" data-f="del" title="Remove" ${budgets.length < 2 ? 'disabled' : ''}>${icon('trash')}</button>
          </div>`).join('');
        $('#bsum').innerHTML = sum === 100
          ? `${icon('check', 'ok')} Adds up to 100%. Each payment to the club number is split this way.`
          : `${icon('x', 'no')} Adds up to ${sum}%. It must be exactly 100%.`;
      };
      $('#cfg').addEventListener('input', ev => {
        const row = ev.target.closest('.budget'); if (!row) return;
        const b = budgets[row.dataset.i];
        if (ev.target.dataset.f === 'name') b[0] = ev.target.value;
        if (ev.target.dataset.f === 'pct') {
          b[1] = Math.min(100, digits(ev.target.value)); ev.target.value = b[1] || '';
          const sum = budgets.reduce((s, x) => s + x[1], 0);
          $('#bsum').innerHTML = sum === 100 ? `${icon('check', 'ok')} Adds up to 100%. Each payment to the club number is split this way.` : `${icon('x', 'no')} Adds up to ${sum}%. It must be exactly 100%.`;
        }
      });
      $('#cfg').addEventListener('click', ev => {
        const b = ev.target.closest('[data-f="del"]'); if (!b) return;
        budgets.splice(b.closest('.budget').dataset.i, 1); drawBudgets();
      });
      f.addEventListener('change', ev => { if (ev.target.name === 'template') { budgets = [['Marketing', 20], ['Materials', 30], ['Joint exercises', 50]]; draw(); } });
      draw();

      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const k = f.template.value, t = TEMPLATES[k];
        const name = f.elements.gname.value.trim() || t.name;
        const err = m => { $('#err').textContent = m; };
        if (k === 'club') {
          if (budgets.some(b => !b[0].trim())) return err('Give every budget a name.');
          if (budgets.reduce((s, b) => s + b[1], 0) !== 100) return err('The budgets must add up to exactly 100%.');
        }
        const pct = k === 'couple' ? digits(f.elements.pct.value) : 0;
        if (k === 'couple' && (pct < 1 || pct > 100)) return err('Choose a share between 1 and 100%.');

        const id = 'g' + Date.now().toString(36);
        const g = { id, name, template: k, visibility: f.vis.value, owner: me, members: [], created: Date.now() };
        if (k === 'couple') g.members.push({ user: f.elements.partner.value, role: 'payer', state: 'invited', invited: Date.now() });
        state.groups.push(g);
        const mk = (n, i = 0) => {
          const a = { id: `${id}-${i}`, type: 'owt', group: id, name: n, no: makeNo('owt'), created: Date.now() };
          state.accounts.push(a); return a;
        };
        if (k === 'club') {
          const accts = budgets.map(([n], i) => mk(n.trim(), i));
          state.routers.push({ id: 'rt-' + id, group: id, no: makeNo('router'), rest: accts[accts.length - 1].id,
            rules: accts.slice(0, -1).map((a, i) => ({ to: a.id, mode: 'pct', value: budgets[i][1] })) });
        } else {
          const a = mk(name);
          if (k === 'couple') {
            let rt = routerOf(me);
            const sp = myPersonal().find(x => x.type === 'spending');
            if (!rt && sp) { rt = { id: 'rt-' + me, owner: me, no: makeNo('router'), rest: sp.id, rules: [] }; state.routers.push(rt); }
            if (rt) rt.rules.unshift({ to: a.id, mode: 'pct', value: pct });
          }
        }
        save();
        toast(k === 'couple' ? `${esc(name)} is set up. Invitation sent to ${esc(firstName(f.elements.partner.value))}` : `${esc(name)} is set up`);
        go(`#/group/${id}`);
      });
    },
  };
}

/* ---------- new personal account ---------- */

function newAccount() {
  return {
    html: `
      <div class="narrow wider">
        <a class="back" href="#/home">${icon('back')} Accounts</a>
        <h1 class="page-title">Open an account</h1>
        <form id="f" class="form">
          <div class="types">
            ${['spending', 'savings'].map((k, i) => { const t = TYPES[k]; return `
              <label class="type t-${k}">
                <input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''}>
                <span class="type-ic">${icon(t.icon)}</span>
                <strong>${t.label}</strong>
                <span class="muted small">${t.blurb}</span>
                <ul>${t.rules.map(r => `<li>${r}</li>`).join('')}</ul>
              </label>`; }).join('')}
            <a class="type t-owt" href="#/setup">
              <span class="type-ic">${icon('users')}</span>
              <strong>Sharing with others?</strong>
              <span class="muted small">Shared money lives in a group: a couple’s household, a club or a church fund.</span>
              <span class="hr-cta">Set up a group ${icon('chevron')}</span>
            </a>
          </div>
          <div class="card">
            <label class="field"><span>Name</span><input name="name" placeholder="Everyday" autocomplete="off" required></label>
            <p class="muted small">The account gets a new account number and starts at ₩0.</p>
            <button class="btn primary">${icon('plus')} Open account</button>
          </div>
        </form>
      </div>`,
    init() {
      const f = $('#f');
      f.addEventListener('change', () => { f.elements.name.placeholder = { spending: 'Everyday', savings: 'Holiday' }[f.type.value]; });
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const type = f.type.value;
        const name = f.elements.name.value.trim() || f.elements.name.placeholder;
        const a = { id: 'a' + Date.now().toString(36), type, owner: state.me, name, no: makeNo(type), created: Date.now() };
        state.accounts.push(a); save();
        toast(`${esc(name)} opened`);
        go(`#/account/${a.id}`);
      });
    },
  };
}

/* ---------- money movement pages ---------- */

function rulesCard() {
  const ok = icon('check', 'ok'), no = icon('x', 'no');
  return `<aside class="card side rules">
    <h3>What can go where</h3>
    <table>
      <thead><tr><th>From ↓ To →</th><th>Spending</th><th>Your savings</th><th>Your groups</th></tr></thead>
      <tbody>
        <tr><th>Your spending</th><td>${ok}</td><td>${ok}</td><td>${ok}</td></tr>
        <tr><th>Your savings</th><td>${ok}<span class="tiny">yours</span></td><td>${ok}</td><td>${no}</td></tr>
        <tr><th>Group</th><td>${no}</td><td>${no}</td><td>${no}</td></tr>
      </tbody>
    </table>
    <p class="muted small">Anyone can send to a spending account using its number. Money in a group only leaves as a payment by the owner or a payer. Sending to a router or group number splits the amount by its rules.</p>
  </aside>`;
}

function transferTargets() {
  const me = state.me;
  return uniq([
    ...myPersonal(), routerOf(me),
    ...myGroups().flatMap(g => [groupRouter(g.id), ...groupAccounts(g.id)]),
  ].filter(Boolean));
}

function transferPage(q) {
  const me = state.me;
  const froms = myPersonal();
  const tos = transferTargets();
  const pre = {
    from: q.get('from') || froms.find(a => a.type === 'spending')?.id,
    to: q.get('to') || '',
  };
  return {
    html: `
      <div class="pagehead"><h1 class="page-title">Transfer</h1><p class="muted">Send money from your accounts to your groups, your other accounts, or anyone’s spending account by its number.</p></div>
      <div class="two-col">
        <form class="card form" id="f">
          <label class="field"><span>From</span><select name="from">${options(froms, pre.from)}</select><small class="bal-hint" id="fromBal"></small></label>
          <label class="field"><span>To</span><select name="to"><option value="">Choose…</option>${options(tos, pre.to)}<option value="__no">Another account number…</option></select></label>
          <label class="field" id="noField" hidden><span>Account number</span><input name="no" inputmode="numeric" placeholder="1002-00-0000000" autocomplete="off"></label>
          <label class="field"><span>Amount (KRW)</span><input class="money" name="amount" inputmode="numeric" placeholder="0" autocomplete="off"></label>
          <label class="field"><span>Message <span class="muted">(optional)</span></span><input name="memo" maxlength="60" autocomplete="off"></label>
          <p class="verdict" id="verdict"></p>
          <div id="splitPrev"></div>
          <button class="btn primary block" id="go">${icon('arrows')} Transfer</button>
        </form>
        ${rulesCard()}
      </div>`,
    init() {
      const f = $('#f');
      moneyInputs(f);
      const dest = () => f.to.value === '__no' ? byNumber(f.no.value) : target(f.to.value);
      const check = () => {
        const from = acct(f.from.value), to = dest();
        $('#noField').hidden = f.to.value !== '__no';
        $('#fromBal').textContent = from ? `Balance ${won(balance(from.id))}` : '';
        let why = '';
        if (f.to.value === '__no' && f.no.value.trim() && !to) why = 'No open account has this number.';
        else if (to) why = transferBlock(me, from, to);
        const v = $('#verdict');
        v.className = 'verdict ' + (why ? 'bad' : to ? 'good' : '');
        v.innerHTML = why ? `${icon('x')} ${why}`
          : to ? `${icon('check')} ${routerById(to.id) ? `The amount will be split by the rules of ${esc(label(to.id))}.` : `You can send to ${esc(label(to.id))}.`}` : '';
        const amt = digits(f.amount.value);
        $('#splitPrev').innerHTML = !why && to && routerById(to.id) && amt ? splitPreview(routerById(to.id), amt) : '';
        $('#go').disabled = !!why;
        return why || (!to && 'Choose a destination.');
      };
      f.addEventListener('change', check);
      f.addEventListener('input', check);
      check();
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const why = check();
        const amount = digits(f.amount.value);
        if (why) return toast(why, 'error');
        if (amount <= 0) return toast('Enter an amount above ₩0.', 'error');
        const to = dest();
        transfer(state, f.from.value, to.id, amount, me, f.memo.value.trim());
        save();
        toast(`Sent ${won(amount)} to ${esc(label(to.id))}`);
        go(to.group ? `#/group/${to.group}` : acct(to.id)?.owner === me ? `#/account/${to.id}` : `#/account/${f.from.value}`);
      });
    },
  };
}

function payPage(q) {
  const me = state.me;
  const froms = [...myPersonal(), ...myGroups().flatMap(g => groupAccounts(g.id))];
  const pre = q.get('from') || froms.find(a => a.type === 'spending')?.id;
  const payees = ['E-mart', 'KEPCO', 'Mapo Realty', 'Coupang', 'Jirisan cabin'];
  return {
    html: `
      <div class="pagehead"><h1 class="page-title">Pay</h1><p class="muted">Pay someone outside the bank. Recorded on your side only.</p></div>
      <div class="two-col">
        <form class="card form" id="f">
          <label class="field"><span>Pay from</span><select name="from">${options(froms, pre, a => payBlock(me, a))}</select><small class="bal-hint" id="fromBal"></small></label>
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
            <li>${icon('check', 'ok')}<span>Your spending accounts — only you</span></li>
            <li>${icon('check', 'ok')}<span>Group accounts — the owner and <em>payers</em>, never below ₩0</span></li>
            <li>${icon('x', 'no')}<span>Savings — never; move money to spending first</span></li>
          </ul>
          <p class="muted small">Your own spending accounts may go below zero. The demo has no overdraft limit.</p>
        </aside>
      </div>`,
    init() {
      const f = $('#f');
      moneyInputs(f);
      const check = () => {
        const a = acct(f.from.value);
        $('#fromBal').textContent = a ? `Balance ${won(balance(a.id))}` : '';
        const why = payBlock(me, a, digits(f.amount.value));
        const v = $('#verdict');
        v.className = 'verdict ' + (why ? 'bad' : 'good');
        v.innerHTML = why ? `${icon('x')} ${why}` : `${icon('check')} You can pay from ${esc(label(a.id))}.`;
        $('#go').disabled = !!why;
        return why;
      };
      f.addEventListener('change', check);
      f.addEventListener('input', check);
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
        const a = acct(f.from.value);
        addTx(state, { type: 'payment', from: a.id, payee, ref: f.ref.value.trim(), amount, actor: me });
        save();
        toast(`Paid ${won(amount)} to ${esc(payee)}`);
        go(a.group ? `#/group/${a.group}` : `#/account/${a.id}`);
      });
    },
  };
}

function depositPage(q) {
  const me = state.me;
  const rt = routerOf(me);
  const tos = [...(rt ? [rt] : []), ...myPersonal()];
  const pre = q.get('to') || (rt ? rt.id : tos.find(a => !depositBlock(me, a))?.id);
  return {
    html: `
      <div class="pagehead"><h1 class="page-title">Deposit</h1><p class="muted">Simulate money arriving from outside the bank, like a salary or a cash deposit.</p></div>
      <div class="two-col">
        <form class="card form" id="f">
          <label class="field"><span>Deposit to</span><select name="to">${options(tos, pre, a => depositBlock(me, a))}</select></label>
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
        const t = target(f.to.value);
        const isRouter = !!routerById(f.to.value);
        const why = depositBlock(me, t);
        const v = $('#verdict');
        v.className = 'verdict ' + (why ? 'bad' : 'good');
        v.innerHTML = why ? `${icon('x')} ${why}` : `${icon('check')} ${isRouter ? 'The deposit will be split by your router.' : 'Deposits to spending accounts are allowed.'}`;
        $('#go').disabled = !!why;
        $('#side').innerHTML = isRouter
          ? `<h3>${icon('split')} How it will be split</h3>${splitPreview(rt, digits(f.amount.value))}<a class="btn block" href="#/router">Edit router rules</a>`
          : `<h3>Where can deposits go?</h3><ul class="checklist">
              <li>${icon('check', 'ok')}<span>Your spending accounts</span></li>
              <li>${icon('check', 'ok')}<span>Your router’s virtual number</span></li>
              <li>${icon('x', 'no')}<span>Savings</span></li><li>${icon('x', 'no')}<span>Group accounts</span></li></ul>
              <p class="muted small">Savings and group accounts are only filled by transfers, so every won in a group can be traced to a member.</p>
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
        deposit(state, f.to.value, amount, payer, memo, me);
        save();
        if (routerById(f.to.value)) { toast(`${won(amount)} received and split by your router`); go('#/router'); }
        else { toast(`${won(amount)} deposited`); go(`#/account/${f.to.value}`); }
      });
    },
  };
}

/* ---------- routers (UC-05) ---------- */

function splitPreview(rt, amount) {
  if (!amount) return `<p class="muted small">Enter an amount to see the split.</p>`;
  const plan = splitPlan(rt, amount);
  return `<ul class="split">${plan.map(p => {
    const a = acct(p.to);
    return `<li class="${a ? 't-' + a.type : ''}">
      <span class="split-bar"><span style="width:${p.amount / amount * 100}%"></span></span>
      <span class="split-row"><span>${esc(label(p.to))} <span class="muted small nowrap">${p.why}</span></span><strong>${won(p.amount)}</strong></span>
    </li>`;
  }).join('')}</ul>`;
}

function routerEditor(rt, { targets, canEdit, head, after }) {
  const draft = { rest: rt.rest, rules: rt.rules.map(r => ({ ...r })) };
  const opt = (sel, includeEmpty) => (includeEmpty ? '<option value="">Choose account…</option>' : '') + targets.map(a =>
    `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(label(a.id))} — ${kindOf(a)}</option>`).join('');
  const incoming = state.tx.filter(t => t.to === rt.id).sort((a, b) => b.ts - a.ts).slice(0, 6);
  return {
    html: `
      ${head}
      <div class="two-col">
        <form class="card form" id="f">
          <h3>Rules <span class="muted small">applied top to bottom</span></h3>
          <div id="rules"></div>
          ${canEdit ? `<button type="button" class="btn ghost" id="add">${icon('plus')} Add rule</button>` : ''}
          <label class="field rest"><span>Everything left goes to</span><select name="rest" ${canEdit ? '' : 'disabled'}>${opt(draft.rest)}</select></label>
          ${canEdit ? `<div class="row end"><button type="button" class="btn" id="undo">Discard changes</button><button class="btn primary">${icon('check')} Save rules</button></div>`
            : `<p class="note">${icon('lock')} Only the owner can change the rules.</p>`}
        </form>
        <aside class="card side">
          <h3>Preview</h3>
          <label class="field"><span>If this arrives</span><input class="money" id="sample" inputmode="numeric" value="${rt.group ? '30,000' : '3,000,000'}"></label>
          <div id="preview"></div>
          <p class="muted small">Percentages are of the amount received. Each rule only takes what is left, so the total never exceeds the amount.</p>
        </aside>
      </div>
      <section class="card">
        <div class="side-head"><h3>Recently received</h3><span class="muted small">Each amount and the transfers it caused</span></div>
        ${incoming.length ? `<ul class="routed">${incoming.map(d => `
          <li><div class="routed-head"><span>${icon(d.type === 'deposit' ? 'download' : 'arrows')} <strong>${esc(d.type === 'deposit' ? d.payer : user(d.actor)?.name)}</strong> <span class="muted small">${fmtTime(d.ts)}${d.memo ? ' · ' + esc(d.memo) : ''}</span></span><strong>${won(d.amount)}</strong></div>
          <ul>${state.tx.filter(t => t.via === d.id).map(t => `<li><span>↳ ${esc(label(t.to))} <span class="muted small">${esc(t.memo)}</span></span><span>${won(t.amount)}</span></li>`).join('')}</ul></li>`).join('')}</ul>`
          : '<div class="empty-sm">Nothing received yet.</div>'}
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
            <select data-f="to" aria-label="Send to" ${canEdit ? '' : 'disabled'}>${opt(r.to, true)}</select>
            <div class="seg mini">
              <button type="button" data-f="mode" data-v="pct" class="${r.mode === 'pct' ? 'on' : ''}" ${canEdit ? '' : 'disabled'}>%</button>
              <button type="button" data-f="mode" data-v="fixed" class="${r.mode === 'fixed' ? 'on' : ''}" ${canEdit ? '' : 'disabled'}>₩</button>
            </div>
            <input data-f="value" inputmode="numeric" value="${r.mode === 'pct' ? r.value : r.value.toLocaleString('en-US')}" aria-label="${r.mode === 'pct' ? 'Percent' : 'Amount'}" ${canEdit ? '' : 'disabled'}>
            ${canEdit ? `<button type="button" class="icon-btn" data-f="del" title="Remove rule">${icon('trash')}</button>` : '<span></span>'}
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
          draft.rules[i].value = b.dataset.v === 'pct' ? 10 : rt.group ? 5000 : 100000;
        }
        drawRules();
      });
      $('#add')?.addEventListener('click', () => { draft.rules.push({ to: '', mode: 'pct', value: 10 }); drawRules(); });
      f.rest.addEventListener('change', () => { draft.rest = f.rest.value; preview(); });
      $('#sample').addEventListener('input', preview);
      $('#undo')?.addEventListener('click', () => render());
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        if (draft.rules.some(r => !r.to)) return toast('Choose an account for every rule.', 'error');
        if (draft.rules.some(r => r.value <= 0)) return toast('Every rule needs a value above zero.', 'error');
        const pct = draft.rules.filter(r => r.mode === 'pct').reduce((s, r) => s + r.value, 0);
        rt.rules = draft.rules; rt.rest = draft.rest; save();
        toast(pct > 100 ? 'Rules saved. Percentages add up to more than 100%, so later rules may get nothing.' : 'Rules saved');
        render();
      });
      drawRules();
      after?.();
    },
  };
}

function routerPage() {
  const me = state.me;
  const rt = routerOf(me);
  const spendings = myPersonal().filter(a => a.type === 'spending');

  if (!rt) {
    return {
      html: `
        <div class="narrow wide">
          <div class="router-intro card">
            <span class="type-ic big t-router">${icon('split')}</span>
            <h1 class="page-title">Router</h1>
            <p class="lead">A router is a virtual account number. Whatever lands in it is split right away: a percentage or a fixed amount to each account you choose, and the rest to your spending account.</p>
            <p class="muted">Use it as your salary account to fund your savings and your groups automatically.</p>
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

  return routerEditor(rt, {
    targets: [...myPersonal(), ...myGroups().flatMap(g => groupAccounts(g.id))],
    canEdit: true,
    head: `
      <a class="back" href="#/home">${icon('back')} Accounts</a>
      <section class="acct-head t-router">
        <div>
          <div class="acct-chips"><span class="chip t-router">${icon('split')}Router</span><span class="role">Virtual account</span></div>
          <h1>Your router</h1>
          <button class="no-copy" data-copy="${rt.no}">${rt.no} ${icon('copy')}</button>
          <div class="muted small">Never holds money. Income is split the moment it arrives.</div>
        </div>
        <a class="btn primary" href="#/deposit?to=${rt.id}">${icon('download')} Simulate a deposit</a>
      </section>`,
  });
}

function groupRouterPage(gid) {
  const g = group(gid);
  const rt = groupRouter(gid);
  if (!g || !rt || !groupRole(state.me, g)) return notFound();
  return routerEditor(rt, {
    targets: groupAccounts(gid),
    canEdit: g.owner === state.me,
    head: `
      <a class="back" href="#/group/${g.id}/settings">${icon('back')} ${esc(g.name)} settings</a>
      <section class="acct-head t-router">
        <div>
          <div class="acct-chips"><span class="chip t-router">${icon('split')}Group number</span>${templateChip(g)}</div>
          <h1>${esc(g.name)}</h1>
          <button class="no-copy" data-copy="${rt.no}">${rt.no} ${icon('copy')}</button>
          <div class="muted small">Members pay here. Every payment is split between the group’s accounts and credited to the member who paid.</div>
        </div>
        <a class="btn primary" href="#/transfer?to=${rt.id}">${icon('arrows')} Contribute</a>
      </section>`,
  });
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
        </details>` : `<a class="btn" href="#/login">Log in</a>`}
    </div>`;
  $$('[data-switch]').forEach(b => b.addEventListener('click', () => {
    state.me = b.dataset.switch; save();
    toast(`Now viewing as ${esc(user(state.me).name)}`);
    const [path] = location.hash.split('?');
    location.hash = /^#\/(account|group)/.test(path) ? '#/home' : path;
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
  if (!state.me && key !== 'signup') key = 'login'; // a visitor can only register (UC-01)
  if (state.me && (key === 'login' || key === 'signup')) key = 'home';

  let page;
  switch (key) {
    case 'login': page = landing(); break;
    case 'signup': page = signup(); break;
    case 'home': page = home(); break;
    case 'new': page = newAccount(); break;
    case 'setup': page = setupPage(q); break;
    case 'account': page = accountPage(parts[1]); break;
    case 'group':
      page = parts[2] === 'settings' ? settingsPage(parts[1]) : parts[2] === 'router' ? groupRouterPage(parts[1]) : groupPage(parts[1], q);
      break;
    case 'transfer': page = transferPage(q); break;
    case 'pay': page = payPage(q); break;
    case 'deposit': page = depositPage(q); break;
    case 'router': page = routerPage(); break;
    default: page = notFound();
  }
  renderHeader(['account', 'new', 'group', 'setup'].includes(key) ? 'home' : key);
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
