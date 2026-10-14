// Builds the StarUML use case model (WBS 2.5) from the layout below.
// Run from the repository root:
//   node docs/interim/use-case-model/build-mdj.mjs              -> FBD_UseCases.mdj (model + diagram)
//   node docs/interim/use-case-model/build-mdj.mjs --no-views   -> FBD_UseCases_model-only.mdj
//   node docs/interim/use-case-model/build-mdj.mjs --preview <file.html>  -> SVG layout preview
//
// The model-only file contains every actor, use case and relationship but no
// diagram; use it if StarUML cannot open the full file, and drag the elements
// from the Model Explorer onto a new use case diagram.
//
// IDs are derived from fixed keys, so rebuilding gives the same IDs and small
// diffs. After editing the diagram in StarUML, treat the .mdj as the source
// and stop regenerating it.

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const noViews = args.includes('--no-views');
const previewPath = args.includes('--preview') ? args[args.indexOf('--preview') + 1] : null;

/* ---------- model content ---------- */

const ACTORS = [
  { key: 'visitor', name: 'Visitor', x: 40, y: 40, doc: 'An unauthenticated person: registers, logs in, or views a group’s public contributor page.' },
  { key: 'client', name: 'Client', x: 40, y: 473, doc: 'A registered user who owns personal accounts and a personal router.' },
  { key: 'owner', name: 'Group owner', x: 180, y: 880, doc: 'A client who owns a group, for example a treasurer.' },
  { key: 'member', name: 'Member', x: 60, y: 1000, doc: 'A client who is a contributor or payer in a group owned by someone else.' },
  { key: 'admin', name: 'Administrator', x: 1200, y: 822, doc: 'A bank staff member who investigates transactions and handles dispute flags.' },
];

// cx, cy: centre of the ellipse on the diagram. The left column holds every
// use case a Client takes part in, far enough from the actor that the
// Client's lines do not cut through neighbouring use cases; the right column
// holds the included use cases and the administrator's.
const USE_CASES = [
  { key: 'UC-01', name: 'Register User', cx: 660, cy: 60 },
  { key: 'UC-10', name: 'View History and Contributions', cx: 660, cy: 142 },
  { key: 'UC-11', name: 'Flag Unauthorised Transaction', cx: 660, cy: 224 },
  { key: 'UC-02', name: 'Log In and Log Out', cx: 660, cy: 306 },
  { key: 'UC-03', name: 'Manage Personal Accounts', cx: 660, cy: 388 },
  { key: 'UC-04', name: 'Set Up Group from Template', cx: 660, cy: 470 },
  { key: 'UC-05', name: 'Manage Router', cx: 660, cy: 552 },
  { key: 'UC-07', name: 'Transfer Funds', cx: 660, cy: 634 },
  { key: 'UC-08', name: 'Deposit Funds', cx: 660, cy: 716 },
  { key: 'UC-09', name: 'Make Payment or Withdrawal', cx: 660, cy: 798 },
  { key: 'UC-13', name: 'Manage Data-Access Consent', cx: 660, cy: 880 },
  { key: 'UC-06', name: 'Manage Group', cx: 660, cy: 980 },
  { key: 'INC-03', name: 'Apply Contribution Visibility', cx: 1010, cy: 142 },
  { key: 'INC-02', name: 'Split Amount by Router', cx: 1010, cy: 590 },
  { key: 'INC-01', name: 'Validate Money Movement', cx: 1010, cy: 730 },
  { key: 'UC-12', name: 'Investigate Transactions', cx: 1010, cy: 820 },
];

const DOCS = {
  'UC-01': 'FR-01. A visitor creates a user with name, unique e-mail and a password meeting the policy.',
  'UC-02': 'FR-02. Log in with e-mail and password; five consecutive failures block login for 24 hours (blocked_until, checked on each attempt). Log out; sessions expire after 30 minutes without a request.',
  'UC-03': 'FR-03. Open, list, rename and close personal spending and savings accounts.',
  'UC-04': 'FR-04. Create a group from the Couple, Club, Church or Custom template.',
  'UC-05': 'FR-05. Create and edit a personal router or a group number: ordered rules and a remainder account.',
  'UC-06': 'FR-06. Owner invites members (who join on accepting), manages visibility, roles, accounts and the group number; members can leave.',
  'UC-07': 'FR-07. Transfer from an own personal account to another account by number, subject to the flow rules.',
  'UC-08': 'FR-08. Deposit fictitious funds to an own spending account or own router.',
  'UC-09': 'FR-09. Pay an external payee from an own spending account, or from a group account as owner or payer.',
  'UC-10': 'FR-10. List transactions with actor and cause; show contributions within the group’s visibility; public page.',
  'UC-11': 'FR-11. Flag a transaction as unauthorised and follow the flag’s status.',
  'UC-12': 'FR-12. Administrator searches transactions and resolves flags; personal details masked.',
  'UC-13': 'FR-13. Administrator requests consent for a flag; client grants or denies; 72-hour expiry checked by timestamp.',
  'INC-01': 'Included use case (no own FR). Checks amount, account state, actor rights and the flow rules of Table II, the deposit limit, and that a group account does not go below zero.',
  'INC-02': 'Extension (no own FR). Splits an amount arriving at a router by its rules (DR-05), atomically with the incoming amount.',
  'INC-03': 'Included use case (no own FR). Limits per-member contributions to what the group’s visibility allows (DR-07).',
};

const assoc = (actor, ...ucs) => ucs.map(uc => ({ kind: 'assoc', from: actor, to: uc }));
const RELATIONS = [
  ...assoc('visitor', 'UC-01', 'UC-10'),
  ...assoc('client', 'UC-02', 'UC-03', 'UC-04', 'UC-05', 'UC-07', 'UC-08', 'UC-09', 'UC-10', 'UC-11', 'UC-13'),
  ...assoc('owner', 'UC-06'),
  ...assoc('member', 'UC-06'),
  ...assoc('admin', 'UC-12', 'UC-13'),
  { kind: 'gen', from: 'owner', to: 'client' },
  { kind: 'gen', from: 'member', to: 'client' },
  { kind: 'include', from: 'UC-07', to: 'INC-01' },
  { kind: 'include', from: 'UC-08', to: 'INC-01' },
  { kind: 'include', from: 'UC-09', to: 'INC-01' },
  { kind: 'include', from: 'UC-10', to: 'INC-03' },
  { kind: 'extend', from: 'INC-02', to: 'UC-07', point: 'Destination is a router' },
  { kind: 'extend', from: 'INC-02', to: 'UC-08', point: 'Destination is a router' },
  { kind: 'extend', from: 'UC-11', to: 'UC-10', point: 'Transaction selected' },
  { kind: 'extend', from: 'UC-13', to: 'UC-12', point: 'Personal details needed' },
];

const SUBJECT = { name: 'FBD Bank', left: 520, top: 0, width: 630, height: 1030 };
const UC_W = 220, UC_H = 52, ACTOR_W = 100, ACTOR_H = 96;

/* ---------- geometry ---------- */

const ucBox = u => ({ left: u.cx - UC_W / 2, top: u.cy - UC_H / 2, width: UC_W, height: UC_H });
const actorBox = a => ({ left: a.x, top: a.y, width: ACTOR_W, height: ACTOR_H });
const nodes = new Map([
  ...ACTORS.map(a => [a.key, { ...a, kind: 'actor', box: actorBox(a), c: [a.x + ACTOR_W / 2, a.y + 38] }]),
  ...USE_CASES.map(u => [u.key, { ...u, kind: 'uc', box: ucBox(u), c: [u.cx, u.cy] }]),
]);
for (const r of RELATIONS) {
  if (!nodes.has(r.from) || !nodes.has(r.to)) throw new Error(`Unknown node in relation ${r.from} -> ${r.to}`);
}

/* ---------- preview (SVG) ---------- */

function clip(n, toward) {
  // Point where the line from n's centre toward `toward` leaves n's shape.
  const [cx, cy] = n.c, dx = toward[0] - cx, dy = toward[1] - cy;
  if (n.kind === 'uc') {
    const a = UC_W / 2, b = UC_H / 2, t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
    return [cx + dx * t, cy + dy * t];
  }
  const t = Math.min(Math.abs((ACTOR_W / 2) / (dx || 1e-9)), Math.abs((ACTOR_H / 2) / (dy || 1e-9)));
  return [cx + dx * t, cy + dy * t];
}

function preview() {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let s = '';
  s += `<rect x="${SUBJECT.left}" y="${SUBJECT.top}" width="${SUBJECT.width}" height="${SUBJECT.height}" fill="none" stroke="#333"/>`;
  s += `<text x="${SUBJECT.left + SUBJECT.width / 2}" y="${SUBJECT.top + 20}" text-anchor="middle" font-weight="bold">${SUBJECT.name}</text>`;
  for (const r of RELATIONS) {
    const a = nodes.get(r.from), b = nodes.get(r.to);
    const p = clip(a, b.c), q = clip(b, a.c);
    const dashed = r.kind === 'include' || r.kind === 'extend';
    const head = r.kind === 'gen' ? 'url(#tri)' : dashed ? 'url(#open)' : '';
    s += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#444" ${dashed ? 'stroke-dasharray="6 4"' : ''} ${head ? `marker-end="${head}"` : ''}/>`;
    if (dashed) s += `<text x="${(p[0] + q[0]) / 2}" y="${(p[1] + q[1]) / 2 - 4}" text-anchor="middle" font-size="11" fill="#555">«${r.kind}»</text>`;
  }
  for (const n of nodes.values()) {
    if (n.kind === 'uc') {
      s += `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${UC_W / 2}" ry="${UC_H / 2}" fill="${n.key.startsWith('INC') ? '#f3f4f6' : '#fffbe6'}" stroke="#333"/>`;
      s += `<text x="${n.cx}" y="${n.cy - 3}" text-anchor="middle" font-size="12" font-weight="bold">${n.key}</text>`;
      s += `<text x="${n.cx}" y="${n.cy + 12}" text-anchor="middle" font-size="12">${esc(n.name)}</text>`;
    } else {
      const x = n.x + ACTOR_W / 2, y = n.y;
      s += `<g stroke="#333" fill="none"><circle cx="${x}" cy="${y + 12}" r="10"/><line x1="${x}" y1="${y + 22}" x2="${x}" y2="${y + 52}"/><line x1="${x - 16}" y1="${y + 32}" x2="${x + 16}" y2="${y + 32}"/><line x1="${x}" y1="${y + 52}" x2="${x - 13}" y2="${y + 72}"/><line x1="${x}" y1="${y + 52}" x2="${x + 13}" y2="${y + 72}"/></g>`;
      s += `<text x="${x}" y="${y + 90}" text-anchor="middle" font-size="13" font-weight="bold">${esc(n.name)}</text>`;
    }
  }
  const W = 1360, H = 1110;
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff;font-family:Arial">
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="-30 0 ${W} ${H}" font-family="Arial">
<defs><marker id="tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="14" markerHeight="14" orient="auto"><path d="M0 0L12 6L0 12z" fill="#fff" stroke="#444"/></marker>
<marker id="open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto"><path d="M0 0L12 6L0 12" fill="none" stroke="#444"/></marker></defs>
${s}</svg></body>`;
}

if (previewPath) {
  writeFileSync(previewPath, preview());
  console.log(`Preview written to ${previewPath}`);
  process.exit(0);
}

/* ---------- StarUML JSON ---------- */

const id = key => createHash('sha1').update('fbd-uc:' + key).digest('base64').slice(0, 20);
const R = x => ({ $ref: x });
const FONT = 'Arial;13;0';

const P = id('project'), M = id('model'), D = id('diagram'), S = id('subject');
const elId = key => id('el:' + key);
const relId = r => id(`rel:${r.kind}:${r.from}:${r.to}`);

const actorEls = ACTORS.map(a => ({ _type: 'UMLActor', _id: elId(a.key), _parent: R(M), name: a.name, documentation: a.doc, ownedElements: [] }));
const ucEls = USE_CASES.map(u => ({
  _type: 'UMLUseCase', _id: elId(u.key), _parent: R(M), name: `${u.key} ${u.name}`, documentation: DOCS[u.key], ownedElements: [],
  extensionPoints: RELATIONS.filter(r => r.kind === 'extend' && r.to === u.key).map(r => r.point)
    .filter((p, i, all) => all.indexOf(p) === i)
    .map(p => ({ _type: 'UMLExtensionPoint', _id: id(`xp:${u.key}:${p}`), _parent: R(elId(u.key)), name: p })),
}));
const byKey = new Map([...ACTORS.map((a, i) => [a.key, actorEls[i]]), ...USE_CASES.map((u, i) => [u.key, ucEls[i]])]);
for (const u of ucEls) if (!u.extensionPoints.length) delete u.extensionPoints;

for (const r of RELATIONS) {
  const owner = byKey.get(r.from), rid = relId(r);
  if (r.kind === 'assoc') {
    owner.ownedElements.push({
      _type: 'UMLAssociation', _id: rid, _parent: R(owner._id),
      end1: { _type: 'UMLAssociationEnd', _id: id(rid + ':end1'), _parent: R(rid), reference: R(elId(r.from)) },
      end2: { _type: 'UMLAssociationEnd', _id: id(rid + ':end2'), _parent: R(rid), reference: R(elId(r.to)) },
    });
  } else {
    const type = { gen: 'UMLGeneralization', include: 'UMLInclude', extend: 'UMLExtend' }[r.kind];
    const rel = { _type: type, _id: rid, _parent: R(owner._id), source: R(elId(r.from)), target: R(elId(r.to)) };
    if (r.kind === 'extend') {
      const base = byKey.get(r.to);
      const xp = base.extensionPoints.find(p => p.name === r.point);
      rel.extensionLocations = [R(xp._id)];
    }
    owner.ownedElements.push(rel);
  }
}
for (const el of byKey.values()) if (!el.ownedElements.length) delete el.ownedElements;

const subjectEl = { _type: 'UMLUseCaseSubject', _id: S, _parent: R(M), name: SUBJECT.name };

/* ---------- views ---------- */

const label = (key, parent, box, extra = {}) =>
  ({ _type: 'LabelView', _id: id(key), _parent: R(parent), font: FONT, left: box.left, top: box.top, width: box.width ?? 0, height: 13, ...extra });

function nameCompartment(viewId, modelId, text, box) {
  const nc = id(viewId + ':name');
  const l = k => id(`${nc}:${k}`);
  return {
    view: {
      _type: 'UMLNameCompartmentView', _id: nc, _parent: R(viewId), model: R(modelId),
      subViews: [
        label(`${nc}:stereotype`, nc, box, { visible: false }),
        label(`${nc}:name`, nc, box, { font: 'Arial;13;1', text }),
        label(`${nc}:namespace`, nc, box, { visible: false, text: '(from Use Case Model)' }),
        label(`${nc}:property`, nc, box, { visible: false, horizontalAlignment: 1 }),
      ],
      font: FONT, left: box.left, top: box.top, width: box.width, height: 25,
      stereotypeLabel: R(l('stereotype')), nameLabel: R(l('name')), namespaceLabel: R(l('namespace')), propertyLabel: R(l('property')),
    },
    id: nc,
  };
}

function compartment(type, viewId, modelId, key, box) {
  return { _type: type, _id: id(`${viewId}:${key}`), _parent: R(viewId), model: R(modelId), visible: false, font: FONT, left: box.left, top: box.top, width: 10, height: 10 };
}

function classifierView(type, key, el, box, display, extra = []) {
  const vid = id('view:' + key);
  const nc = nameCompartment(vid, el._id, el.name, box);
  const comps = {
    attributeCompartment: compartment('UMLAttributeCompartmentView', vid, el._id, 'attr', box),
    operationCompartment: compartment('UMLOperationCompartmentView', vid, el._id, 'oper', box),
    receptionCompartment: compartment('UMLReceptionCompartmentView', vid, el._id, 'recp', box),
    templateParameterCompartment: compartment('UMLTemplateParameterCompartmentView', vid, el._id, 'tmpl', box),
  };
  for (const [name, t] of extra) comps[name] = compartment(t, vid, el._id, name, box);
  const view = {
    _type: type, _id: vid, _parent: R(D), model: R(el._id),
    subViews: [nc.view, ...Object.values(comps)],
    font: FONT, containerChangeable: true,
    left: box.left, top: box.top, width: box.width, height: box.height,
    nameCompartment: R(nc.id),
    suppressAttributes: true, suppressOperations: true, suppressReceptions: true, showVisibility: true,
    stereotypeDisplay: display,
  };
  for (const [name, c] of Object.entries(comps)) view[name] = R(c._id);
  return view;
}

const edgeLabel = (edge, model, key, edgePosition, alpha, distance, extra = {}) => ({
  _type: 'EdgeLabelView', _id: id(`${edge}:${key}`), _parent: R(edge), model: R(model), visible: false,
  font: FONT, left: 0, top: 0, height: 13, alpha, distance, hostEdge: R(edge), edgePosition, ...extra,
});

function edgeView(r) {
  const rid = relId(r), vid = id('view:' + rid);
  const a = nodes.get(r.from), b = nodes.get(r.to);
  const base = {
    _id: vid, _parent: R(D), model: R(rid), font: FONT,
    head: R(id('view:' + r.to)), tail: R(id('view:' + r.from)),
    lineStyle: 1, points: `${a.c[0]}:${a.c[1]};${b.c[0]}:${b.c[1]}`, showVisibility: true,
  };
  if (r.kind === 'assoc') {
    const labels = {
      nameLabel: edgeLabel(vid, rid, 'name', 1, 1.5707963267948966, 15),
      stereotypeLabel: edgeLabel(vid, rid, 'stereo', 1, 1.5707963267948966, 30),
      propertyLabel: edgeLabel(vid, rid, 'prop', 1, -1.5707963267948966, 15),
      tailRoleNameLabel: edgeLabel(vid, rid, 'tailRole', 2, 0.5235987755982988, 30),
      tailPropertyLabel: edgeLabel(vid, rid, 'tailProp', 2, 0.7853981633974483, 40),
      tailMultiplicityLabel: edgeLabel(vid, rid, 'tailMult', 2, -0.5235987755982988, 25),
      headRoleNameLabel: edgeLabel(vid, rid, 'headRole', 0, -0.5235987755982988, 30),
      headPropertyLabel: edgeLabel(vid, rid, 'headProp', 0, -0.7853981633974483, 40),
      headMultiplicityLabel: edgeLabel(vid, rid, 'headMult', 0, 0.5235987755982988, 25),
    };
    const quals = {
      tailQualifiersCompartment: { _type: 'UMLQualifierCompartmentView', _id: id(`${vid}:tailQ`), _parent: R(vid), model: R(id(rid + ':end1')), visible: false, font: FONT, left: 0, top: 0, width: 10, height: 10 },
      headQualifiersCompartment: { _type: 'UMLQualifierCompartmentView', _id: id(`${vid}:headQ`), _parent: R(vid), model: R(id(rid + ':end2')), visible: false, font: FONT, left: 0, top: 0, width: 10, height: 10 },
    };
    const v = { _type: 'UMLAssociationView', ...base, subViews: [...Object.values(labels), ...Object.values(quals)] };
    for (const [k, l] of Object.entries({ ...labels, ...quals })) v[k] = R(l._id);
    return v;
  }
  const type = { gen: 'UMLGeneralizationView', include: 'UMLIncludeView', extend: 'UMLExtendView' }[r.kind];
  const labels = {
    nameLabel: edgeLabel(vid, rid, 'name', 1, 1.5707963267948966, 15),
    stereotypeLabel: edgeLabel(vid, rid, 'stereo', 1, 1.5707963267948966, 30, r.kind === 'gen' ? {} : { visible: true, text: `«${r.kind}»` }),
    propertyLabel: edgeLabel(vid, rid, 'prop', 1, -1.5707963267948966, 15),
  };
  const v = { _type: type, ...base, subViews: Object.values(labels) };
  for (const [k, l] of Object.entries(labels)) v[k] = R(l._id);
  return v;
}

function subjectView() {
  const vid = id('view:subject');
  const nl = label(`${vid}:name`, vid, { left: SUBJECT.left, top: SUBJECT.top + 8, width: SUBJECT.width }, { font: 'Arial;13;1', text: SUBJECT.name, horizontalAlignment: 2 });
  return {
    _type: 'UMLUseCaseSubjectView', _id: vid, _parent: R(D), model: R(S), subViews: [nl],
    font: FONT, containerChangeable: true, containerExtending: true,
    left: SUBJECT.left, top: SUBJECT.top, width: SUBJECT.width, height: SUBJECT.height,
    nameLabel: R(nl._id),
  };
}

const views = noViews ? [] : [
  subjectView(),
  ...ACTORS.map((a, i) => classifierView('UMLActorView', a.key, actorEls[i], nodes.get(a.key).box, 'icon')),
  ...USE_CASES.map((u, i) => classifierView('UMLUseCaseView', u.key, ucEls[i], nodes.get(u.key).box, 'label',
    [['extensionPointCompartment', 'UMLExtensionPointCompartmentView']])),
  ...RELATIONS.map(edgeView),
];

const diagram = { _type: 'UMLUseCaseDiagram', _id: D, _parent: R(M), name: 'Use Case Diagram', defaultDiagram: true, ownedViews: views };
const project = {
  _type: 'Project', _id: P, name: 'FBD Bank',
  ownedElements: [{
    _type: 'UMLModel', _id: M, _parent: R(P), name: 'Use Case Model',
    // Use cases sorted by ID (UC-01 … UC-13, then INC-01 …) for the Model Explorer.
    ownedElements: [...(noViews ? [] : [diagram]), subjectEl, ...actorEls,
      ...[...ucEls].sort((a, b) => a.name.startsWith('INC') - b.name.startsWith('INC') || a.name.localeCompare(b.name))],
  }],
};

/* ---------- integrity check: unique IDs, every $ref resolves ---------- */

const ids = new Map(), refs = [];
(function walk(o, path) {
  if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${path}[${i}]`));
  if (!o || typeof o !== 'object') return;
  if (o._id) {
    if (ids.has(o._id)) throw new Error(`Duplicate _id ${o._id} at ${path} and ${ids.get(o._id)}`);
    ids.set(o._id, path);
  }
  if (o.$ref) refs.push([o.$ref, path]);
  for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
})(project, 'project');
const missing = refs.filter(([r]) => !ids.has(r));
if (missing.length) throw new Error(`Unresolved $ref: ${missing.slice(0, 3).map(m => m.join(' at ')).join('; ')}`);

const file = join(HERE, noViews ? 'FBD_UseCases_model-only.mdj' : 'FBD_UseCases.mdj');
writeFileSync(file, JSON.stringify(project, null, '\t'));
console.log(`Wrote ${file}: ${ACTORS.length} actors, ${USE_CASES.length} use cases, ${RELATIONS.length} relationships, ${views.length} diagram views, ${ids.size} IDs, ${refs.length} references (all resolved).`);
