# UI Review of the Demo (WBS 2.6, Key UI Screens)

Review of the clickable prototype in [`/demo`](../../demo) against the revised proposal for the interim report ([FBD_Interim.md](../interim/FBD_Interim.md)), October 14, 2026.

**Summary.** The demo now follows the revised design: personal accounts, groups with one-way transfer (OWT) accounts and subaccounts, personal and group routers, templates (Couple, Club, Church, Custom) and contribution visibility (public, members, private), including a public contributor page. Seven of the thirteen use cases are covered fully and two partly. Login with lockout, dispute flags, administrator investigation and consent (UC-02, UC-11 to UC-13) are still missing.

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
| 01-login | Landing with example users and a link to the public club page | logged out | UC-02 (placeholder) |
| 02-signup | Create a user | logged out | UC-01 |
| 03-home | Personal accounts, router summary, groups | Minji | UC-03, UC-05 |
| 04-spending-account | Spending account with activity filters and the router rules that feed it | Minji | UC-03, UC-10 |
| 05-router | Personal router: rules, preview, recent income and its splits | Minji | UC-05, UC-08 |
| 06-group-couple | "Our home" (Couple, visibility *members*) | Minji | UC-10 |
| 07-group-club-owner | Seoul Trail Club with three subaccounts, as treasurer | Hana | UC-10 |
| 08-group-club-member | The same club as a contributor; Pay is locked with the reason shown | Ji-ho | UC-09, UC-10 |
| 09-club-subaccount | Club page filtered to the Joint exercises account | Hana | UC-10 |
| 10-group-church-private | Grace Church (visibility *private*) as a member: other members are hidden | Minji | UC-10, DR-07 |
| 11-group-settings | Visibility, members and roles, accounts, group number | Hana | UC-06 |
| 12-group-number | Group router (club number) split rules | Hana | UC-05 |
| 13-setup-couple | Set up a group, Couple template | Minji | UC-04 |
| 14-setup-club | Set up a group, Club template with budgets | Minji | UC-04 |
| 15-public-page | Public page with the largest contributors | logged out | UC-10 |
| 16-new-account | Open a personal account, with a link to group setup | Minji | UC-03 |
| 17-transfer-to-club | Transfer to the club number | Ji-ho | UC-07 |
| 18-transfer-blocked | Savings to a group is blocked | Minji | UC-07 |
| 19-pay-from-group | Treasurer pays from a subaccount | Hana | UC-09 |
| 20-pay-blocked | Contributor without pay rights | Ji-ho | UC-09 |
| 21-deposit | Deposit to the router with a split preview | Minji | UC-08 |
| 22-not-found | Unknown group or no access | Minji | — |

---

## 2. Coverage of the use cases

| Use case | Status |
|----------|--------|
| UC-01 Register User | ✅ Name, unique e-mail and password policy are checked. |
| UC-02 Log In and Log Out | ❌ The landing page lets you pick an example user. There is no e-mail and password form, failed-attempt message or 24-hour lockout. Log out is in the user menu. |
| UC-03 Manage Personal Accounts | ⚠️ Opening and listing work. Personal accounts cannot yet be renamed or closed. |
| UC-04 Set Up Group from Template | ✅ Four templates. Couple invites the partner as payer and adds a rule to your router (creating the router if needed). Club creates one account per budget and a club number whose rules must add up to 100 %. Each template proposes a visibility, which can be changed before creating. |
| UC-05 Manage Router | ✅ Personal router and group number: ordered percentage or fixed rules, remainder account, live preview, and a list of recent income with the transfers it caused. Only the group owner can edit a group number. |
| UC-06 Manage Group | ✅ Owner sets visibility, changes roles (payer or contributor), removes and invites members, adds accounts and closes empty ones, and creates a group number. Members can leave. Permission changes are not yet shown in a log. |
| UC-07 Transfer Funds | ✅ To your own accounts, your groups, your router, a group number, or any spending account by its number. Savings → group is blocked. Amounts sent to a router or group number show their split before sending. |
| UC-08 Deposit Funds | ✅ To your own spending account or router, with the per-deposit limit. Deposits to savings and group accounts are blocked. |
| UC-09 Make Payment or Withdrawal | ✅ From your own spending accounts, or from a group account if you are its owner or a payer. Group accounts cannot be paid below zero. There is no separate withdrawal button. |
| UC-10 View History and Contributions | ⚠️ Every entry shows who acted; contributions are named after the member. Filters for *all*, *money in* and *payments*, and a "show all" button. Contributions graph and table respect visibility; the public page lists the top five contributors. Filters by period and counterparty are still missing from the activity list. |
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

1. **Private groups still show each gift's amount and date** as "A member" (screen 10). In a small group, a member could work out who gave what from the amounts. Consider showing only the member's own transactions and the total in a private group.
2. **The group page is long on phones** (screen 08 mobile, about five screens). The graph, the table and the activity list repeat much of the same information. Consider collapsing the contributions table, or moving activity to its own tab.
3. **Invitations are accepted immediately.** A user added to a group, or invited as a partner by the Couple template, becomes a member without agreeing. The requirement NFR-09 says users are told a group's visibility *before* they join, which needs an accept step.
4. **The public page shows ties in input order** (screen 15: four members with ₩90,000). A stable rule, for example earliest contributor first, should be specified.
5. **No permission change log** (UC-06), and no withdrawal shortcut (UC-09).

---

## 5. Recommendations for the interim report

1. Use screens 03, 06, 07, 10, 13–15 and 17 as the key UI screens; together they show all three building blocks, a template, and the three visibility levels.
2. Add static mock-ups for the missing use cases: login with lockout (UC-02), flagging a transaction and following its status (UC-11), the administrator's search with masked details (UC-12), and the consent request (UC-13).
3. Decide findings 1 and 3 in section 4 before baselining DR-07 and NFR-09, since they change the requirements, not only the screens.
