# Development playbook: from client request to live system

How I (Niel Adrian, freelance developer) build a business web system with an AI coding
agent (Claude Code), from the first client talk to a live Hostinger deployment. Written
while building **Dagohoy Pharmacy** (POS + inventory), my first client, so the next project
can follow the same path and skip the mistakes.

**How to use this file in a new project:** copy it into the new repo's `docs/`, give it to the
agent at the start of the session ("Read docs/DEVELOPMENT_PLAYBOOK.md and follow it"), and
replace the Dagohoy examples with the new client's details as you go.

**Status of this file:** Stages 0–6 are written from what actually happened. Stages marked
*(to fill)* are updated after each phase is done, and the Hostinger stage only after the real
deploy, from what actually worked.

---

## The whole path at a glance

| Stage | What happens | Output |
|---|---|---|
| 0 | Talk to the client, decide the stack and hosting, quote the cost | Notes, decisions, quote |
| 1 | Set up the PC: database, repos, agent context, skills | Two repos that run |
| 2 | Build the UI first with fake data in the browser (design phase) | Clickable app the client can see |
| 3 | Plan the move to a real backend, in phases | `docs/IMPLEMENTATION_PLAN.md` |
| 4 | Real login and accounts | Auth that the server enforces |
| 5 | Database for every feature the UI already has | Migrations + rule checks |
| 6 | Move each page to the API, one area at a time | Pages that save to the database |
| 7 | Seed data, tests, backup, runbook *(to fill)* | Local system "ready" |
| 8 | Buy hosting, deploy to staging, then live *(to fill)* | `DEPLOYMENT.md`, live site |
| 9 | Handover and support *(to fill)* | Owner guide, backups running |

---

## Stage 0: Before writing code

1. **Find out how the business really works.** Who uses it (owner, cashier, staff), one
   shared login or one each, what they do every day, and what reports they need. For Dagohoy:
   one owner, one shared cashier login, and the staff on duty are picked at the start of each
   shift.
2. **Ask about government and tax rules early.** In the Philippines: BIR, VAT-registered or not,
   Senior/PWD 20% discount (record the ID number and name), and official receipts vs
   "not an official receipt". For Dagohoy, the owner said BIR only checks the monthly
   **sales**, so the monthly report is a sales report.
3. **Hardware questions.** Barcode scanner (USB scanners type like a keyboard and press
   Enter), thermal printer width (58 mm or 80 mm), internet backup (pocket WiFi).
4. **Choose web app vs desktop app.** I choose **web app**: the owner can check remotely,
   backups are central, and one deploy updates everyone. The weak point is that it needs
   internet.
5. **Hosting and cost.** My standard: Hostinger (client owns and pays, I get access through
   Account sharing). Quote first-year and renewal prices with VAT. Dagohoy's numbers are in
   the web repo's `CLAUDE.md`.
6. **Write the decisions down** in the repo's `CLAUDE.md` (the agent reads it every session).

## Stage 1: Set up the computer and the repos

- **Two repos side by side:** `<Client>-Web` (React + Vite + TypeScript) and
  `<Client>-Server` (NestJS + TypeScript + raw `mysql2`, no ORM). Work on branch `dev`.
- **Local database must match production.** Hostinger runs **MariaDB**, so install MariaDB
  locally (not MySQL 8). Use its own port if another database is installed (Dagohoy: MariaDB
  on **3307**, old MySQL on 3306).
- **Limited database user** for the app (all rights on its own database only, no SUPER). The
  root password stays with me; the app user's password lives only in the server `.env`.
- **Pick ports that don't clash** with my other projects. Dagohoy's API runs on **3001**
  because other React projects use 3000, 3002 and up. Check first: `netstat -ano | findstr LISTEN`.
- **Agent context files:** `CLAUDE.md` in each repo (who I am, the stack, rules, status, plan),
  and `AGENTS.md` in the server repo (commit after each task, run checks, never commit secrets).
- **Agent skills:** keep them in `.agents/skills/` and copy them to `.claude/skills/` (the
  folder Claude Code reads), then start a new session.
- **Git on Windows:** `core.autocrlf=true`; read the status with
  `git -c core.autocrlf=true status`.

## Stage 2: UI first, with fake data (design phase)

Build every screen with data saved in the browser (`localStorage`) and sample data. The client
can click through the real flow early, and the business rules get discovered before any
database exists.

What we built this way for Dagohoy: landing page, login, POS (scan-or-type search, cart,
payment popup: Cash with change, GCash with reference, utang/credit, no-charge; thermal receipt),
shifts (start with the cashier and staff on duty, opening float, cash in/out, close with a count,
duty report), transactions (receipt reprint, void with a reason, Excel export), products and
stock control (receive, lots and expiry, adjustments, write-offs), suppliers, expenses, credit
accounts, staff, settings, owner overview with charts, and a monthly sales report for BIR.

Rules that worked:
- **One shared component per thing** (one receipt, one control deck, one scan field) so
  every page looks and behaves the same.
- **Plain words on screen** ("Count is different", not "Float variance").
- **A dev-only "Load sample data" button** that simulates weeks of real activity, so every
  report has something to show. It must never be in the live build (`import.meta.env.DEV` and a
  lazy `import()`), and the live build is checked for it.
- **Start fresh** clears all test records before real use.

Weakness to plan for: everything has to be moved to the server later, page by page.
Next time, consider building the login and the database earlier and the UI on top of them.

## Stage 3: Plan the backend move in phases

Write `docs/IMPLEMENTATION_PLAN.md`: what "ready locally" means (a checklist), what exists
today, the decisions with defaults, and phases in order with a "done when" test for each.
One phase at a time, and the app must still run after each one.

Dagohoy's phases: 1 login, 2 database for all features, 3 products/suppliers/staff/settings,
4 stock, 5 shifts and cash drawer, 6 sales, 7 utang and expenses, 8 reports and dashboards,
9 seed data, tests, backup and runbook, 10 a full test day with two browsers.

## Stage 4: Real login first

- **Passwords:** bcrypt (`bcryptjs`, pure JavaScript, so it installs on shared hosting).
- **Sessions:** a random token in an **httpOnly cookie** (`SameSite=Lax`, `Secure` in
  production). Store only a **SHA-256 hash** of the token in a `user_sessions` table. Sessions
  expire after inactivity and can be ended (logout, password change, disabled account).
- **Every API route is private by default** (a global guard). Mark the few public ones
  (`/health`, `/auth/login`) and limit owner-only routes with a roles decorator.
- **Login rate limit** (5 wrong tries per minute per username and address) and the same error
  message for "wrong username" and "wrong password".
- **Refuse changes sent from other sites** (check the `Origin` header on POST/PATCH/DELETE).
- **The owner account is created by a script the client or I run in a terminal**
  (`npm run db:create-owner`). The password is typed hidden; the agent never sees or types it.
- **Web:** pages show only after `GET /auth/me` confirms the session; any 401 goes back to
  login. No passwords or roles are kept in `localStorage`.

## Stage 5: Database for every feature

- **Schema changes only through numbered migration files.** Never edit an applied migration;
  add a new one. The runner stores a checksum and refuses edited files.
- **Put the business rules in the database** as `CHECK` constraints and unique keys, so a bug in
  the API cannot save bad data. Dagohoy examples: only one open shift (a stored column plus a
  unique key), Senior/PWD discount needs an ID number, credit needs a customer, cash must cover
  the total, voids need a reason, total = subtotal − discount.
- **Never edit money or stock history.** Stock is an append-only ledger (`stock_movements`);
  corrections are new adjustment rows. Payments are append-only too; a void adds a negative
  row pointing to the original.
- **Money is DECIMAL** in the database and is rounded to centavos on the server.
- **Scripts that prove it:** `db:verify` (tables, keys, rules exist) and `db:check-rules`
  (tries good and bad rows inside a transaction, then rolls back).
- MariaDB on shared hosting: no triggers or stored procedures (they need SUPER), and use
  `utf8mb4_unicode_ci`.

## Stage 6: Move the pages to the API, one area at a time

- Build the API for one area, test it with real requests (curl) against the dev database, then
  change the web pages for that area.
- **Bridge for pages not moved yet:** after login, copy the server data (products, suppliers,
  staff, settings) into the browser storage the old pages still read. Delete the bridge when
  the last page is moved.
- **The server checks everything again** (barcode already used, price above 0, unit exists,
  role allowed). The form shows the server's message.
- **Price changes keep history** (close the old price, start a new one). Units cannot change
  once a product has stock records.
- Phases 4–10 for Dagohoy: *(to fill as each one is done)*.

## Stage 7: Ready locally *(to fill)*

Checklist from the implementation plan: every page uses the API, two browsers see the same
data, clearing the browser loses nothing, a sale is one transaction, tests pass, backup and
restore tried, `docs/RUNNING_LOCALLY.md` written.

## Stage 8: Hostinger deploy *(to fill after the real deploy)*

Planned order, to be replaced with the steps that actually worked:
1. Client buys Hostinger (12-month term; untick upsells) and shares access with me.
2. Create `staging.` subdomain + its own MariaDB database; check `SELECT VERSION();`, the Node
   versions available, SSH, and how many Node apps the plan allows.
3. Deploy the API as a Node.js app on `api.` (from GitHub), set its `.env` in hPanel, run the
   migrations, check `/api/health` and `db:verify`.
4. Build the web (`npm run build`) and upload only `dist/` to the main domain.
5. Create the owner with the owner script, enter real products (never copy the dev database).
6. Back up before every live migration. Remote database access only from my own IP, removed
   when done.

## Stage 9: Handover *(to fill)*

---

## Working with the AI agent

- **Start of every session:** the agent reads `CLAUDE.md`, the plan and this playbook. Ask it to
  continue "Phase N" so it does not guess.
- **One phase per request,** with a "done when" test. The agent runs the checks (typecheck,
  lint, tests, `db:verify`) and commits when the phase is done.
- **Ask for plain-language, step-by-step explanations** (Bisaya/English is fine).
- **Never let the agent handle real passwords.** Scripts that need a password are run by me in
  my own terminal. The agent can create random test accounts on the local dev database only.
- **Decisions are mine and the client's;** the agent proposes defaults and lists the questions
  to ask the client.
- **Keep this playbook updated after every phase** (lessons, what changed).

## Lessons learned (pitfalls to avoid)

| Problem | What happened | Do this instead |
|---|---|---|
| Port already in use | API would not start: another project used 3000 (and 3002–3005) | Check `netstat` first; give each project its own port |
| Old API still running | New routes returned 404 because a plain `node dist/main` was running, not watch mode | Run the API with `npm run dev` (watch) while developing; restart after big changes |
| Formatter touched everything | Running Prettier on the whole `src` reformatted 45 untouched files | Format only the files you changed |
| Password showed in output | A setup script echoed piped input, so a test password appeared in a log | Scripts must never echo passwords; read piped input silently; regenerate any leaked test password |
| Agent cannot test logged-in pages | The agent may not type passwords (correct) | Test the API with curl and test accounts; I do the final browser login check |
| MariaDB refused a query | `INSERT ... VALUES` with a subquery on the same table | Do a separate `SELECT` first |
| `LIKE '__x%'` matched too much | `_` is a wildcard in SQL `LIKE` | Escape it or use unique test prefixes without `_` |
| Error message hidden | The API sent "Internal server error" with the real message inside `details` | The error filter returns the readable message for 4xx errors |
| Duplicate commit | `git add` stopped on one bad path and the commit took only part of the change | Check `git status` after adding; add files in one correct command |
| Test data in the dev database | Ledger rows cannot be deleted (rule), so test products stay | Use clearly named test rows, hide them, and reset the dev database in the seed phase |

## Project log: Dagohoy Pharmacy

| Date | Phase | Notes |
|---|---|---|
| 2026-11-06 → 11-09 | UI design phase | Full UI on localStorage; sample data button; owner overview and dashboards |
| 2026-11-09 | Local setup | MariaDB 11.4.3 on 3307, `dagohoy_app` user, migrations 000–003 |
| 2026-11-09 | Phase 1 login | Migration 004, bcrypt, cookie sessions, guards, users API, owner script, API port 3001 |
| 2026-11-09 | Phase 2 database | Migration 005 (shifts, payments, utang, expenses, settings…), `db:check-rules` |
| 2026-11-09 | Phase 3 catalog | Migration 006, products/suppliers/staff/settings API, web bridge for POS/stock |
