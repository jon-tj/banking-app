# Functional Requirement Specification

FBD Bank, interim baseline, October 14, 2026.

This document specifies the functional requirements FR-01 to FR-13 of the system described in the revised proposal ([FBD_Interim.md](FBD_Interim.md)). Each requirement corresponds to exactly one use case with the same number and name; the use cases are described step by step in the [use case model](use-case-model/README.md). Non-functional requirements (NFR-01 to NFR-10) and domain requirements (DR-01 to DR-07) are specified in Section IV of the revised proposal and are referred to here, not repeated.

**Status:** draft for team review.

---

## 1. Conventions

- **"The system shall"** marks a binding requirement.
- **Priority.**
  - **Must:** required for the core system, implemented in Sprint 3.
  - **Should:** planned for Sprint 4. Dropped only if time runs out, which would be recorded as a deviation from G1.
- **Acceptance criteria** are numbered AC-xx.n, where xx is the FR number. Each criterion is written so that it can be checked by a test or a demonstration, and becomes at least one test case in the requirements traceability matrix (G3).
- **Example amounts** in the criteria are in Korean won and use the demo's example users where helpful: Minji, Joon, Hana (Seoul Trail Club treasurer), Ji-ho (club contributor), Choi (Grace Church treasurer).
- **Table II** refers to the table of building blocks in Section IV-A of the revised proposal. It defines which account types money can come in to and go out of.

## 2. Common rules

These rules apply to every functional requirement and are not repeated in each one.

| ID | Rule |
|----|------|
| CR-01 | Every function except FR-01 and logging in (FR-02) requires a valid session. A visitor can only register. |
| CR-02 | Every request is authorised on the server, regardless of what the user interface shows or hides (NFR-03). A request the actor is not allowed to make is rejected and changes nothing. |
| CR-03 | Every change of data is recorded with the acting user and a timestamp. |
| CR-04 | An operation that fails validation, or fails part-way, changes nothing: no transaction, balance, membership or setting is partly saved (DR-02). |
| CR-05 | Money amounts are whole won, stored as signed 64-bit integers (DR-03). An amount must be greater than zero. |
| CR-06 | Rules that depend on time (login blocks, session expiry, consent expiry) are evaluated by comparing stored timestamps with the current time when a request arrives. No scheduled job is used. |

## 3. Overview and traceability

| FR | Name | Use case | Priority | Problems | Domain rules | Demo screens |
|----|------|----------|----------|----------|--------------|--------------|
| FR-01 | Register User | UC-01 | Must | — | — | 02 |
| FR-02 | Log In and Log Out | UC-02 | Must | P8 | — | 01 (placeholder) |
| FR-03 | Manage Personal Accounts | UC-03 | Must | — | DR-04 | 03, 04, 16 |
| FR-04 | Set Up Group from Template | UC-04 | Must | P2, P5 | DR-05, DR-07 | 13, 14 |
| FR-05 | Manage Router | UC-05 | Must | P1, P2 | DR-05 | 05, 12 |
| FR-06 | Manage Group | UC-06 | Must | P3 | DR-07 | 11, 23 |
| FR-07 | Transfer Funds | UC-07 | Must | P4 | DR-01 to DR-06 | 17, 18 |
| FR-08 | Deposit Funds | UC-08 | Must | P1 | DR-02 to DR-05 | 21 |
| FR-09 | Make Payment or Withdrawal | UC-09 | Must | P4 | DR-01 to DR-04, DR-06 | 19, 20 |
| FR-10 | View History and Contributions | UC-10 | Must | P3, P4 | DR-05, DR-07 | 04, 06–10 |
| FR-11 | Flag Unauthorised Transaction | UC-11 | Should | P6 | DR-04 | — |
| FR-12 | Investigate Transactions | UC-12 | Should | P6, P7 | — | — |
| FR-13 | Manage Data-Access Consent | UC-13 | Should | P7 | — | — |

Each FR maps to exactly one use case and each use case UC-01 to UC-13 to exactly one FR. The supporting use cases INC-01 to INC-03 have no FR of their own: INC-01 is specified in FR-07, FR-08 and FR-09; INC-02 in FR-05, FR-07 and FR-08; INC-03 in FR-10. Demo screen numbers refer to the [UI review](../ui-review/README.md).

---

## 4. Requirements

### FR-01 Register User

| | |
|---|---|
| **Use case** | UC-01 · **Priority** Must |
| **Actor** | Visitor |
| **Requirement** | The system shall let a visitor create a user by providing a full name, an e-mail address and a password. It shall accept the e-mail address only if no user has it already, ignoring upper and lower case. It shall accept the password only if it has at least eight characters, including at least one letter and one digit. It shall store the password only as a salted hash. |
| **Inputs** | Full name, e-mail address, password |
| **Outputs** | New user and an established session; or an error message naming the failed check |
| **Business rules** | NFR-03 (salted hashes), CR-04 |

**Acceptance criteria**
- **AC-01.1** Registering "Test User", "test@example.com", "abcd1234" creates a user and logs them in.
- **AC-01.2** Registering with "Minji@Example.COM" when "minji@example.com" exists is rejected; no user is created.
- **AC-01.3** The passwords "abc123" (too short), "abcdefgh" (no digit) and "12345678" (no letter) are each rejected.
- **AC-01.4** An empty name, or an e-mail address without a domain such as "test@", is rejected.
- **AC-01.5** The stored user record contains no plain-text password, and two users registered with the same password have different stored hashes.

### FR-02 Log In and Log Out

| | |
|---|---|
| **Use case** | UC-02 · **Priority** Must |
| **Actor** | Client |
| **Requirement** | The system shall authenticate a client by e-mail address and password and record every login attempt. After five consecutive failed attempts, it shall alert the user and block login for 24 hours by storing a `blocked_until` timestamp. It shall end a session when the client logs out, or when more than 30 minutes have passed since the session's previous request. |
| **Inputs** | E-mail address, password; log-out request; any request carrying a session |
| **Outputs** | Session; error message; block message stating when login reopens; login attempt records |
| **Business rules** | NFR-03, CR-06 |

**Acceptance criteria**
- **AC-02.1** Correct credentials establish a session, and a successful attempt is recorded.
- **AC-02.2** A wrong password and an unknown e-mail address produce the same message, so the message does not reveal whether the e-mail is registered. A failed attempt is recorded.
- **AC-02.3** After the fifth consecutive failed attempt, `blocked_until` equals the time of that attempt plus 24 hours, and the user is alerted.
- **AC-02.4** While the current time is before `blocked_until`, even the correct password is rejected. The attempt is recorded, and the message states when login is possible again.
- **AC-02.5** With `blocked_until` in the past, the correct password succeeds, with no background job having run.
- **AC-02.6** A successful login resets the count: four failures, one success and four more failures do not cause a block.
- **AC-02.7** A request 29 minutes after the previous one is accepted. A request more than 30 minutes after the previous one is rejected and asks the client to log in again.
- **AC-02.8** After log-out, the old session no longer authorises any request.

### FR-03 Manage Personal Accounts

| | |
|---|---|
| **Use case** | UC-03 · **Priority** Must |
| **Actor** | Client |
| **Requirement** | The system shall let a client open spending and savings accounts, each with a unique account number and a zero balance. It shall list the client's open personal accounts with their balances, and let the client rename them. It shall let the client close an account only if all three hold: its balance is zero, no router rule or remainder points to it, and it has no open dispute flag. |
| **Inputs** | Account type, name; new name; close request |
| **Outputs** | Account with number and balance; list of accounts; error naming the unmet condition |
| **Business rules** | Table II, DR-04 |

**Acceptance criteria**
- **AC-03.1** A new account has an account number that no other account or router has, and a balance of ₩0.
- **AC-03.2** The list shows only the client's own open personal accounts. Each balance equals the sum of the account's transactions.
- **AC-03.3** Renaming changes the name and leaves the account number and history unchanged.
- **AC-03.4** Closing is rejected, with the reason shown, for an account with a balance other than ₩0, for an account that a router rule or remainder points to, and for an account with an open flag.
- **AC-03.5** A closed account keeps its history. Transfers to and from it are rejected.

### FR-04 Set Up Group from Template

| | |
|---|---|
| **Use case** | UC-04 · **Priority** Must |
| **Actor** | Client (becomes the group owner) |
| **Requirement** | The system shall let a client create a group from one of the templates Couple, Club, Church or Custom. In one operation, it shall create the group with the client as owner, its OWT account or accounts, the chosen contribution visibility, and the template's router, rules and invitations. A template shall only create ordinary groups, accounts, routers, rules and invitations, and shall add no behaviour of its own. |
| **Inputs** | Template; group name; visibility; Couple: partner and share in percent; Club: budget names and percentages |
| **Outputs** | New group, shown to the owner; or an error naming the invalid setting |
| **Business rules** | DR-05, DR-07, CR-04 |

**Acceptance criteria**
- **AC-04.1** **Couple**, with partner Joon and a share of 30 %, creates:
  - one OWT account;
  - a pending invitation to Joon as payer;
  - visibility *members*;
  - a rule "30 % → the new account" at the top of the client's router.
- **AC-04.2** Couple for a client without a router also creates a router whose remainder is the client's spending account. If the client has no spending account, the group is still created, without a rule, and the client is told so.
- **AC-04.3** **Club** with budgets Marketing 20 %, Materials 30 % and Joint exercises 50 % creates:
  - three OWT accounts;
  - a group router with the rules 20 % → Marketing and 30 % → Materials, and Joint exercises as remainder;
  - visibility *members*.
- **AC-04.4** Club budgets adding up to 90 % or 110 %, or a budget without a name, are rejected and nothing is created.
- **AC-04.5** **Church** creates one OWT account with visibility *private*. **Custom** creates one OWT account with the visibility the client chose.
- **AC-04.6** Changing a proposed value before confirming (for example, setting a Club's visibility to *private*) is reflected in the created group.
- **AC-04.7** After creation, every part of the group can be changed with FR-05 and FR-06. A group's template has no effect on any later behaviour.

### FR-05 Manage Router

| | |
|---|---|
| **Use case** | UC-05 · **Priority** Must |
| **Actor** | Client (personal router); Group owner (group router) |
| **Requirement** | The system shall let a client create and edit one personal router, and a group owner one router for the group. A router has a unique number, an ordered list of rules and a remainder account; each rule sends a percentage of the received amount, or a fixed amount, to a target account. Rules in a personal router shall target only the client's personal accounts and OWT accounts of groups the client is an active member of. Rules in a group router shall target only that group's OWT accounts. The system shall preview how a given amount would be split, and apply saved changes from the next amount the router receives. |
| **Inputs** | Rules (target, mode, value), order, remainder account; preview amount |
| **Outputs** | Saved router; split preview; list of recently received amounts with the transfers each caused |
| **Business rules** | DR-05, Table II |

**Acceptance criteria**
- **AC-05.1** With the rules 30 % → Our home and ₩200,000 → Rainy day, and remainder Everyday, the preview for ₩3,400,000 shows:
  - Our home ₩1,020,000;
  - Rainy day ₩200,000;
  - Everyday ₩2,180,000.
- **AC-05.2** The preview for ₩10,001 with a 33 % rule shows ₩3,300, rounded down, and the remaining ₩6,701 to the remainder account.
- **AC-05.3** The list of possible targets contains no account the client may not send to. A request to save such a target directly to the server is rejected.
- **AC-05.4** Saving a rule without a target, or with a value of 0, is rejected.
- **AC-05.5** Rules whose percentages add up to more than 100 % are saved with a warning. Later rules then receive only what is left, possibly nothing.
- **AC-05.6** A member who is not the owner can view the group router but not change it.
- **AC-05.7** Amounts received before a change keep their original split. The next amount uses the new rules.

### FR-06 Manage Group

| | |
|---|---|
| **Use case** | UC-06 · **Priority** Must |
| **Actor** | Group owner; Member (invited client accepting or declining, or member leaving) |
| **Requirement** | The system shall let a group owner do the following: invite registered users as payer or contributor, and withdraw pending invitations; change members' roles and remove members; set the contribution visibility to *members* or *private*; add OWT accounts and close empty ones; create a group number. It shall show an invited user the group's name, the offered role and the group's visibility, and make the user a member only when they accept. It shall let a member who is not the owner leave the group. |
| **Inputs** | User and role; invitation answer; new role; visibility; account name; close request; leave request |
| **Outputs** | Updated group; invitation shown to the invited user; change log entries |
| **Business rules** | DR-07, NFR-09, CR-03 |

**Acceptance criteria**
- **AC-06.1** An invited user who has not accepted cannot open the group, cannot send money to it or pay from it, and does not appear in the member list or contribution figures.
- **AC-06.2** The invitation shows the group's name, the offered role and the group's visibility with its explanation.
- **AC-06.3** Accepting makes the user an active member with the offered role. Declining removes the pending invitation, the owner sees that it was declined, and the owner may invite the user again.
- **AC-06.4** After the owner withdraws a pending invitation, the invited user no longer sees it.
- **AC-06.5** A change of visibility applies to the next page any member opens (FR-10).
- **AC-06.6** Changing a member from contributor to payer lets them pay from the group's accounts straight away (FR-09). Changing back removes this.
- **AC-06.7** Closing a group account is rejected if any of these holds: its balance is not ₩0, a router rule or remainder points to it, or it is the group's only account.
- **AC-06.8** A member who is not the owner cannot invite, change roles, change visibility, or add or close accounts. The server rejects such requests.
- **AC-06.9** The owner cannot leave the group or be removed from it.
- **AC-06.10** Every change appears in the group's change log with the acting user and time.

### FR-07 Transfer Funds

| | |
|---|---|
| **Use case** | UC-07 · **Priority** Must |
| **Actor** | Client (including group owners and members) |
| **Requirement** | The system shall let a client transfer an amount from one of their own open personal accounts to another open account or router, identified by its number or chosen from a list, as far as the flow rules of Table II allow. It shall debit and credit both accounts in one atomic transaction and record the acting user, both accounts, the amount, the message and the time. If the destination is a router, it shall split the amount by the router's rules in the same transaction (DR-05). |
| **Inputs** | Source account, destination (account or router number), amount, message (optional) |
| **Outputs** | Recorded transfer, and any router splits; or an error naming the reason |
| **Business rules** | Table II, DR-01 to DR-06, INC-01, INC-02 |

**Acceptance criteria**
- **AC-07.1** A transfer of ₩50,000 from Minji's spending account to Ji-ho's spending account, entered by account number, lowers Minji's balance and raises Ji-ho's by ₩50,000 in one transaction, with Minji recorded as the actor.
- **AC-07.2** From spending to the client's own savings is allowed. From spending to another user's savings is rejected.
- **AC-07.3** From savings to the client's own spending is allowed. From savings to another user's spending account, and from savings to any group account or group number, are rejected.
- **AC-07.4** To a group account or group number, only active members of that group may transfer. A transfer by a non-member, or by a user whose invitation is still pending, is rejected.
- **AC-07.5** A transfer of ₩30,000 to a club number with the rules 20 % and 30 %, and a remainder account, results in:
  - transfers of ₩6,000, ₩9,000 and ₩15,000 to the three accounts;
  - each with the sender as actor and the incoming transfer as cause;
  - the router's balance staying ₩0.
- **AC-07.6** A transfer whose source is not one of the client's own personal accounts is rejected. This includes a group account as source.
- **AC-07.7** Amounts of 0 or below, an unknown account number, and a closed account are rejected.
- **AC-07.8** A transfer larger than the balance of a personal spending account succeeds, and the balance becomes negative (DR-01).
- **AC-07.9** When a transfer is rejected, no transaction is recorded and no balance changes.

### FR-08 Deposit Funds

| | |
|---|---|
| **Use case** | UC-08 · **Priority** Must |
| **Actor** | Client |
| **Requirement** | The system shall let a client add fictitious funds to one of their own spending accounts, or to their own router, up to a configurable limit per deposit (default ₩10,000,000). It shall record the sender's name, a message and the acting user. A deposit to a router shall be split by its rules in the same transaction. |
| **Inputs** | Target (own spending account or own router), sender's name, message, amount |
| **Outputs** | Recorded deposit, and any router splits; or an error naming the reason |
| **Business rules** | Table II, DR-02 to DR-05, INC-01, INC-02 |

**Acceptance criteria**
- **AC-08.1** A deposit of ₩1,000,000 to the client's spending account raises its balance by ₩1,000,000 and records the sender's name and the client as actor.
- **AC-08.2** A deposit of ₩3,400,000 to Minji's router, with the rules of AC-05.1, records the deposit and three transfers (₩1,020,000, ₩200,000 and ₩2,180,000) in one transaction. Each transfer has Minji as actor and the deposit as cause.
- **AC-08.3** Deposits to a savings account, a group account, or another user's account or router are rejected.
- **AC-08.4** A deposit of exactly the limit is accepted. A deposit of the limit plus ₩1 is rejected.
- **AC-08.5** An amount of 0 or below is rejected.

### FR-09 Make Payment or Withdrawal

| | |
|---|---|
| **Use case** | UC-09 · **Priority** Must |
| **Actor** | Client; Group owner or Member with the payer role |
| **Requirement** | The system shall let a client pay an external payee, identified by name and an optional reference, from one of their own spending accounts. It shall let the owner or a payer of a group pay from that group's OWT accounts. It shall record the payment on the sender's side only, with payee, reference, amount, acting user and time. It shall reject a payment from a savings account, and a payment that would take an OWT account below zero. A withdrawal is a payment to the acting user. |
| **Inputs** | Source account, payee, reference (optional), amount; or withdrawal and amount |
| **Outputs** | Recorded payment; or an error naming the reason |
| **Business rules** | Table II, DR-01 to DR-04, DR-06, INC-01 |

**Acceptance criteria**
- **AC-09.1** A payment of ₩65,000 to "SK Telecom" from Minji's spending account lowers its balance by ₩65,000, and records the payee, the reference and Minji as actor. No account in the system is credited.
- **AC-09.2** A payment from a personal spending account larger than its balance succeeds (DR-01).
- **AC-09.3** A payment from a savings account is rejected.
- **AC-09.4** Hana (owner) and a payer can pay from a group account. Ji-ho (contributor) cannot; the server rejects his request.
- **AC-09.5** With a group account balance of ₩50,000, a payment of ₩50,000 succeeds and leaves ₩0. A payment of ₩50,001 is rejected and nothing is recorded.
- **AC-09.6** A withdrawal of ₩100,000 is recorded as a payment with the acting user as payee and the reference "cash withdrawal".
- **AC-09.7** A payment without a payee, or with an amount of 0 or below, is rejected.

### FR-10 View History and Contributions

| | |
|---|---|
| **Use case** | UC-10 · **Priority** Must |
| **Actor** | Client, Member |
| **Requirement** | The system shall list the transactions of a personal account to its owner, and of a group's accounts to the group's active members. The list shall be newest first and show for each entry the date, amount, counterparty and acting user. It shall be filterable by period, type and counterparty. For groups, the system shall show each member's contributions, credited to the actor of the incoming amount, as far as the group's visibility allows (DR-07). Contributions shall be ranked by total, with equal totals ordered by earliest contribution. The system shall show no information about a group to anyone who is not an active member. |
| **Inputs** | Account or group; filters |
| **Outputs** | Transaction list; contributions graph and table |
| **Business rules** | DR-05, DR-07, INC-03, NFR-09 |

**Acceptance criteria**
- **AC-10.1** The list contains every transaction of the account, newest first, each with date, amount, counterparty and acting user.
- **AC-10.2** A transfer caused by a router shows the incoming amount that caused it. Dues paid to a club number appear under the member who paid them, not the router owner.
- **AC-10.3** Filtering by a period, by type (all, money in, payments) or by counterparty returns exactly the matching entries.
- **AC-10.4** Visibility *members*: every member sees every member's contributions with names.
- **AC-10.5** Visibility *private*:
  - a contributor sees their own contributions with their name, and other members' contributions as "a member" with amount and date;
  - in the contributions graph and table, the other members are shown only as one total;
  - the owner and payers see every contribution with names.
- **AC-10.6** The contributions table lists members by total, largest first. When two members have the same total, the one whose first contribution is earlier is listed first.
- **AC-10.7** No page or server endpoint returns a group's name, balance, transactions or contributions to a visitor, to a registered user who is not a member, or to an invited user who has not accepted. The only exception is the invitation itself (AC-06.2).
- **AC-10.8** A user without access to an account or group gets the same "not found" response whether or not it exists.
- **AC-10.9** Viewing changes no data.

### FR-11 Flag Unauthorised Transaction

| | |
|---|---|
| **Use case** | UC-11 · **Priority** Should |
| **Actor** | Client (owner of the account, or owner of the group) |
| **Requirement** | The system shall let the owner of a personal account, or the owner of a group, flag a transaction on that account or on the group's accounts as unauthorised, with a reason. The flag starts in state *Open*. The reporter shall be able to follow its state and the administrator's notes until it is *Resolved*, as confirmed or rejected. |
| **Inputs** | Transaction, reason |
| **Outputs** | Flag with state, reporter and time; status view |
| **Business rules** | DR-04, CR-03 |

**Acceptance criteria**
- **AC-11.1** The account owner can flag a transaction with a non-empty reason. The flag is stored as *Open* with reporter and time.
- **AC-11.2** Members who are not the group owner, and users without access, cannot flag. The server rejects such requests.
- **AC-11.3** A second flag on a transaction that already has an open flag is rejected, and the existing flag is shown.
- **AC-11.4** The reporter sees every change of state and every administrator note.
- **AC-11.5** Flagging does not change the transaction or any balance (DR-04).
- **AC-11.6** An account with an open flag cannot be closed (AC-03.4).

### FR-12 Investigate Transactions

| | |
|---|---|
| **Use case** | UC-12 · **Priority** Should |
| **Actor** | Administrator |
| **Requirement** | The system shall let an administrator search transactions by time range or by user, with clients' personal details masked. It shall list open flags and let the administrator move a flag from *Open* to *Under Review* to *Resolved* (confirmed or rejected), with a note at each step. |
| **Inputs** | Time range or user; flag; new state; note |
| **Outputs** | Search results with masked personal details; updated flag |
| **Business rules** | NFR-09, CR-02, CR-03 |

**Acceptance criteria**
- **AC-12.1** Only users with the administrator role can use these functions. The server rejects anyone else.
- **AC-12.2** A search by time range returns all transactions in the range and no others. A search by user returns the transactions where the user is the actor, or owns one of the accounts.
- **AC-12.3** Names and e-mail addresses in the results are masked, for example "M\*\*\*\* P\*\*\*" and "m\*\*\*\*@example.com".
- **AC-12.4** Only the transitions Open → Under Review → Resolved (confirmed or rejected) are possible. Each requires a note. Any other transition is rejected.
- **AC-12.5** Each change is recorded with the administrator and time, and is visible to the reporter (AC-11.4).

### FR-13 Manage Data-Access Consent

| | |
|---|---|
| **Use case** | UC-13 · **Priority** Should |
| **Actor** | Administrator (request); Client (decision) |
| **Requirement** | The system shall let an administrator request consent to see the personal details related to a flag, and let the client who reported the flag grant or deny it. A granted consent shall expire 72 hours after it was granted, and the client shall be able to revoke it at any time. The system shall show unmasked personal details only under a granted consent that has not expired, checked when the details are requested, and shall log every such access. |
| **Inputs** | Flag; consent decision; revoke request |
| **Outputs** | Consent record with state and `expires_at`; unmasked details; access log entries |
| **Business rules** | NFR-09, CR-02, CR-06 |

**Acceptance criteria**
- **AC-13.1** Consent can only be requested for an existing flag. The request is stored as *Pending* and shown to the reporter of the flag.
- **AC-13.2** Granting sets `expires_at` to the time of granting plus 72 hours. The details become visible to the requesting administrator for that flag only.
- **AC-13.3** A request for the details 71 hours 59 minutes after granting shows them. A request 72 hours or more after granting shows them masked, with no background job having run.
- **AC-13.4** After the client denies or revokes, the details are masked on the next request.
- **AC-13.5** Every display of unmasked details is logged with the administrator, the client, the flag and the time.
- **AC-13.6** Without a valid consent, no server endpoint returns unmasked personal details, including endpoints the user interface does not use.

---

## 5. Review

| Reviewer | Date | Result |
|----------|------|--------|
| | | |
