# Analysis Model (WBS 3.1 to 3.3, first versions)

Supplementary diagrams for the interim report, next to the [use case model](../use-case-model/README.md). They make the rules that are easiest to misread exact before any code is written: router splitting (DR-05) and the life cycles of a dispute flag and a consent. A sequence diagram and a domain class diagram complete them.

| File | Contents |
|------|----------|
| [`FBD_Analysis.mdj`](FBD_Analysis.mdj) | StarUML project with the five diagrams below. Open with *File → Open* in StarUML. |
| [`build-mdj.mjs`](build-mdj.mjs) | Generates the `.mdj`: `node docs/interim/analysis-model/build-mdj.mjs`. Once a diagram has been edited in StarUML, the `.mdj` is the source and should not be regenerated. |

**Status.** Draft for review. The generator checks that every ID is unique and every reference resolves, and all five diagrams were opened and exported with the StarUML 7.1.1 command line to check the layout.

**Exporting for the report.** In StarUML, *File → Export Diagram As → PNG/SVG*, one diagram at a time; or for all of them:

```
StarUML.exe image docs/interim/analysis-model/FBD_Analysis.mdj -s @UMLDiagram -f png -o "out/<%=filenamify(element.name)%>.png"
```

Export from a registered copy of StarUML: an unregistered copy prints "UNREGISTERED" across every exported image. When running the command from a VS Code terminal, unset `ELECTRON_RUN_AS_NODE` first, or StarUML starts as plain Node and fails.

---

## Diagrams

### 1. Activity diagram: Router Split (DR-05, INC-02)

The algorithm of DR-05 for an amount *A* arriving at a router, from a transfer (UC-07) or a deposit (UC-08):

1. One database transaction begins and *A* is recorded.
2. The rules are taken in order of position. A percentage rule's share is `floor(A × percentage / 100)`; a fixed rule's share is its amount. The percentage is of *A*, not of what is left.
3. Each rule takes `min(share, left)`, so it takes at most what is left.
4. When no rules are left, whatever remains goes to the remainder account.
5. *A* and every transfer are committed together. If any step fails, nothing is recorded.

Notes on the diagram repeat that each transfer records the actor of *A* as its actor and *A*'s transaction as its cause, and that amounts are whole won.

### 2. State diagram: TransactionFlag (UC-11, UC-12)

`Open → Under Review → Resolved (confirmed)` or `Resolved (rejected)`.

- `flag(reason)` creates the flag in *Open*. Only the client who owns the account, or the owner of the group that holds it, can flag, and only if the transaction has no open flag.
- `startReview(note)` and `resolve(confirmed | rejected, note)` are the administrator's (UC-12 steps 4 and 6). A flag cannot be resolved without first being under review, as in UC-12.
- Resolved flags are kept; there is no final state, because the flag remains on record.

### 3. State diagram: Consent (UC-13)

`Pending → Granted` or `Denied`; `Granted → Revoked` or `Expired`.

- `grant` sets `expires_at := now + 72 h`.
- *Expired* is entered by the change event `when (now >= expires_at)`. It is not a stored state: whether a granted consent has expired is decided by comparing the current time with `expires_at` each time the administrator opens the details, with no scheduled job (UC-13 E1). Correspondingly, the `ConsentState` enumeration in the class diagram has no *expired* literal.
- After *Denied*, *Revoked* or *Expired*, the administrator may request consent again, which creates a new consent in *Pending*.

### 4. Sequence diagram: Deposit to a Router (UC-08 with INC-01 and INC-02)

Analysis objects: the Client, `«boundary» DepositPage`, `«control» DepositController`, and the entities `Router`, `RouterRule` and `Transaction`.

- The controller validates the deposit (INC-01).
- `alt [not allowed]`: the reason is shown and nothing is recorded.
- `alt [allowed]`: the controller begins a database transaction, creates the deposit to the router, reads the rules, and then:
  - `loop [for each rule, in order of position]`: asks the rule for its share and computes `take := min(share, left)`.
  - `opt [take > 0]`: creates a transfer to the rule's target and reduces `left`.
  - `opt [left > 0]`: after the loop, creates a transfer of `left` to the remainder account.
  - Commits, and the confirmation is shown.
- A note states that everything from *begin* to *commit* is one database transaction, and that every transfer records the depositing client as actor and the deposit as cause.

### 5. Class diagram: Domain Model (Table V)

The entities of Table V with their attributes, eleven enumerations for the types and states, and the associations between them with multiplicities.

- Foreign keys in Table V (`owner_id`, `group_id`, `tx_id`, `reporter_id`, …) are drawn as associations instead of attributes.
- Two `{xor}` notes record that an account is owned by a user *or* a group, and a router is a user's personal router *or* a group's group number, never both.
- `Router` is composed of its `RouterRule`s, ordered by position.
- `Transaction` has a self-association from each transfer to the transaction that caused it (DR-05).
- `blocked_until` is an attribute of `User`, not of `LoginAttempt`; Table V in the interim report has been changed to match (see below).
- `AuditEvent` keeps its references as identifiers instead of associations: an event can refer to any entity, and the log outlives what it describes (DR-04).
- `AuditEvent` and the removal of `User.status` are in `FBD_Analysis.mdj`; the image in `exports/svg` shows them after the next export from StarUML.

---

## Decisions to review

These follow from the use case descriptions and the domain rules, but are not stated there word for word.

| Decision | Where | Reason |
|----------|-------|--------|
| A rule whose `take` is 0 records no transfer. | Activity, sequence | INC-01 requires every amount to be above zero. With nothing left, later rules receive nothing (DR-05). |
| *Expired* is derived from `expires_at`, not stored. | Consent states, `ConsentState` | UC-13 E1: expiry is checked by timestamp, with no scheduled job. |
| `blocked_until` belongs to `User`. | Class diagram, Table V | UC-02 reads "the user's `blocked_until`"; the login attempts are only the log. Table V and the list of changes in the interim report now say the same. |
| Attributes added beyond Table V: `Transaction.counterparty` and `message`, `TransactionFlag.created_at`, `Consent.requested_at`, `Account./balance` (derived). | Class diagram | UC-07 to UC-09 record a message, a payee or a sender; UC-11 records the time of flagging; UC-13 records the request. The balance is shown as derived until design decides how it is stored (G2). Table V now lists them, except the derived balance. |
| `User.status` is removed. | Class diagram, Table V | It held the login block in the proposal; the block is now `blocked_until` (UC-02), and no use case reads or changes a status. The class diagram still shows it until its next export. |
| `AuditEvent` keeps its references as identifiers. | Class diagram, Table V | An event can refer to any entity, and the log outlives what it describes (DR-04). |
| A withdrawal is a payment, not a transaction type of its own. | `TransactionType` | UC-09 A1: a withdrawal is a payment to the acting user. |
