// Builds the StarUML analysis model (WBS 3.1 to 3.3, first versions) next to the use case model.
// Run from the repository root:
//   node docs/interim/analysis-model/build-mdj.mjs   -> FBD_Analysis.mdj
//
// Diagrams:
//   - Activity diagram: router split (DR-05, INC-02)
//   - State diagram: TransactionFlag (UC-11, UC-12)
//   - State diagram: Consent (UC-13)
//   - Sequence diagram: deposit to a router (UC-08 with INC-01 and INC-02)
//   - Domain class diagram: the ten entities of Table V
//
// Views are written with their position and size only; StarUML creates their
// compartments and labels when it opens the file. StarUML widens a view to fit
// its text on one line, so widths here are estimated from the text to keep the
// layout as planned. Lines get explicit points, which StarUML needs to draw them.
//
// IDs are derived from fixed keys, so rebuilding gives the same IDs and small
// diffs. After editing a diagram in StarUML, treat the .mdj as the source and
// stop regenerating it.

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ---------- ids, references, views ---------- */

const id = key => createHash('sha1').update('fbd-analysis:' + key).digest('base64').slice(0, 20);
const R = x => ({ $ref: x });
const RECTILINEAR = 0, OBLIQUE = 1; // StarUML's EdgeView line styles

/** Width that fits `text` on one line in StarUML's default font (Arial 13), plus padding. */
const fit = (text, bold = true) => Math.round(text.length * (bold ? 7.6 : 7) + 30);

/** A diagram to put views on. */
function diagram(type, key, parent, name) {
  return { _type: type, _id: id('diagram:' + key), _parent: R(parent._id), name, ownedViews: [] };
}

/** A node view at a box; StarUML adds its compartments and may grow it to fit its text. */
function node(d, type, model, box, extra = {}) {
  const v = { _type: type, _id: id(`view:${d._id}:${model._id}`), _parent: R(d._id), model: R(model._id), ...box, ...extra };
  d.ownedViews.push(v);
  return v;
}

/** A line between two views; `via` adds bend points, `shift` moves a straight line sideways (for parallel lines). */
function edge(d, type, model, tail, head, { via = [], shift = 0, lineStyle = RECTILINEAR } = {}) {
  const v = {
    _type: type, _id: id(`view:${d._id}:${model._id}`), _parent: R(d._id), model: R(model._id),
    tail: R(tail._id), head: R(head._id), lineStyle, _via: via, _shift: shift,
  };
  d.ownedViews.push(v);
  return v;
}

function note(d, key, text, box) {
  const v = { _type: 'UMLNoteView', _id: id(`note:${d._id}:${key}`), _parent: R(d._id), text, ...box };
  d.ownedViews.push(v);
  return v;
}

function noteLink(d, key, from, to, via = []) {
  const v = {
    _type: 'UMLNoteLinkView', _id: id(`notelink:${d._id}:${key}`), _parent: R(d._id),
    tail: R(from._id), head: R(to._id), lineStyle: OBLIQUE, _via: via, _shift: 0,
  };
  d.ownedViews.push(v);
  return v;
}

const centre = v => [v.left + v.width / 2, v.top + v.height / 2];

/** Fills in the points of every line from the centres of its ends, its bend points and its sideways shift. */
function layOutLines(views) {
  // Lines may end on nested views, such as a lifeline's line part.
  const byId = new Map(views.flatMap(v => [v, ...(v.subViews ?? [])]).map(v => [v._id, v]));
  for (const v of views) {
    if (!v.tail || v.points) continue;
    const a = centre(byId.get(v.tail.$ref)), b = centre(byId.get(v.head.$ref));
    let pts = [a, ...v._via, b];
    if (v._shift && !v._via.length) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      pts = pts.map(([x, y]) => [x + nx * v._shift, y + ny * v._shift]);
    }
    v.points = pts.map(([x, y]) => `${Math.round(x)}:${Math.round(y)}`).join(';');
  }
  for (const v of views) {
    delete v._via;
    delete v._shift;
  }
}

/* ---------- project and model ---------- */

const project = { _type: 'Project', _id: id('project'), name: 'FBD Bank', ownedElements: [] };
const model = {
  _type: 'UMLModel', _id: id('model'), _parent: R(project._id), name: 'Analysis Model', ownedElements: [],
  documentation: 'Analysis model of FBD Bank for the interim report: router split, flag and consent life cycles, the router deposit, and the domain classes. See README.md.',
};
project.ownedElements.push(model);

/* ======================================================================
 * Activity diagram: router split (DR-05, INC-02)
 * ====================================================================== */

const activity = {
  _type: 'UMLActivity', _id: id('activity:split'), _parent: R(model._id), name: 'INC-02 Split Amount by Router',
  documentation: 'DR-05: rules in order; a percentage of the received amount rounded down to whole won, or a fixed amount; each rule takes at most what is left; the rest goes to the remainder account; everything committed together or not at all.',
  nodes: [], edges: [], ownedElements: [],
};
model.ownedElements.push(activity);
const ad = diagram('UMLActivityDiagram', 'split', activity, 'Activity Diagram - Router Split (DR-05)');
activity.ownedElements.push(ad);

const actViews = new Map();
function actNode(key, type, name, box) {
  const el = { _type: type, _id: id('act:' + key), _parent: R(activity._id), ...(name ? { name } : {}) };
  activity.nodes.push(el);
  actViews.set(key, node(ad, type === 'UMLAction' ? 'UMLActionView' : 'UMLControlNodeView', el, box));
}
function flow(from, to, guard, via = []) {
  const el = {
    _type: 'UMLControlFlow', _id: id(`flow:${from}:${to}`), _parent: R(activity._id),
    source: R(id('act:' + from)), target: R(id('act:' + to)), ...(guard ? { guard } : {}),
  };
  activity.edges.push(el);
  edge(ad, 'UMLControlFlowView', el, actViews.get(from), actViews.get(to), { via });
}
const AH = 40;
const action = (key, name, cx, cy) => {
  const w = fit(name);
  actNode(key, 'UMLAction', name, { left: Math.round(cx - w / 2), top: cy - AH / 2, width: w, height: AH });
};
const control = (key, type, cx, cy, size = 26) =>
  actNode(key, type, null, { left: cx - size / 2, top: cy - size / 2, width: size, height: size });

// The rules are handled down the middle column (x = 520) and loop back up the left side;
// the remainder and the commit are in the right column (x = 1050).
const MID = 520, RIGHT = 1050, BACK = 130;
control('start', 'UMLInitialNode', MID, 30, 22);
action('receive', 'Receive amount A at the router', MID, 95);
action('begin', 'Begin one database transaction; record A', MID, 165);
action('left', 'left := A', MID, 235);
control('loop', 'UMLMergeNode', MID, 305);
control('more', 'UMLDecisionNode', MID, 375);
action('next', 'Take the next rule, in order of position', MID, 450);
control('mode', 'UMLDecisionNode', MID, 525);
action('percent', 'share := floor(A × percentage / 100)', MID - 175, 600);
action('fixed', 'share := fixed amount', MID + 190, 600);
control('mode-merge', 'UMLMergeNode', MID, 675);
action('take', 'take := min(share, left)', MID, 745);
control('positive', 'UMLDecisionNode', MID, 815);
action('rule-transfer', 'Record transfer of take to the rule\'s target account', MID, 895);
action('subtract', 'left := left − take', MID, 965);
control('next-merge', 'UMLMergeNode', MID, 1035);
control('rest', 'UMLDecisionNode', RIGHT, 375);
action('remainder', 'Record transfer of left to the remainder account', RIGHT, 455);
control('rest-merge', 'UMLMergeNode', RIGHT, 535);
action('commit', 'Commit A and all transfers together', RIGHT, 610);
control('end', 'UMLActivityFinalNode', RIGHT, 685);

flow('start', 'receive');
flow('receive', 'begin');
flow('begin', 'left');
flow('left', 'loop');
flow('loop', 'more');
flow('more', 'next', 'more rules');
flow('more', 'rest', 'no more rules');
flow('next', 'mode');
flow('mode', 'percent', 'percentage rule', [[MID - 175, 525]]);
flow('mode', 'fixed', 'fixed rule', [[MID + 190, 525]]);
flow('percent', 'mode-merge', null, [[MID - 175, 675]]);
flow('fixed', 'mode-merge', null, [[MID + 190, 675]]);
flow('mode-merge', 'take');
flow('take', 'positive');
flow('positive', 'rule-transfer', 'take > 0');
// take = 0 when nothing is left: no transfer, since every recorded amount is above zero (INC-01).
flow('positive', 'next-merge', 'take = 0', [[MID - 290, 815], [MID - 290, 1035]]);
flow('rule-transfer', 'subtract');
flow('subtract', 'next-merge');
flow('next-merge', 'loop', null, [[MID, 1085], [BACK, 1085], [BACK, 305]]);
flow('rest', 'remainder', 'left > 0');
flow('rest', 'rest-merge', 'left = 0', [[RIGHT + 260, 375], [RIGHT + 260, 535]]);
flow('remainder', 'rest-merge');
flow('rest-merge', 'commit');
flow('commit', 'end');

const NX = 880, NW = 400;
const atomicNote = note(ad, 'atomic',
  'DR-05: A and every transfer it causes are committed together or not at all. If any step fails, the database transaction is rolled back and nothing is recorded. The router never holds money.',
  { left: NX, top: 740, width: NW, height: 80 });
noteLink(ad, 'atomic', atomicNote, actViews.get('commit'), [[RIGHT + 210, 610]]);
const roundNote = note(ad, 'round',
  'Whole won only (int64, DR-03). The percentage is of the received amount A, not of what is left. Each rule takes at most what is left, so a later rule may receive less than its share, or nothing.',
  { left: NX, top: 845, width: NW, height: 80 });
noteLink(ad, 'round', roundNote, actViews.get('take'));
const actorNote = note(ad, 'actor',
  'Each transfer records the actor of A as its actor and A\'s transaction as its cause, so a split through a group router is credited to the member who paid.',
  { left: NX, top: 950, width: NW, height: 70 });
noteLink(ad, 'actor', actorNote, actViews.get('rule-transfer'));

/* ======================================================================
 * State machines: TransactionFlag (UC-11, UC-12) and Consent (UC-13)
 * ====================================================================== */

function stateMachine(key, name, documentation) {
  const sm = { _type: 'UMLStateMachine', _id: id('sm:' + key), _parent: R(model._id), name, documentation, regions: [], ownedElements: [] };
  const region = { _type: 'UMLRegion', _id: id(`sm:${key}:region`), _parent: R(sm._id), vertices: [], transitions: [] };
  sm.regions.push(region);
  const d = diagram('UMLStatechartDiagram', 'sm:' + key, sm, `State Diagram - ${name}`);
  sm.ownedElements.push(d);
  model.ownedElements.push(sm);
  const views = new Map();
  return {
    d,
    initial(k, cx, cy) {
      const el = { _type: 'UMLPseudostate', _id: id(`sm:${key}:${k}`), _parent: R(region._id), kind: 'initial' };
      region.vertices.push(el);
      views.set(k, node(d, 'UMLPseudostateView', el, { left: cx - 11, top: cy - 11, width: 22, height: 22 }));
    },
    state(k, name, left, cy, documentation) {
      const el = { _type: 'UMLState', _id: id(`sm:${key}:${k}`), _parent: R(region._id), name, documentation };
      region.vertices.push(el);
      views.set(k, node(d, 'UMLStateView', el, { left, top: cy - 28, width: Math.max(170, fit(name)), height: 56 }));
    },
    transition(from, to, name, via = []) {
      const el = {
        _type: 'UMLTransition', _id: id(`sm:${key}:t:${from}:${to}`), _parent: R(region._id),
        source: R(id(`sm:${key}:${from}`)), target: R(id(`sm:${key}:${to}`)), name,
      };
      region.transitions.push(el);
      edge(d, 'UMLTransitionView', el, views.get(from), views.get(to), { via });
    },
    view: k => views.get(k),
  };
}

// TransactionFlag: Open -> Under Review -> Resolved (confirmed / rejected).
const flag = stateMachine('flag', 'TransactionFlag',
  'Life cycle of a dispute flag (UC-11, UC-12). Created by the client who owns the account; reviewed and resolved by an administrator.');
flag.initial('init', 40, 140);
flag.state('open', 'Open', 200, 140,
  'A client has flagged the transaction (UC-11). While a flag on an account is open, the account cannot be closed (UC-03 A3).');
flag.state('review', 'Under Review', 560, 140,
  'An administrator has taken up the flag and added a note (UC-12 step 4).');
flag.state('confirmed', 'Resolved (confirmed)', 1030, 50,
  'The administrator found the transaction unauthorised; the note says why. Corrections are made by new transactions (DR-04).');
flag.state('rejected', 'Resolved (rejected)', 1030, 230,
  'The administrator found the transaction authorised; the note says why.');
flag.transition('init', 'open', 'flag(reason)');
flag.transition('open', 'review', 'startReview(note)');
flag.transition('review', 'confirmed', 'resolve(confirmed, note)', [[880, 140], [880, 50]]);
flag.transition('review', 'rejected', 'resolve(rejected, note)', [[880, 140], [880, 230]]);
const flagNote = note(flag.d,
  'flag', 'flag(reason): only by the client who owns the account, or the owner of the group that holds it, and only if the transaction has no open flag. Records the reporter, the reason and the time (UC-11).\nstartReview and resolve: by an administrator, each with a note (UC-12). The client follows the state and the notes. Resolved flags are kept.',
  { left: 200, top: 290, width: 820, height: 80 });
noteLink(flag.d, 'flag', flagNote, flag.view('open'));

// Consent: Pending -> Granted / Denied; Granted -> Revoked / Expired.
const consent = stateMachine('consent', 'Consent',
  'Life cycle of a data-access consent (UC-13). Requested by an administrator for one flag; decided by the client who reported it. Expiry is checked by timestamp when the details are opened; no scheduled job runs.');
consent.initial('init', 40, 160);
consent.state('pending', 'Pending', 200, 160, 'Requested by an administrator during an investigation (UC-12, UC-13 step 2); the details stay masked.');
consent.state('granted', 'Granted', 640, 70, 'Opening the personal details is allowed, and logged, while now < expires_at (UC-13 step 5).');
consent.state('denied', 'Denied', 640, 250, 'The details stay masked (UC-13 A1).');
consent.state('revoked', 'Revoked', 1110, 20, 'Revoked by the client, with immediate effect (UC-13 A2).');
consent.state('expired', 'Expired', 1110, 140, 'now >= expires_at. Not stored: derived from expires_at whenever the details are opened (UC-13 E1).');
consent.transition('init', 'pending', 'request(flag)');
consent.transition('pending', 'granted', 'grant / expires_at := now + 72 h', [[500, 160], [500, 70]]);
consent.transition('pending', 'denied', 'deny', [[500, 160], [500, 250]]);
consent.transition('granted', 'revoked', 'revoke', [[970, 70], [970, 20]]);
consent.transition('granted', 'expired', 'when (now >= expires_at)', [[970, 70], [970, 140]]);
const consentNote = note(consent.d, 'consent',
  'request(flag): by an administrator, for a flag the client reported. grant, deny and revoke: by that client.\nExpiry is checked by comparing the current time with expires_at each time the administrator opens the details; no scheduled job is used.\nAfter Denied, Revoked or Expired, the administrator may request consent again, which creates a new Consent in Pending.',
  { left: 200, top: 320, width: 620, height: 96 });
noteLink(consent.d, 'consent', consentNote, consent.view('pending'));

/* ======================================================================
 * Sequence diagram: deposit to a router (UC-08, INC-01, INC-02)
 * ====================================================================== */

// Boundary and control classes that only appear as lifelines.
const analysisPkg = {
  _type: 'UMLPackage', _id: id('pkg:analysis'), _parent: R(model._id), name: 'Analysis Classes', ownedElements: [],
  documentation: 'The actor, boundary and control classes used in the sequence diagram. The entity classes are in the Domain package.',
};
model.ownedElements.push(analysisPkg);
const analysisClass = (name, stereotype, documentation) => {
  const c = { _type: 'UMLClass', _id: id('analysis:' + name), _parent: R(analysisPkg._id), name, stereotype, documentation };
  analysisPkg.ownedElements.push(c);
  return c;
};
const clientActor = { _type: 'UMLActor', _id: id('actor:client'), _parent: R(analysisPkg._id), name: 'Client', documentation: 'The client of the use case model.' };
analysisPkg.ownedElements.push(clientActor);
const depositPage = analysisClass('DepositPage', 'boundary', 'The deposit form: target, sender\'s name, message and amount.');
const depositController = analysisClass('DepositController', 'control', 'Validates a deposit (INC-01), records it, and splits it when the target is a router (INC-02), in one database transaction.');

// Entity classes are created with the class diagram below; the lifelines refer to them by id.
const domainPkg = {
  _type: 'UMLPackage', _id: id('pkg:domain'), _parent: R(model._id), name: 'Domain', ownedElements: [],
  documentation: 'Entity classes from Table V of the interim report.',
};
model.ownedElements.push(domainPkg);
const entityRef = name => ({ _id: id('class:' + name), name });

const collab = { _type: 'UMLCollaboration', _id: id('collab:deposit'), _parent: R(model._id), name: 'UC-08 Deposit to a Router', attributes: [], ownedElements: [] };
model.ownedElements.push(collab);
const interaction = {
  _type: 'UMLInteraction', _id: id('interaction:deposit'), _parent: R(collab._id), name: 'Deposit to a Router',
  documentation: 'UC-08 Deposit Funds with the client\'s router as target: INC-01 validates the deposit, INC-02 splits it by the router\'s rules (DR-05).',
  participants: [], messages: [], fragments: [], ownedElements: [],
};
collab.ownedElements.push(interaction);
const sd = diagram('UMLSequenceDiagram', 'deposit', interaction, 'Sequence Diagram - Deposit to a Router (UC-08)');
interaction.ownedElements.push(sd);

// Lifelines get their length once the messages are placed (see below); messages beyond a lifeline's end would be
// pushed up to it.
const LL_TOP = 20, LL_HEIGHT = 100;
const lifelines = new Map();
function lifeline(key, name, type, cx, stereotype) {
  const role = { _type: 'UMLAttribute', _id: id('role:' + key), _parent: R(collab._id), name, type: R(type._id) };
  collab.attributes.push(role);
  const el = {
    _type: 'UMLLifeline', _id: id('lifeline:' + key), _parent: R(interaction._id), name, represent: R(role._id),
    ...(stereotype ? { stereotype } : {}),
  };
  interaction.participants.push(el);
  // Wide enough for the label, so StarUML does not widen it and move its centre away from the messages.
  const width = Math.max(130, fit(`${name}: ${type.name}`));
  const view = node(sd, 'UMLSeqLifelineView', el, { left: cx - width / 2, top: LL_TOP, width, height: LL_HEIGHT });
  // Messages end on the dashed line part, not on the lifeline's head.
  const line = {
    _type: 'UMLLinePartView', _id: id('view:linepart:' + key), _parent: R(view._id), model: R(el._id),
    left: cx, top: LL_TOP + 40, width: 1, height: LL_HEIGHT - 40,
  };
  view.subViews = [line];
  view.linePart = R(line._id);
  lifelines.set(key, { el, view, line, x: cx });
}

let msgNo = 0;
function message(from, to, name, y, sort = 'synchCall') {
  const el = {
    _type: 'UMLMessage', _id: id(`msg:${++msgNo}`), _parent: R(interaction._id), name, messageSort: sort,
    source: R(lifelines.get(from).el._id), target: R(lifelines.get(to).el._id),
  };
  interaction.messages.push(el);
  const a = lifelines.get(from), b = lifelines.get(to);
  const points = from === to
    ? `${a.x}:${y};${a.x + 40}:${y};${a.x + 40}:${y + 20};${a.x}:${y + 20}`
    : `${a.x}:${y};${b.x}:${y}`;
  sd.ownedViews.push({
    _type: 'UMLSeqMessageView', _id: id(`view:msg:${msgNo}`), _parent: R(sd._id), model: R(el._id),
    tail: R(a.line._id), head: R(b.line._id), points,
  });
}

/** A combined fragment; `splits` are the y positions where one operand ends and the next begins. */
function fragment(key, operator, box, guards, splits = []) {
  const el = { _type: 'UMLCombinedFragment', _id: id('frag:' + key), _parent: R(interaction._id), interactionOperator: operator, operands: [] };
  guards.forEach((guard, i) => el.operands.push({ _type: 'UMLInteractionOperand', _id: id(`frag:${key}:op${i}`), _parent: R(el._id), guard }));
  interaction.fragments.push(el);
  const view = { _type: 'UMLCombinedFragmentView', _id: id('view:frag:' + key), _parent: R(sd._id), model: R(el._id), ...box };
  const HEADER = 24; // the operator's tab at the top of the frame
  const compartment = {
    _type: 'UMLInteractionOperandCompartmentView', _id: id(`view:frag:${key}:operands`), _parent: R(view._id), model: R(el._id),
    left: box.left, top: box.top + HEADER, width: box.width, height: box.height - HEADER, subViews: [],
  };
  const tops = [box.top + HEADER, ...splits, box.top + box.height];
  el.operands.forEach((op, i) => compartment.subViews.push({
    _type: 'UMLInteractionOperandView', _id: id(`view:frag:${key}:op${i}`), _parent: R(compartment._id), model: R(op._id),
    left: box.left, top: tops[i], width: box.width, height: tops[i + 1] - tops[i],
  }));
  view.subViews = [compartment];
  view.operandCompartment = R(compartment._id);
  sd.ownedViews.push(view);
}

// Lifelines, left to right, centred on these x positions.
lifeline('client', 'client', clientActor, 90);
lifeline('page', '', depositPage, 310, 'boundary');
lifeline('ctl', '', depositController, 580, 'control');
lifeline('router', '', entityRef('Router'), 900, 'entity');
lifeline('rule', '', entityRef('RouterRule'), 1110, 'entity');
lifeline('tx', '', entityRef('Transaction'), 1330, 'entity');

let y = 120;
const at = (dy = 46) => (y += dy);
message('client', 'page', 'deposit(router_no, sender, message, amount)', y);
message('page', 'ctl', 'deposit(router_no, sender, message, amount)', at());
message('ctl', 'ctl', 'validate(deposit)  «INC-01»', at());
const altTop = at(60);
message('ctl', 'page', 'reason', at(64), 'reply');
message('page', 'client', 'show reason; nothing recorded', at());
const altSplit = at(36);
message('ctl', 'ctl', 'begin database transaction', at(36));
message('ctl', 'tx', 'create(deposit, to: router, sender, message, amount, actor)', at(52));
message('ctl', 'router', 'rules()', at());
message('router', 'ctl', 'rules in order of position, remainder account', at(), 'reply');
message('ctl', 'ctl', 'left := amount', at());
const loopTop = at(60);
message('ctl', 'rule', 'share(amount)', at(64));
message('rule', 'ctl', 'floor(amount × percentage / 100), or the fixed amount', at(), 'reply');
message('ctl', 'ctl', 'take := min(share, left)', at());
const optTop = at(60);
message('ctl', 'tx', 'create(transfer, to: target, take, actor, cause: deposit)', at(64));
message('ctl', 'ctl', 'left := left − take', at());
const optBottom = at(52);
const loopBottom = at(20);
const opt2Top = at(30);
message('ctl', 'tx', 'create(transfer, to: remainder, left, actor, cause: deposit)', at(64));
const opt2Bottom = at(36);
message('ctl', 'ctl', 'commit', at(30));
message('ctl', 'page', 'confirmation', at(52), 'reply');
message('page', 'client', 'show confirmation', at());
const altBottom = at(40);

// Every lifeline runs to just below the alt frame, which encloses the last message.
for (const { view, line } of lifelines.values()) {
  view.height = altBottom + 40 - LL_TOP;
  line.height = view.height - 40;
}

fragment('alt', 'alt', { left: 200, top: altTop, width: 1250, height: altBottom - altTop }, ['not allowed', 'allowed'], [altSplit]);
fragment('loop', 'loop', { left: 470, top: loopTop, width: 950, height: loopBottom - loopTop }, ['for each rule, in order of position']);
fragment('opt', 'opt', { left: 490, top: optTop, width: 910, height: optBottom - optTop }, ['take > 0']);
fragment('opt2', 'opt', { left: 470, top: opt2Top, width: 950, height: opt2Bottom - opt2Top }, ['left > 0']);

const seqNote = note(sd, 'atomic',
  'From "begin" to "commit", one database transaction: the deposit and all its transfers are recorded together or not at all (DR-05).\nEvery transfer records the depositing client as its actor and the deposit as its cause.',
  { left: 1480, top: altSplit + 40, width: 300, height: 120 });
noteLink(sd, 'atomic', seqNote, lifelines.get('tx').line);

/* ======================================================================
 * Domain class diagram: the ten entities of Table V
 * ====================================================================== */

const cd = diagram('UMLClassDiagram', 'domain', domainPkg, 'Class Diagram - Domain Model');
domainPkg.ownedElements.push(cd);

const enums = new Map();
function enumeration(name, literals, left, top, documentation) {
  const el = { _type: 'UMLEnumeration', _id: id('enum:' + name), _parent: R(domainPkg._id), name, documentation, literals: [] };
  for (const literal of literals)
    el.literals.push({ _type: 'UMLEnumerationLiteral', _id: id(`enum:${name}:${literal}`), _parent: R(el._id), name: literal });
  domainPkg.ownedElements.push(el);
  enums.set(name, el);
  node(cd, 'UMLEnumerationView', el, { left, top, width: Math.max(160, fit(name), ...literals.map(l => fit(l, false))), height: 50 + literals.length * 17 });
}

const PRIMITIVES = new Set(['String', 'Integer', 'Boolean', 'DateTime', 'Int64']);
const classes = new Map();
const CW = 250;
function entity(name, attributes, left, top, documentation) {
  const el = { _type: 'UMLClass', _id: id('class:' + name), _parent: R(domainPkg._id), name, documentation, attributes: [], ownedElements: [] };
  for (const [attr, type, extra = {}] of attributes) {
    el.attributes.push({
      _type: 'UMLAttribute', _id: id(`class:${name}:${attr}`), _parent: R(el._id), name: attr,
      type: PRIMITIVES.has(type) ? type : R(enums.get(type)._id), ...extra,
    });
  }
  domainPkg.ownedElements.push(el);
  // Header, one line per attribute, and the empty operations compartment.
  const height = 34 + attributes.length * 18 + 14;
  classes.set(name, { el, view: node(cd, 'UMLClassView', el, { left, top, width: CW, height }, { showVisibility: false }) });
}

// Enumerations first, since attributes refer to them. They fill the bottom rows.
const EY = 1120, EY2 = 1260;
enumeration('UserRole', ['client', 'administrator'], 40, EY, 'User.role');
enumeration('AccountType', ['spending', 'savings', 'owt'], 240, EY, 'Account.type');
enumeration('AccountState', ['open', 'closed'], 440, EY, 'Account.state (DR-04)');
enumeration('GroupTemplate', ['couple', 'club', 'church', 'custom'], 640, EY, 'Group.template (UC-04)');
enumeration('Visibility', ['members', 'private'], 840, EY, 'Group.visibility (DR-07)');
enumeration('MemberRole', ['owner', 'payer', 'contributor'], 1040, EY, 'Membership.role');
enumeration('MembershipState', ['invited', 'active'], 40, EY2, 'Membership.state (UC-06 A7)');
enumeration('RuleMode', ['percent', 'fixed'], 240, EY2, 'RouterRule.mode (DR-05)');
enumeration('TransactionType', ['deposit', 'transfer', 'payment'], 440, EY2, 'Transaction.type; a withdrawal is a payment to the acting user (UC-09 A1).');
enumeration('FlagState', ['open', 'under_review', 'resolved_confirmed', 'resolved_rejected'], 640, EY2, 'TransactionFlag.state; see the state diagram.');
enumeration('ConsentState', ['pending', 'granted', 'denied', 'revoked'], 860, EY2, 'Consent.state. Expired is not stored: a granted consent is expired when now >= expires_at.');

// Columns at x = 40, 440, 840, 1240; the user, who takes part in most associations, on the left.
const opt = { multiplicity: '0..1' };
entity('User', [
  ['user_id', 'Integer'], ['name', 'String'], ['email', 'String'], ['password_hash', 'String'],
  ['role', 'UserRole'], ['status', 'String'], ['blocked_until', 'DateTime', opt],
], 40, 380, 'A registered person (UC-01). blocked_until is set after five consecutive failed logins and compared with the current time on each attempt (UC-02).');
entity('LoginAttempt', [
  ['attempt_id', 'Integer'], ['success', 'Boolean'], ['timestamp', 'DateTime'],
], 40, 1000, 'Log of every login attempt (UC-02). An attempt with an unknown e-mail has no user.');
entity('Membership', [
  ['role', 'MemberRole'], ['state', 'MembershipState'], ['invited_at', 'DateTime'], ['joined_at', 'DateTime', opt],
], 440, 40, 'A user\'s place in a group: invited until accepted (UC-06 A7). Only active members see the group (DR-07).');
entity('Group', [
  ['group_id', 'Integer'], ['name', 'String'], ['template', 'GroupTemplate'], ['visibility', 'Visibility'],
], 840, 40, 'A couple, club, church or custom group (UC-04, UC-06).');
entity('Router', [['router_no', 'String']], 1240, 40,
  'A virtual account number that holds no money and splits every incoming amount by its rules (DR-05): a user\'s personal router or a group\'s group number, never both.');
entity('Account', [
  ['account_no', 'String'], ['type', 'AccountType'], ['name', 'String'], ['state', 'AccountState'],
  ['created_at', 'DateTime'], ['/balance', 'Int64'],
], 840, 380, 'A personal account (spending or savings) owned by a user, or an OWT account owned by a group: never both. The balance is derived from the transactions or stored with each one, as decided in design (G2).');
entity('RouterRule', [['position', 'Integer'], ['mode', 'RuleMode'], ['value', 'Int64']], 1240, 400,
  'value is a percentage (1 to 100) for a percent rule, or an amount in won for a fixed rule.');
entity('Transaction', [
  ['tx_id', 'Integer'], ['type', 'TransactionType'], ['amount', 'Int64'], ['counterparty', 'String', opt],
  ['message', 'String', opt], ['timestamp', 'DateTime'],
], 840, 740, 'One committed money movement, never changed or deleted (DR-04); amount in whole won (DR-03). counterparty: the payee of a payment or the sender of a deposit. message: the transfer message or payment reference.');
entity('TransactionFlag', [
  ['flag_id', 'Integer'], ['reason', 'String'], ['state', 'FlagState'], ['created_at', 'DateTime'],
  ['resolution_note', 'String', opt],
], 440, 740, 'A client\'s report of an unauthorised transaction (UC-11), handled by an administrator (UC-12).');
entity('Consent', [
  ['consent_id', 'Integer'], ['state', 'ConsentState'], ['requested_at', 'DateTime'], ['expires_at', 'DateTime', opt],
], 440, 940, 'Permission to see a client\'s personal details for one flag (UC-13); valid while granted and now < expires_at.');

let assocNo = 0;
/** An association from class `a` to class `b`, with a multiplicity and optionally a role name at each end. */
function association(a, aMult, b, bMult, { aRole, bRole, aggregation, via = [], shift = 0, lineStyle = OBLIQUE } = {}) {
  const A = classes.get(a), B = classes.get(b);
  const rid = id(`assoc:${++assocNo}:${a}:${b}`);
  const el = {
    _type: 'UMLAssociation', _id: rid, _parent: R(A.el._id),
    end1: { _type: 'UMLAssociationEnd', _id: id(rid + ':end1'), _parent: R(rid), reference: R(A.el._id), multiplicity: aMult, ...(aRole ? { name: aRole } : {}), ...(aggregation ? { aggregation } : {}) },
    end2: { _type: 'UMLAssociationEnd', _id: id(rid + ':end2'), _parent: R(rid), reference: R(B.el._id), multiplicity: bMult, ...(bRole ? { name: bRole } : {}) },
  };
  A.el.ownedElements.push(el);
  edge(cd, 'UMLAssociationView', el, A.view, B.view, { via, shift, lineStyle });
}

association('User', '1', 'Membership', '*');
association('Group', '1', 'Membership', '1..*');
association('User', '1', 'Group', '*', { aRole: 'owner', bRole: 'owned groups' });
association('User', '0..1', 'Router', '0..1', { aRole: 'owner', bRole: 'personal router', via: [[160, 15], [1290, 15]] });
association('Group', '0..1', 'Router', '0..1', { bRole: 'group number' });
association('User', '0..1', 'Account', '*', { aRole: 'owner' });
association('Group', '0..1', 'Account', '1..*');
association('Router', '1', 'RouterRule', '*', { bRole: 'rules {ordered}', aggregation: 'composite' });
association('RouterRule', '*', 'Account', '1', { bRole: 'target' });
association('Router', '*', 'Account', '1', { bRole: 'remainder' });
association('Transaction', '*', 'Account', '0..1', { bRole: 'from', via: [[915, 720], [915, 560]] });
association('Transaction', '*', 'Account', '0..1', { bRole: 'to', via: [[1015, 720], [1015, 560]] });
association('Transaction', '*', 'Router', '0..1', { bRole: 'to router', via: [[1530, 800], [1530, 85]] });
association('Transaction', '*', 'Transaction', '0..1', { aRole: 'caused', bRole: 'cause', via: [[1170, 800], [1170, 920], [1010, 920]] });
association('Transaction', '*', 'User', '1', { bRole: 'actor', via: [[740, 640], [300, 640]] });
association('TransactionFlag', '*', 'Transaction', '1');
association('TransactionFlag', '*', 'User', '1', { bRole: 'reporter' });
association('Consent', '*', 'TransactionFlag', '1');
association('Consent', '*', 'User', '1', { bRole: 'client', via: [[370, 960]] });
association('Consent', '*', 'User', '1', { bRole: 'administrator', via: [[330, 1060]] });
association('LoginAttempt', '*', 'User', '0..1');

const xorAccount = note(cd, 'xor-account', '{xor} An account is owned by a user (personal) or by a group (OWT), never both.',
  { left: 1580, top: 560, width: 260, height: 54 });
noteLink(cd, 'xor-account', xorAccount, classes.get('Account').view);
const xorRouter = note(cd, 'xor-router', '{xor} A router is a user\'s personal router or a group\'s group number, never both.',
  { left: 1580, top: 120, width: 260, height: 54 });
noteLink(cd, 'xor-router', xorRouter, classes.get('Router').view);

/* ---------- lines, integrity check, output ---------- */

for (const d of [ad, flag.d, consent.d, sd, cd]) layOutLines(d.ownedViews);

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
const diagramCount = [ad, flag.d, consent.d, sd, cd].filter(d => ids.has(d._id)).length;
if (diagramCount !== 5) throw new Error(`Only ${diagramCount} of 5 diagrams are in the project tree`);

const file = join(HERE, 'FBD_Analysis.mdj');
writeFileSync(file, JSON.stringify(project, null, '\t'));
console.log(`Wrote ${file}: ${diagramCount} diagrams, ${ids.size} IDs, ${refs.length} references (all resolved).`);
