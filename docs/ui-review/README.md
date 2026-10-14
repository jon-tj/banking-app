# UI Review of the Demo (WBS 2.6, Key UI Screens)

Review of the clickable prototype in [`/demo`](../../demo) against the revised proposal for the interim report ([FBD_Interim.md](../interim/FBD_Interim.md)), October 14, 2026.

**Summary.** The demo now follows the revised design: personal accounts, groups with one-way transfer (OWT) accounts and subaccounts, personal and group routers, templates (Couple, Club, Church, Custom) and contribution visibility (*members* or *private*). Only active members see anything of a group; visitors can only register. Seven of the thirteen use cases are covered fully and two partly. Login with lockout, dispute flags, administrator investigation and consent (UC-02, UC-11 to UC-13) are still missing.

An earlier version of this review covered the first demo, which used manager and contributor roles on individual accounts. That version is in the git history; its visual findings were fixed in this update (see section 4).

---

## 1. How the screenshots were made

Screenshots are written to [`screenshots/`](screenshots), which is git-ignored, so regenerate them before use:

```bash
node docs/ui-review/capture.mjs
```

The script is [`capture.mjs`](capture.mjs) (Node 22+ and Google Chrome, no npm packages). Steps it performs:

1. Starts one headless Chrome with a throwaway profile in the OS temp folder. It never uses or touches your normal Chrome profile.
2. Opens `demo/index.html` once and keeps the data the demo seeds on load. Before each screen the seed is restored, so every image shows the same data. The `demo/` folder is not copied or modified.
3. For each screen and each viewport (desktop 1280×800, phone 390×844): logs in as the listed user by setting the demo's `state.me`, sets the route, waits for fonts, measures the page height at the real viewport size, then grows the viewport to that height and captures it.
4. Stops with an error if the page throws a JavaScript error on any screen.
5. Closes Chrome and deletes the temporary profile, also on error. A 2-minute timeout aborts the run if anything hangs.

Account numbers are random and dates are relative to the day of capture, so these differ between runs; balances and names do not. On phone width the tab bar, which is fixed to the bottom of the screen, appears at the bottom of the whole page.

### Screens captured

Each screen is saved as `<name>-desktop.png` and `<name>-mobile.png`.

| Name | Screen | Viewed as | Use cases |
|------|--------|-----------|-----------|
| 01-login | Landing with example users | logged out | UC-02 (placeholder) |
| 02-signup | Create a user | logged out | UC-01 |
| 03-home | Personal accounts, router summary, groups | Minji | UC-03, UC-05 |
| 04-spending-account | Spending account with activity filters and the router rules that feed it | Minji | UC-03, UC-10 |
| 05-router | Personal router: rules, preview, recent income and its splits | Minji | UC-05, UC-08 |
| 06-group-couple | "Our home" (Couple, visibility *members*) | Minji | UC-10 |
| 07-group-club-owner | Seoul Trail Club with three subaccounts, as treasurer | Hana | UC-10 |
| 08-group-club-member | The same club as a contributor; Pay is locked with the reason shown | Ji-ho | UC-09, UC-10 |
| 09-club-subaccount | Club page filtered to the Joint exercises account | Hana | UC-10 |
| 10-group-church-private | Grace Church (visibility *private*) as a member: other members are hidden | Minji | UC-10, DR-07 |
| 11-group-settings | Visibility, members and roles, a pending invitation, accounts, group number | Hana | UC-06 |
| 12-group-number | Group router (club number) split rules | Hana | UC-05 |
| 13-setup-couple | Set up a group, Couple template | Minji | UC-04 |
| 14-setup-club | Set up a group, Club template with budgets | Minji | UC-04 |
| 16-new-account | Open a personal account, with a link to group setup | Minji | UC-03 |
| 17-transfer-to-club | Transfer to the club number | Ji-ho | UC-07 |
| 18-transfer-blocked | Savings to a group is blocked | Minji | UC-07 |
| 19-pay-from-group | Treasurer pays from a subaccount | Hana | UC-09 |
| 20-pay-blocked | Contributor without pay rights | Ji-ho | UC-09 |
| 21-deposit | Deposit to the router with a split preview | Minji | UC-08 |
| 22-not-found | Unknown group or no access | Minji | — |
| 23-invitation | Pending invitation to Seoul Trail Club, with role, visibility, accept and decline | Joon | UC-06 (A7) |

---

## 2. Coverage of the use cases

| Use case | Status |
|----------|--------|
| UC-01 Register User | ✅ Name, unique e-mail and password policy are checked. |
| UC-02 Log In and Log Out | ❌ The landing page lets you pick an example user. There is no e-mail and password form, failed-attempt message or 24-hour lockout. Log out is in the user menu. |
| UC-03 Manage Personal Accounts | ⚠️ Opening and listing work. Personal accounts cannot yet be renamed or closed. |
| UC-04 Set Up Group from Template | ✅ Four templates. Couple invites the partner as payer and adds a rule to your router (creating the router if needed). Club creates one account per budget and a club number whose rules must add up to 100 %. Each template proposes a visibility, which can be changed before creating. |
| UC-05 Manage Router | ✅ Personal router and group number: ordered percentage or fixed rules, remainder account, live preview, and a list of recent income with the transfers it caused. Only the group owner can edit a group number. |
| UC-06 Manage Group | ✅ Owner sets visibility, changes roles (payer or contributor), invites members and withdraws invitations, removes members, adds accounts and closes empty ones, and creates a group number. Invited users join only by accepting, and can decline. Members can leave. Permission changes are not yet shown in a log. |
| UC-07 Transfer Funds | ✅ To your own accounts, your groups, your router, a group number, or any spending account by its number. Savings → group is blocked. Amounts sent to a router or group number show their split before sending. |
| UC-08 Deposit Funds | ✅ To your own spending account or router, with the per-deposit limit. Deposits to savings and group accounts are blocked. |
| UC-09 Make Payment or Withdrawal | ✅ From your own spending accounts, or from a group account if you are its owner or a payer. Group accounts cannot be paid below zero. There is no separate withdrawal button. |
| UC-10 View History and Contributions | ⚠️ Every entry shows who acted; contributions are named after the member. Filters for *all*, *money in* and *payments*, and a "show all" button. Contributions graph and table respect visibility and rank members by total (ties: earliest contribution first). Filters by period and counterparty are still missing from the activity list. |
| UC-11 Flag Unauthorised Transaction | ❌ Missing. |
| UC-12 Investigate Transactions | ❌ Missing; there is no administrator role. |
| UC-13 Manage Data-Access Consent | ❌ Missing. |

---

## 3. Consistency with the domain requirements

| Rule | In the demo |
|------|-------------|
| DR-01 Personal accounts may go negative | ✅ Payments and transfers from personal accounts are not limited. |
| DR-02 Atomic transfers, balances reconcile | ✅ Balances are always computed from the ledger. |
| DR-03 Whole won | ✅ Amounts are integers; percentage splits round down. |
| DR-04 Closed accounts | ⚠️ Closed group accounts disappear from lists and targets. Personal accounts cannot be closed yet. |
| DR-05 Router splitting | ✅ Rules in order, each capped by what is left, remainder last. Split transfers record the member who paid as actor, so dues paid to the club number are credited to that member. |
| DR-06 OWT accounts | ✅ Filled only by transfers from members' spending accounts or routers; leave only as payments by the owner or payers; never below zero. |
| DR-07 Visibility | ✅ In a private group, a contributor sees "You vs. others", an "Other members" row, and "A member" in the activity list. |

---

## 4. Visual and usability findings

Fixed in this update (from the review of the first demo):

- The reason a button is disabled is now shown as text under the buttons, not only in a tooltip (screens 08, 10).
- The Pay rules card no longer splits into columns (screen 20). The same flex-item bug in the group note was fixed too.
- Contributions are titled with the member's name instead of their private account name (screens 06–10).
- The home total is labelled "Total in your personal accounts"; group balances are shown on the group cards.
- The activity list has filters and a "Show all" button instead of stopping silently at 30 entries.
- Long router labels no longer wrap in the split preview.

Still open:

1. **Private groups show each gift's amount and date** as "A member" (screen 10). *Decided October 14: keep this behaviour* (DR-07). No change needed.
2. **The group page is long on phones** (screen 08 mobile, about five screens). The graph, the table and the activity list repeat much of the same information. Consider collapsing the contributions table, or moving activity to its own tab.
3. **Invitations are accepted immediately.** A user added to a group, or invited as a partner by the Couple template, becomes a member without agreeing. *Decided October 14: invited users must accept* (UC-06 A7, NFR-09). **Fixed:** invitations are pending until accepted; the invitation shows the role and the group's visibility (screen 23), and the owner sees pending and declined invitations and can withdraw them (screen 11). The Couple template invites the partner the same way.
4. **Tied contributors were listed in input order.** *Decided October 14: earliest contribution first* (DR-07). **Fixed** in the contributions table (screens 07, 08). The public page that first showed this was removed on October 14: only active members see a group's details.
5. **No permission change log** (UC-06), and no withdrawal shortcut (UC-09).

---

## 5. Recommendations for the interim report

1. Use screens 03, 06, 07, 10, 13, 14, 17 and 23 as the key UI screens; together they show all three building blocks, the templates, both visibility levels and an invitation.
2. Add static mock-ups for the missing use cases: login with lockout (UC-02), flagging a transaction and following its status (UC-11), the administrator's search with masked details (UC-12), and the consent request (UC-13).
3. Show screen 23 (invitation) in the report next to the visibility screens, since it is where NFR-09 becomes visible to the user.

## 6. Mock-ups for the missing use cases

Static mock-ups in [`mockups/`](mockups) show the four use cases the prototype does not cover yet, in the prototype's visual style. They are not clickable. Each is marked *Mock-up* in its header.

| File | Use case | Shows |
|------|----------|-------|
| `m1-login-blocked.html` | UC-02 | The login form after five failed attempts: login is blocked, and the message states when it reopens. |
| `m2-flag.html` | UC-11 | Minji flags an unknown payment with a reason, and follows an earlier flag through *Open*, *Under Review* and *Resolved*. |
| `m3-admin.html` | UC-12 | The administrator's search by time range or user, with names and e-mail addresses masked, and the open flags with their next step. |
| `m4-consent.html` | UC-13 | A consent request shown only to the client whose details are requested, and a granted consent with its expiry and a revoke button. |
