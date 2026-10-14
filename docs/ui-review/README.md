# UI Review of the Demo (WBS 2.6, Key UI Screens)

Review of the clickable prototype in [`/demo`](../../demo) against the submitted proposal ([FBD_Proposal.md](../proposal/FBD_Proposal.md)), carried out on October 14, 2026, for the interim report. It answers two questions: which screens the interim report still needs, and whether the screens that exist look and behave correctly.

**Summary.** The demo is polished and works well on desktop and phone widths, but it prototypes a different product from the one in the proposal. It is built around account *types* (spending, savings, one-way transfer) and a deposit *router*, with two fixed roles (manager, contributor). The proposal is built around *permission scopes* (a)–(d) per account, dispute flags, and administrator investigation under consent. Five of the eleven use cases have no screen at all, and three existing screens contradict the functional requirements.

---

## 1. How the screenshots were made

All screenshots are in [`screenshots/`](screenshots). They can be regenerated with:

```bash
node docs/ui-review/capture.mjs
```

The script is [`capture.mjs`](capture.mjs) (Node 22+ and Google Chrome, no npm packages). Steps it performs:

1. Starts one headless Chrome with a throwaway profile in the OS temp folder. It never uses or touches your normal Chrome profile.
2. Opens `demo/index.html` once and keeps the data the demo seeds on load. Before each screen the seed is restored, so every image shows the same data. The `demo/` folder is not copied or modified.
3. For each screen and each viewport (desktop 1280×800, phone 390×844): logs in as the listed user by setting the demo's `state.me`, sets the route, waits for fonts, measures the page height at the real viewport size, then grows the viewport to that height and captures it.
4. Closes Chrome and deletes the temporary profile, also on error. A 2-minute timeout aborts the run if anything hangs.

Notes for checking the images:

- Account numbers are random and dates are relative to the day of capture, so these differ between runs. Balances and names do not.
- Pages are captured at full height. On phone width the tab bar, which is fixed to the bottom of the screen, therefore appears at the bottom of the whole page, as it would after scrolling to the end.
- A first attempt (a shell script calling Chrome once per screenshot with a 2600 px tall window) was discarded: Chrome did not exit after each screenshot, so the script hung, and the tall window stretched the landing page, whose height is relative to the window (`min-height: calc(100vh - 180px)`).

### Screens captured

| # | Screen | Viewed as | Desktop | Phone |
|---|--------|-----------|---------|-------|
| 01 | Landing / log in | logged out | [png](screenshots/01-login-desktop.png) | [png](screenshots/01-login-mobile.png) |
| 02 | Create a user | logged out | [png](screenshots/02-signup-desktop.png) | [png](screenshots/02-signup-mobile.png) |
| 03 | Accounts overview | Minji | [png](screenshots/03-home-desktop.png) | [png](screenshots/03-home-mobile.png) |
| 04 | Spending account | Minji | [png](screenshots/04-spending-account-desktop.png) | [png](screenshots/04-spending-account-mobile.png) |
| 05 | Savings account | Minji | [png](screenshots/05-savings-account-desktop.png) | [png](screenshots/05-savings-account-mobile.png) |
| 06 | OWT account, owner | Minji | [png](screenshots/06-owt-account-desktop.png) | [png](screenshots/06-owt-account-mobile.png) |
| 07 | OWT account, contributor without pay rights | Ji-ho | [png](screenshots/07-owt-contributor-view-desktop.png) | [png](screenshots/07-owt-contributor-view-mobile.png) |
| 08 | Contributors of an OWT account | Minji | [png](screenshots/08-sharing-owt-desktop.png) | [png](screenshots/08-sharing-owt-mobile.png) |
| 09 | Sharing, viewed by a manager | Minji | [png](screenshots/09-sharing-as-manager-desktop.png) | [png](screenshots/09-sharing-as-manager-mobile.png) |
| 10 | Open an account | Minji | [png](screenshots/10-new-account-desktop.png) | [png](screenshots/10-new-account-mobile.png) |
| 11 | Transfer, allowed | Minji | [png](screenshots/11-transfer-desktop.png) | [png](screenshots/11-transfer-mobile.png) |
| 12 | Transfer, blocked (savings → OWT) | Minji | [png](screenshots/12-transfer-blocked-desktop.png) | [png](screenshots/12-transfer-blocked-mobile.png) |
| 13 | Pay | Minji | [png](screenshots/13-pay-desktop.png) | [png](screenshots/13-pay-mobile.png) |
| 14 | Pay, blocked (contributor without pay rights) | Minji | [png](screenshots/14-pay-blocked-desktop.png) | [png](screenshots/14-pay-blocked-mobile.png) |
| 15 | Deposit | Minji | [png](screenshots/15-deposit-desktop.png) | [png](screenshots/15-deposit-mobile.png) |
| 16 | Router | Minji | [png](screenshots/16-router-desktop.png) | [png](screenshots/16-router-mobile.png) |
| 17 | Not found / no access | Minji | [png](screenshots/17-not-found-desktop.png) | [png](screenshots/17-not-found-mobile.png) |

---

## 2. Coverage of the use cases

| Use case | Screen in demo | Status |
|----------|----------------|--------|
| UC-01 Register User | 02 Create a user | ✅ Covered. Name, unique e-mail and password policy are checked. |
| UC-02 Log In and Log Out | 01 Landing | ❌ **Missing.** There is no e-mail/password form, only a picker of example users. No failed-attempt message, no 24-hour lockout screen. Log out exists in the user menu. |
| UC-03 Manage Accounts | 03 Overview, 10 Open an account | ⚠️ Partial. Opening and listing work. No way to rename (nickname) or close an account. |
| UC-04 Transfer Funds | 11, 12 Transfer | ⚠️ Conflicts with the FR, see 3.1. |
| UC-05 Deposit Funds | 15 Deposit | ⚠️ Mostly covered, but managers can also deposit (UC-05: owner only), and the router is outside the proposal. |
| UC-06 Make Payment or Withdrawal | 13, 14 Pay | ⚠️ Conflicts with the FR, see 3.2. No withdrawal option. |
| UC-07 Manage Permissions | 08, 09 Sharing | ⚠️ Conflicts with the FR, see 3.3. |
| UC-08 View Transaction History | Activity list on 04–07 | ⚠️ Partial. Each entry shows who acted, as required. No filters by period, type or counterparty, and only the latest 30 entries are shown, with no way to see older ones. |
| UC-09 Flag Unauthorised Transaction | – | ❌ **Missing.** Transactions cannot be selected or flagged. |
| UC-10 Investigate Transactions | – | ❌ **Missing.** There is no administrator role or screen. |
| UC-11 Manage Data-Access Consent | – | ❌ **Missing.** No consent request or approval screen. |

---

## 3. Conflicts with the functional requirements

### 3.1 Transfers only reach accounts the user already has access to

UC-04 says the destination is "another account in the system, identified by its account number". In the demo, the *To* list only offers accounts the user owns or shares ([app.js:897](../../demo/app.js#L897)), and the rules card says "You also need access to both accounts". There is no way to type an account number, so the central example of the proposal — an officer paying a supplier's account — cannot be shown.

The demo's account-type rules (savings cannot send to OWT, nothing can leave an OWT account by transfer, see screen 12) are also not part of any functional requirement.

### 3.2 Delegates can pay

The revised UC-06 makes payments and withdrawals owner-only. In the demo, managers can pay from spending accounts, and OWT contributors with *Can pay* can pay from the OWT account ([app.js:245-261](../../demo/app.js#L245-L261), screens 13 and 14).

### 3.3 Two fixed roles instead of permission scopes

UC-07 defines four scopes that are granted per account and per user: (a) view, (b) transfer to selected accounts, (c) transfer to any account, (d) manage permissions. The demo has two roles instead:

- **Manager** (spending and savings): "the same rights as the owner", including inviting other managers (screen 09).
- **Contributor** (OWT): can send money in and see everything, with an optional *Can pay* switch (screen 08).

A manager is exactly the all-or-nothing role that problem P1 in the proposal criticises. There is no way to grant view-only access, or a transfer right restricted to selected accounts, and permission changes are not shown in any log.

---

## 4. Visual and usability findings

The overall visual quality is good: consistent spacing, type and colour, clear blocked/allowed messages on forms, a usable phone layout with a bottom tab bar, and every transaction shows who performed it. The issues below are in order of importance.

1. **Reasons for disabled buttons are only in a tooltip.** A locked action such as *Pay* on screen 07 explains why only through the `title` attribute ([app.js:537-541](../../demo/app.js#L537-L541)), which is invisible on phones and to keyboard users. Show the reason as text, or link to the form where the full message appears.
2. **Broken layout in the Pay rules card.** "OWT — owner, and contributors with *Can pay*" is split into two columns, because the list item is a flex container and the `<em>` becomes a separate flex item ([app.js:968](../../demo/app.js#L968), [styles.css:385](../../demo/styles.css#L385)). Clearly visible on the phone (screen 14). Wrapping the text in a `<span>` fixes it.
3. **Transfers into a shared account show the sender's private account name.** On screen 07 each contribution is titled "Everyday · Hana", the name of Hana's own spending account, followed by "by Hana". The contributor name alone is clearer and does not expose the name of another user's private account ([app.js:349-350](../../demo/app.js#L349-L350)).
4. **"Total in accounts you own" leaves out owned OWT accounts.** Minji owns *Our home* (₩650,000), but it is not included in the total on screen 03 ([app.js:468-471](../../demo/app.js#L468-L471)). Either include it or relabel the total.
5. **Long activity lists without paging or filters.** The OWT pages (06, 07) end in 30 near-identical rows. Filters by period and type (required by UC-08) and a "show more" button would shorten the page considerably.
6. **Router preview labels wrap awkwardly.** "Fixed ₩200,000 rule" breaks over two lines in the narrow preview column (screen 16). Minor.
7. **Every contributor sees every other contributor's amounts.** On screen 07, Ji-ho sees exactly how much each club member has paid. This is a design decision rather than a bug, but it should be stated in the requirements, given the privacy emphasis of the proposal (P4, NFR-09).

---

## 5. Recommendations for the interim report

The interim report needs key screens that match the requirements being baselined. Suggested order:

1. **Decide which design the report follows.** Either align the demo with the proposal (scopes, flags, administrator, consent), or update the proposal's requirements to the account-type and router model. Mixing both in one report will make the requirements traceability matrix (G3) inconsistent. The remaining steps assume the proposal is kept.
2. **Add the missing screens**, which can be static where interaction is not needed:
   - Log in with e-mail and password, a wrong-password message, and the lockout message (UC-02).
   - Flag a transaction from the activity list, and a flag status page (UC-09).
   - Administrator: transaction search with masked personal details, and the list of open flags (UC-10).
   - Consent request as the client sees it, with approve and deny buttons and the 72-hour expiry (UC-11).
   - Account settings with rename and close (UC-03).
3. **Rework the sharing screen into a permission editor** with the four scopes (a)–(d) and, for scope (b), a list of allowed destination account numbers (UC-07). Add a change log for permissions.
4. **Allow transfers by account number** on the Transfer screen, checked against the delegate's scope (UC-04). Restrict Pay and Deposit to owners (UC-05, UC-06).
5. **Add filters to the activity list** (UC-08).
6. **Fix findings 1–4 in section 4.** They are small changes.
7. Re-run `node docs/ui-review/capture.mjs` and use the images in the interim report.
