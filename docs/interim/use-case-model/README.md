# Use Case Model (WBS 2.5)

Use case model of the FBD Bank system, based on the revised proposal ([FBD_Interim.md](../FBD_Interim.md), Section IV). It consists of the StarUML diagram and the use case descriptions below.

| File | Contents |
|------|----------|
| [`FBD_UseCases.mdj`](FBD_UseCases.mdj) | StarUML project: model and use case diagram. Open with *File → Open* in StarUML. |
| [`FBD_UseCases_model-only.mdj`](FBD_UseCases_model-only.mdj) | The same model without the diagram. Fallback if the full file does not open: create a use case diagram and drag the elements from the Model Explorer onto it. |
| [`build-mdj.mjs`](build-mdj.mjs) | Generates both files: `node docs/interim/use-case-model/build-mdj.mjs` (add `--no-views` for the model-only file). Once the diagram has been edited in StarUML, the `.mdj` is the source and should not be regenerated. |

**Status.** Draft for review. The `.mdj` is checked for unique IDs and resolved references. A first version was opened in StarUML; the second version, in this folder, fixes what that showed:
- squashed use cases with extension point compartments;
- lines stopping short of the ellipses;
- «include»/«extend» labels drifting from their lines.

Before it goes into the interim report, another team member reviews the model, and the diagram is exported from StarUML (*File → Export Diagram As → PNG/SVG*).

**Layout notes for editing in StarUML.**
- StarUML ends a line at a use case's bounding rectangle, not at the ellipse. A line that arrives at a shallow angle, roughly 5° to 20°, therefore stops a little short of the ellipse. Lines that arrive level or steeply touch it.
- The Client's use cases are arranged on an arc around the Client to keep these gaps small.
- The one remaining crossing, between UC-07/UC-08 and INC-01/INC-02, cannot be avoided: both use cases relate to both supporting use cases.

---

## 1. Diagram

**Actors.** Visitor, Client, Group owner, Member and Administrator, as defined in Table III of the revised proposal. Group owner and Member are specialisations of Client (generalisation), so they take part in every use case a Client does, and additionally in UC-06.

**System boundary.** One subject, *FBD Bank*, containing all use cases.

**Associations.**

| Actor | Use cases |
|-------|-----------|
| Visitor | UC-01 only. A visitor sees no group or account information. |
| Client | UC-02, UC-03, UC-04, UC-05, UC-07, UC-08, UC-09, UC-10, UC-11, UC-13 |
| Group owner | UC-06 (and, as a Client, all of the above) |
| Member | UC-06, to leave a group (and, as a Client, all of the above) |
| Administrator | UC-12, UC-13 |

**Include and extend relationships.** Three supporting use cases capture behaviour shared by several use cases. They have no functional requirement of their own, and are numbered INC-01 to INC-03 to keep them apart from the FR-mapped use cases. Extension points are named in the table below, in the descriptions in section 2, and in each use case's documentation in StarUML. They are not drawn as UML extension point compartments, which StarUML renders by squashing the ellipse.

| Relationship | Meaning |
|--------------|---------|
| UC-07, UC-08, UC-09 «include» INC-01 Validate Money Movement | Every money movement is checked by the same rules. |
| INC-02 Split Amount by Router «extend» UC-07, UC-08 | Extension point *Destination is a router*: an amount sent to a router or group number is split by its rules. |
| UC-10 «include» INC-03 Apply Contribution Visibility | Contributions are always filtered by the group's visibility. |
| UC-11 «extend» UC-10 | Extension point *Transaction selected*: a transaction can be flagged from the history. |
| UC-13 «extend» UC-12 | Extension point *Personal details needed*: the administrator requests consent during an investigation. |

### Mapping of functional requirements

Each functional requirement maps to exactly one use case of the same number and name. The requirements, with acceptance criteria, are in [FR_Specification.md](../FR_Specification.md).

| FR | Use case | FR | Use case |
|----|----------|----|----------|
| FR-01 | UC-01 Register User | FR-08 | UC-08 Deposit Funds |
| FR-02 | UC-02 Log In and Log Out | FR-09 | UC-09 Make Payment or Withdrawal |
| FR-03 | UC-03 Manage Personal Accounts | FR-10 | UC-10 View History and Contributions |
| FR-04 | UC-04 Set Up Group from Template | FR-11 | UC-11 Flag Unauthorised Transaction |
| FR-05 | UC-05 Manage Router | FR-12 | UC-12 Investigate Transactions |
| FR-06 | UC-06 Manage Group | FR-13 | UC-13 Manage Data-Access Consent |
| FR-07 | UC-07 Transfer Funds | — | INC-01 to INC-03 (part of FR-07 to FR-10 and DR-05 to DR-07) |

---

## 2. Use case descriptions

Rules referred to as DR-xx are the domain requirements, and *Table II* is the table of building blocks, both in Section IV of the revised proposal. Unless stated otherwise, every use case except UC-01 requires a logged-in session (UC-02), and every change is recorded with the acting user and a timestamp.

### UC-01 Register User

| | |
|---|---|
| **Primary actor** | Visitor |
| **Preconditions** | The visitor is not logged in. |
| **Postconditions** | A user exists with a unique e-mail and a salted password hash, and a session is established. On failure, nothing is stored. |

**Main flow**
1. The visitor chooses to create a user.
2. The visitor enters full name, e-mail address and password.
3. The system checks that the name is not empty, the e-mail address is valid and not already registered, and the password has at least eight characters including letters and digits.
4. The system stores the user with a salted hash of the password.
5. The system establishes a session and shows the empty accounts overview.

**Exception flows**
- **E1 Invalid input** (step 3): the system names the first failed check and keeps the entered name and e-mail. Nothing is stored.
- **E2 E-mail already registered** (step 3): the system reports that a user with this e-mail exists.

### UC-02 Log In and Log Out

| | |
|---|---|
| **Primary actor** | Client |
| **Preconditions** | The client is registered. |
| **Postconditions** | Every attempt is recorded. After a successful log-in a session exists; after log-out or expiry it does not. |

**Main flow (log in)**
1. The client enters e-mail address and password.
2. The system reads the user's `blocked_until` timestamp and compares it with the current time. The user is not blocked.
3. The system verifies the password against the stored hash.
4. The system records a successful attempt, resets the count of consecutive failures, and establishes a session.

**Alternative flows**
- **A1 Log out:** the client chooses *Log out*; the system ends the session.
- **A2 Idle session:** on every request, the system compares the current time with the time of the session's last request. If more than 30 minutes have passed, the session is ended and the client is asked to log in again. No scheduled job is used.

**Exception flows**
- **E1 Wrong password** (step 3): the system records a failed attempt and shows a message that does not reveal whether the e-mail is registered. If this is the fifth consecutive failure, the system sets `blocked_until` to the current time plus 24 hours and shows on the login screen that login is blocked. No e-mail is sent.
- **E2 Blocked** (step 2): the current time is before `blocked_until`. The system records the attempt, rejects it without checking the password, and shows when login will be possible again. The block ends by itself when the time has passed; no scheduled job lifts it.
- **E3 Unknown e-mail** (step 3): handled like E1, without a user to block.

### UC-03 Manage Personal Accounts

| | |
|---|---|
| **Primary actor** | Client |
| **Preconditions** | The client is logged in. |
| **Postconditions** | The account exists with a unique number, or its name or state has changed. |

**Main flow (open an account)**
1. The client chooses to open an account and selects *spending* or *savings*.
2. The client enters a name.
3. The system creates the account with a unique account number and a zero balance, owned by the client.
4. The system shows the new account.

**Alternative flows**
- **A1 View accounts:** the system lists the client's open personal accounts with their balances.
- **A2 Rename:** the client enters a new name; the system saves it.
- **A3 Close:** the client chooses to close an account. The system checks that the balance is zero, that no router rule or remainder points to it, and that it has no open dispute flag, then marks the account closed (DR-04).

**Exception flows**
- **E1 Close not allowed** (A3): the system names the condition that is not met and leaves the account open.

### UC-04 Set Up Group from Template

| | |
|---|---|
| **Primary actor** | Client (becomes the group owner) |
| **Preconditions** | The client is logged in. |
| **Postconditions** | A group exists with the client as owner, one or more OWT accounts, the chosen visibility, and the template's router and rules; for Couple, an invitation to the partner is pending. The whole setup is saved as one operation or not at all. |

**Main flow**
1. The client chooses to set up a group.
2. The system shows the templates Couple, Club, Church and Custom.
3. The client selects a template.
4. The system proposes a name, a visibility (Couple: *members*; Club: *members*; Church: *private*; Custom: *members*), and the template's settings:
   - **Couple:** a partner, and the share of every income that the client's router sends to the shared account (default 30 %).
   - **Club:** budgets with percentages (default Marketing 20 %, Materials 30 %, Joint exercises 50 %).
   - **Church, Custom:** no further settings.
5. The client adjusts the proposal and confirms.
6. The system validates the settings.
7. The system creates the group with the client as owner, and:
   - **Couple:** one OWT account; an invitation to the partner as payer, which the partner accepts or declines (UC-06, A7); a percentage rule at the top of the client's router, sending the chosen share to the account.
   - **Club:** one OWT account per budget, and a group router with a percentage rule for each budget except the last, which receives the remainder.
   - **Church, Custom:** one OWT account.
8. The system shows the new group.

**Alternative flows**
- **A1 No router yet** (Couple, step 7): the system creates a personal router for the client with the client's spending account as remainder, then adds the rule.

**Exception flows**
- **E1 Budgets invalid** (Club, step 6): a budget has no name, or the percentages do not add up to exactly 100 %. The system explains which, and nothing is created.
- **E2 Share invalid** (Couple, step 6): the share is not between 1 and 100 %.
- **E3 No spending account** (Couple, A1): the group is created without a router rule, and the client is told to open a spending account and add the rule in UC-05.

### UC-05 Manage Router

| | |
|---|---|
| **Primary actor** | Client (personal router), Group owner (group router) |
| **Preconditions** | The client is logged in. For a group router, the client owns the group. |
| **Postconditions** | The router's rules and remainder account are saved and apply to the next amount it receives. |

**Main flow**
1. The client opens the personal router, or the group number from the group's settings.
2. If none exists, the client creates it: a personal router gets the client's spending account as remainder; a group router gets one of the group's OWT accounts.
3. The system shows the router number, the ordered rules, the remainder account, a split preview, and the most recent amounts received with the transfers each caused.
4. The client adds, edits or removes rules. A rule has a target account, a mode (percentage or fixed amount) and a value. Permitted targets: for a personal router, the client's personal accounts and the OWT accounts of groups the client is a member of; for a group router, only that group's OWT accounts.
5. The client chooses the remainder account: for a personal router, one of the client's personal accounts; for a group router, one of the group's OWT accounts.
6. The system updates the preview for a sample amount, using the algorithm of DR-05.
7. The client saves; the system stores the rules.

**Alternative flows**
- **A1 Read-only:** a member who is not the owner opens the group number; the system shows the rules and preview without editing controls.
- **A2 Discard:** the client discards the changes; the saved rules are shown again.
- **A3 Inactive rule:** a rule whose target is closed, or belongs to a group the client is no longer an active member of, is shown as inactive. It takes nothing (DR-05); the client may delete it.

**Exception flows**
- **E1 Incomplete rule** (step 7): a rule has no target or a value of zero. The system rejects the save and names the problem.
- **E2 Percentages over 100 %** (step 7): the system saves the rules and warns that later rules may receive nothing.

### UC-06 Manage Group

| | |
|---|---|
| **Primary actor** | Group owner |
| **Secondary actor** | Member (an invited client accepting or declining, or a member leaving) |
| **Preconditions** | The actor is logged in and is the owner of the group; for A6, a member; for A7, an invited client. |
| **Postconditions** | The group's settings, members, invitations or accounts have changed, and the change is recorded. |

**Main flow (invite a member)**
1. The owner opens the group's members and settings.
2. The system shows the visibility, the members with their roles, the group's accounts with balances, and the group number.
3. The owner selects a registered user who is not yet a member or invited, and a role (payer or contributor).
4. The system records an invitation in state *invited* and shows it to the user, with the group's name, the role and the group's contribution visibility. The user does not see the group's balance or activity yet.
5. The invited user accepts (A7); the system makes the user a member with the chosen role and records the change.

**Alternative flows**
- **A1 Change visibility:** the owner selects *members* or *private*; the system applies it immediately (DR-07).
- **A2 Change role:** the owner changes a member between payer and contributor.
- **A3 Remove member:** the owner removes a member. Past contributions remain in the history. Rules in the member's router that target the group's accounts become inactive (DR-05).
- **A4 Add or rename account:** the owner enters a name; the system creates a new OWT account in the group, or renames an existing one and keeps its number and history.
- **A5 Close account:** the owner closes an account. The system checks that the group keeps at least one account, the balance is zero, and no rule or remainder of the group's own router points to it. Rules in members' personal routers that point to it become inactive (DR-05).
- **A6 Leave group:** a member who is not the owner leaves the group. Rules in the member's router that target the group's accounts become inactive (DR-05).
- **A7 Answer an invitation:** the invited client sees the group's name, the role and the contribution visibility, and accepts or declines. On accepting, the membership becomes *active*; on declining, the invitation is removed and the owner sees that it was declined.
- **A8 Withdraw an invitation:** the owner withdraws a pending invitation.

**Exception flows**
- **E1 Close not allowed** (A5): the system names the condition that is not met.
- **E2 Owner cannot leave or be removed:** the owner role is fixed; transferring ownership is outside the scope of this version.

### UC-07 Transfer Funds

| | |
|---|---|
| **Primary actor** | Client (including Group owner and Member) |
| **Preconditions** | The client is logged in and owns at least one open personal account. |
| **Postconditions** | One transfer is recorded with source, destination, amount, message and acting user, and both balances have changed by the amount (DR-02). If the destination is a router, its splits are recorded too. On failure, nothing is recorded. |

**Main flow**
1. The client selects a source account among their own open personal accounts.
2. The client selects a destination: one of their own accounts, their own router, an OWT account or group number of a group they are a member of, or another account by its number.
3. The client enters an amount and, optionally, a message.
4. The system validates the transfer (**include INC-01**).
5. The system debits the source and credits the destination in one atomic transaction and records the acting user.
6. **Extension point *Destination is a router*:** INC-02 splits the amount.
7. The system confirms the transfer and shows the destination (for a group: the group page).

**Alternative flows**
- **A1 By account number** (step 2): the client enters an account number; the system looks up the open account or router with that number.

**Exception flows**
- **E1 Number not found** (A1): no open account or router has the number.
- **E2 Not allowed** (step 4): INC-01 returns a reason, which the system shows. Nothing is recorded.

### UC-08 Deposit Funds

| | |
|---|---|
| **Primary actor** | Client |
| **Preconditions** | The client is logged in and owns a spending account or a router. |
| **Postconditions** | One deposit is recorded with the sender's name and the acting user; if the target is a router, its splits are recorded in the same transaction. |

**Main flow**
1. The client selects the target: an own spending account or the own router.
2. The client enters the sender's name (for example an employer), a message and an amount.
3. The system validates the deposit (**include INC-01**), including the per-operation limit.
4. The system records the deposit and credits the target.
5. **Extension point *Destination is a router*:** INC-02 splits the amount.
6. The system confirms the deposit.

**Exception flows**
- **E1 Not allowed** (step 3): for example a savings or group account as target, or an amount above the limit. The system shows the reason; nothing is recorded.

### UC-09 Make Payment or Withdrawal

| | |
|---|---|
| **Primary actor** | Client; Group owner or Member with the payer role, for group accounts |
| **Preconditions** | The actor is logged in. |
| **Postconditions** | One payment is recorded on the sender's side with payee, reference, amount and acting user, and the source balance has decreased. On failure, nothing is recorded. |

**Main flow**
1. The actor selects the source: an own spending account, or an OWT account of a group in which the actor is owner or payer.
2. The actor enters the payee's name, an optional reference and the amount.
3. The system validates the payment (**include INC-01**).
4. The system records the payment and debits the source.
5. The system confirms the payment and shows the source account or group.

**Alternative flows**
- **A1 Withdrawal** (step 2): the actor chooses *withdrawal*; the payee is the acting user and the reference is *cash withdrawal*.

**Exception flows**
- **E1 Not allowed** (step 3): for example a savings account, a contributor without the payer role, or a group account that would go below zero. The system shows the reason; nothing is recorded.
- **E2 Missing payee** (step 3): no payee entered.

### UC-10 View History and Contributions

| | |
|---|---|
| **Primary actor** | Client, Member |
| **Preconditions** | The actor owns the personal account, or is an active member of the group that holds it. |
| **Postconditions** | None; nothing changes. |

**Main flow**
1. The actor opens a personal account or a group.
2. The system lists its transactions, newest first. Each entry shows the date, the amount, the counterparty and the acting user. A transfer caused by a router shows the amount that caused it.
3. The actor filters by period, type (all, money in, payments) or counterparty.
4. For a group, the system shows the contributions per member as a graph and a table ranked by total (equal totals: earliest contribution first), and applies the group's visibility (**include INC-03**) to both and to the transaction list.
5. **Extension point *Transaction selected*:** the actor selects a transaction (UC-11 may extend here).

**Alternative flows**
- **A1 One account of a group:** the actor selects one of the group's accounts; the list shows only that account's transactions, including the splits it received from the group number.

**Exception flows**
- **E1 No access** (precondition): the actor is not the owner or an active member, for example a user whose invitation is still pending. The system shows that the page does not exist or is not accessible, without revealing whether the account or group exists.

### UC-11 Flag Unauthorised Transaction

| | |
|---|---|
| **Primary actor** | Client (including Group owner) |
| **Preconditions** | The transaction belongs to a personal account of the client, or to an OWT account of a group the client owns. The transaction has no open flag. |
| **Postconditions** | A flag exists in state *Open*, with reporter, reason and time. While it is open, the account cannot be closed. |

**Main flow**
1. In the history (UC-10), the client selects a transaction and chooses *Flag as unauthorised*.
2. The client states a reason.
3. The system creates the flag in state *Open* and confirms.
4. The client follows the flag's state: *Open*, *Under Review*, *Resolved (confirmed)* or *Resolved (rejected)*, with the administrator's note.

**Exception flows**
- **E1 Already flagged** (precondition): the system shows the existing flag instead.
- **E2 Not the owner:** the option is not offered.

### UC-12 Investigate Transactions

| | |
|---|---|
| **Primary actor** | Administrator |
| **Preconditions** | The administrator is logged in with the administrator role. |
| **Postconditions** | Flag states and notes are updated and recorded. |

**Main flow**
1. The administrator searches transactions by time range or by user.
2. The system lists matching transactions. Personal details of clients (name, e-mail) are masked.
3. The administrator opens the list of open flags and selects one.
4. The administrator sets the flag to *Under Review* and adds a note.
5. **Extension point *Personal details needed*:** UC-13 may extend here.
6. The administrator resolves the flag as *confirmed* or *rejected*, with a note.

**Exception flows**
- **E1 No results** (step 2): the system shows an empty result.

### UC-13 Manage Data-Access Consent

| | |
|---|---|
| **Primary actor** | Administrator (request), Client (decision) |
| **Preconditions** | A flag exists; the client is its reporter or the acting user of the flagged transaction, and the administrator needs that client's details. |
| **Postconditions** | A consent record exists with state and expiry. Every access to personal details is logged. |

**Main flow**
1. During an investigation (UC-12), the administrator requests consent to see the personal details of one client involved in a flag: its reporter or the acting user of the flagged transaction.
2. The system records the request as *Pending* and shows it to that client only.
3. The client grants the request.
4. The system sets the state to *Granted* and `expires_at` to the current time plus 72 hours.
5. When the administrator opens the personal details, the system checks that the consent is granted and compares the current time with `expires_at`. The consent is valid, so the system shows the details and logs the access.

**Alternative flows**
- **A1 Deny** (step 3): the client denies; the state becomes *Denied* and the details stay masked.
- **A2 Revoke:** the client revokes a granted consent at any time; the state becomes *Revoked* with immediate effect.

**Exception flows**
- **E1 Expired** (step 5): the current time is at or after `expires_at`. The details stay masked; the administrator may request consent again. No scheduled job is used to expire consents.
- **E2 Not granted** (step 5): the consent is pending, denied or revoked; the details stay masked.

---

## 3. Supporting use cases

### INC-01 Validate Money Movement

Included by UC-07, UC-08 and UC-09. Returns either *allowed* or the first reason the movement is not allowed:

1. The amount is a whole number of won above zero; for a deposit, at most the per-operation limit.
2. The source and destination are open (DR-04).
3. The flow is allowed by Table II and the actor's rights:
   - **Transfer:** the source is the actor's own personal account. The destination is any spending account; the actor's own savings account or router; or an OWT account or group number of a group the actor is a member of. Savings may only go to the actor's own accounts.
   - **Deposit:** the target is the actor's own spending account or router.
   - **Payment:** the source is the actor's own spending account, or an OWT account of a group in which the actor is owner or payer. Savings accounts cannot pay.
4. A payment from an OWT account does not take its balance below zero (DR-06). Personal accounts may go below zero (DR-01).

### INC-02 Split Amount by Router

Extends UC-07 and UC-08 at *Destination is a router*. Applies DR-05:

1. The rules are applied in order. A percentage rule takes that percentage of the received amount, rounded down to whole won; a fixed rule takes its amount. Each rule takes at most what is left.
2. Whatever remains goes to the remainder account.
3. Each resulting transfer records the actor of the incoming amount as its actor and the incoming transaction as its cause.
4. The incoming amount and all resulting transfers are committed together or not at all. The router's balance is zero afterwards.

### INC-03 Apply Contribution Visibility

Included by UC-10. Applies DR-07 for the viewing user:

- **Members:** all members' contributions are shown with names.
- **Private,** for the owner and payers: all contributions with names.
- **Private,** for contributors: their own contributions with their name, and the group's total. Other members' contributions are shown without a name, as "a member", with amount and date, and in the contributions graph and table only as one total for all other members.
- Balances and payments are shown to all members in every case.

---

## 4. Decisions recorded

The following questions from the first draft were decided by the team on October 14, 2026, and are reflected in the revised proposal and in the descriptions above.

| Question | Decision | Affects |
|----------|----------|---------|
| Must an invited user accept before joining a group? | Yes. Invitations are pending until accepted; the invitation shows the group's visibility. | UC-04, UC-06 (A7, A8), NFR-09, Membership entity (state) |
| In a private group, do contributors see other members' gifts? | Yes, with amount and date but without a name, as "a member". | DR-07, INC-03 |
| Idle session limit | 30 minutes without a request. | UC-02 (A2) |
| Order of tied contributors in the contributions ranking | Earliest contribution first. | UC-10, DR-07 |
| Who can see a group's details? | Only active members. Visitors can only register; there is no public page, and the *public* visibility level is removed (levels: *members*, *private*). | UC-01, UC-10, DR-07, Club template |
