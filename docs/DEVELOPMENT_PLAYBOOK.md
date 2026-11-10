# Agentic development playbook

My method (Niel Adrian, freelance developer) for building a client's business web system
together with an AI coding agent (Claude Code), from the first meeting to a live, supported
system. It is written for **any** client and any business system (POS, inventory, booking,
clinic, school, ordering…). Dagohoy Pharmacy, my first client, is only the worked example
at the end.

**How to start a new project with it:** copy this file into the new repo's `docs/` folder,
then tell the agent in the first session:

> Read `docs/DEVELOPMENT_PLAYBOOK.md`. We are starting Phase 0 for a new client. Follow the
> playbook, ask me the Phase 0 questions, and keep `CLAUDE.md` updated with the answers.

**Keep it alive:** after every phase of every project, add what you learned to
"Lessons learned". Fill a section only from what really happened, never from a guess.

---

## 1. The idea in one page

- **I decide, the agent builds.** I own the client relationship, the business decisions,
  passwords, payments and anything live. The agent does the hands-on work: code, database
  migrations, checks, tests and commits, and explains every step in plain language.
- **Small phases, one at a time.** Each phase has a clear goal and a "done when" test. The
  system must still run after every phase.
- **Everything written down.** The agent forgets between sessions; the repo does not. The
  decisions, the plan and the status live in files the agent reads at the start
  (see section 4).
- **Rules live in the strongest place.** Business rules go into the database (constraints)
  and the server (validation), not only into the screen.
- **Prove it, don't assume it.** A phase is done when the checks pass and the feature was
  tried for real (API calls, browser), not when the code "looks right".

## 2. The phases

| # | Phase | Goal | Main output |
|---|---|---|---|
| 0 | Discovery and proposal | Understand the business; agree on scope, price, hosting | Notes, scope, quote |
| 1 | Project setup | Repos and a local environment that matches production | Two running repos, `CLAUDE.md` |
| 2 | Clickable prototype | The client sees and approves the screens and the flow | UI with sample data |
| 3 | Technical plan | Turn the prototype into a phased build plan | `docs/IMPLEMENTATION_PLAN.md` |
| 4 | Foundation | Login, roles, security, error handling, health check | Server-enforced auth |
| 5 | Data model | Database for every feature, with the rules inside | Migrations + rule checks |
| 6 | Feature slices (repeat) | One business area at a time, server + screens | Working features on real data |
| 7 | Ready locally | Seed data, tests, backups, a full test day | Runbook, checklist passed |
| 8 | Staging and client testing | Client buys hosting; deploy a test copy; client tries it | `DEPLOYMENT.md`, sign-off |
| 9 | Go-live | Real data, real accounts, backups on | Live system |
| 10 | Handover and support | Owner guide, maintenance, change requests | Support routine |

Each phase below has the same parts: **Goal**, **I do**, **The agent does**,
**Done when**, and a **Prompt** to start it.

---

### Phase 0: Discovery and proposal

**Goal:** know exactly who uses the system, what they do every day, and what they must report.

**I do:**
- Interview the owner and, if possible, watch the staff work for an hour.
- Ask the question list below and write the answers down.
- Choose hosting and quote the first-year and renewal costs (with VAT).
- Agree on scope (what is in version 1, what is later), the price and the payment schedule.

**Questions for every client:**
1. Who uses it? Owner, managers, staff. One shared login or one each? Who may see money?
2. What happens on a normal day, step by step? What happens on a bad day (mistakes,
   returns, refunds, cancellations)?
3. What must they report, and to whom? Taxes and government rules (PH: BIR, VAT-registered
   or not, official receipts, Senior/PWD discount and the ID they must record).
4. What do they use now (paper, Excel, another app)? What data must come over?
5. Hardware: barcode scanner, receipt printer (58/80 mm), tablets, phones?
6. Internet: is it reliable? Backup (pocket WiFi, mobile data)?
7. Who pays for and owns the hosting and the domain? (Client owns, I manage with shared
   access.)

**Regulatory gate (decide before building anything that touches sales or money):**
Find out which government rules apply to the kind of system you will build, and pick the
legal path before Phase 2. In the Philippines, a system that **issues receipts or invoices**
counts as a POS / sales machine: the software must be BIR-accredited and every computer
needs a Permit to Use (RMO 24-2023), with fines per unit and possible closure. Computerized
books used for tax filing must be registered as a CAS. Software that can delete or hide
sales is a serious offense. Options, from least to most work:
1. **Inventory & Sales Record System** (back-office): no receipts printed for customers,
   records cannot be deleted, not the official tax books. The store keeps its own invoices
   and books.
2. The same, registered as a **CAS** if the client wants it to be the official books.
3. An **accredited POS** for the counter plus my system for inventory and reports.
4. **Get my software accredited** (big job, but then it becomes a product I can sell).
Ask the client's accountant or the BIR officer which applies, write down the answer, and
put a line in the contract that tax registration and invoices are the client's
responsibility. Name the system for what it is (never call option 1 a "POS").

**The agent does:** turns my notes into a short scope list and a list of open questions;
drafts the cost table; suggests the stack based on section 5.

**Done when:** the scope, the price and the hosting are agreed, and the answers are in the
repo's `CLAUDE.md`.

**Prompt:**
> Here are my notes from the client meeting: … Turn them into (1) a scope list for version 1,
> (2) open questions for the client, (3) risks. Write the agreed parts into `CLAUDE.md`.

---

### Phase 1: Project setup

**Goal:** the computer is ready and the local setup behaves like production.

**I do:** create the GitHub repos; install the database server (the same kind the host uses);
create the database admin password myself.

**The agent does:**
- Creates the web and server projects, a `dev` branch, `.env.example` files (never real
  secrets in git), lint, format and type-check scripts.
- Creates a **limited database user** (rights on its own database only) for the app.
- Picks **ports that don't clash** with my other projects and writes them down.
- Writes `CLAUDE.md` (both repos) and `AGENTS.md` (server): who I am, the stack, the rules,
  the status and the plan. Installs the agent skills.

**Done when:** both projects start, the health endpoint says "database connected", and a new
agent session can read `CLAUDE.md` and explain the project back to me.

**Prompt:**
> Set up Phase 1 for this project: web + server repos, local database matching the host,
> limited database user, free ports, `.env.example`, checks, `CLAUDE.md` and `AGENTS.md`.
> Tell me every step I must do myself (passwords, installers).

---

### Phase 2: Clickable prototype

**Goal:** the client clicks through the real screens with sample data and says "yes, that is
how we work" before the expensive backend work starts.

**I do:** show the prototype to the client, collect feedback, decide what changes.

**The agent does:**
- Builds every screen with sample data stored in the browser.
- Keeps **all data access in a few small "store" files** (not spread across pages), so they
  can later be swapped for API calls without touching every page.
- Uses one shared component per thing (receipt, form popup, table, scan field) so the whole
  app looks the same.
- Uses plain words on screen, big obvious buttons, and clear error messages.
- Adds a **dev-only "Load sample data"** button that simulates weeks of real activity
  (never in the live build).

**Done when:** the client approves the flow; every screen in scope exists.

**Keep it short.** The prototype is for agreement, not for real use. The longer it lives
on browser storage, the bigger the later move to the server.

**Prompt:**
> Phase 2: build the screen for <feature> with sample data in the browser. Keep its data in
> one store file. Use the shared components. Show me in the browser when done.

---

### Phase 3: Technical plan

**Goal:** a written plan that turns the prototype into a real system, phase by phase.

**The agent does:** writes `docs/IMPLEMENTATION_PLAN.md` with:
- **"Ready locally" checklist** (what must be true before deploying);
- **Where we are** (each area: screen done? database? API?);
- **Decisions with defaults** (login type, money format, roles…) and **questions for the
  client**;
- **Phases in order**, each with "done when" and size; usually: foundation → data model →
  master data (products, customers, staff, settings) → stock or bookings → transactions
  (sales, payments) → money handling (shifts, cash, credit) → reports → hardening.

**I do:** read it, change the decisions I disagree with, ask the client the open questions.

**Done when:** I approve the plan.

**Prompt:**
> Phase 3: write `docs/IMPLEMENTATION_PLAN.md` to make this system ready locally. Include the
> ready checklist, the current state, decisions with defaults, client questions, and phases
> with "done when". Don't write code yet.

---

### Phase 4: Foundation (login and security)

**Goal:** real accounts and a server that protects every route.

**The agent does (standard recipe):**
- Passwords hashed with **bcrypt** (pure-JavaScript `bcryptjs` installs anywhere).
- Sessions: random token in an **httpOnly cookie** (`SameSite=Lax`, `Secure` live); only a
  hash of the token stored in the database; expiry after inactivity; logout ends it.
- **Every API route private by default**; a few marked public (health, login); roles limit
  owner-only routes.
- Login rate limit, the same message for wrong user or wrong password, refuse write requests
  from other sites (Origin check).
- One readable error format the screens can show.
- The first owner account is created by a **script I run myself**; the password is typed
  hidden. The agent never sees or types real passwords.
- Screens: show workspace pages only after the server confirms the login.

**Done when:** a wrong password is refused by the server; a lower role cannot open owner
pages even by typing the address; logout ends the session; tests for these pass.

**Prompt:**
> Phase 4: real login and roles following the playbook recipe. Give me the owner-setup
> command to run myself. Test it with the API and tell me what I must check in the browser.

---

### Phase 5: Data model

**Goal:** a database that can hold every feature in scope and refuses bad data by itself.

**The agent does:**
- Schema only through **numbered migration files**; never edits an applied one.
- **Rules as database constraints:** required fields, unique keys, amounts not negative,
  "only one open X at a time", "a discount needs an ID", "a void needs a reason".
- **History is never edited:** stock, payments and other money records are append-only;
  corrections are new rows (adjustment, reversal).
- Money as `DECIMAL`, rounded on the server. Dates and times stored consistently.
- Shared hosting safe: no triggers or stored procedures that need admin rights; a character
  set and collation the host supports.
- Two scripts: **verify** (the expected tables, keys and rules exist) and **check-rules**
  (tries good and bad rows in a transaction, then rolls back).

**Done when:** migrations apply on a fresh database and re-run safely; verify and check-rules
pass.

**Prompt:**
> Phase 5: design the migrations for every feature in the plan. Put the business rules into
> the database. Add verify and check-rules scripts. Explain each table to me simply.

---

### Phase 6: Feature slices (repeat for each business area)

**Goal:** one area at a time works end to end on real data.

**The loop for each slice:**
1. **API:** endpoints for the area, with server-side validation (never trust the screen),
   role checks, and transactions for anything that changes several tables.
2. **Prove the API:** unit tests for the rules + real calls against the dev database
   (good and bad cases).
3. **Screens:** replace that area's browser store with API calls; show loading and the
   server's error messages.
4. **Bridge if needed:** pages not moved yet can read a synced browser copy; delete the bridge
   when the last page is moved.
5. **Try it:** in the browser, with two browsers when it matters (same data on both).
6. **Commit, update the plan and this playbook.**

**Typical order:** master data (products, customers, suppliers, staff, settings) → stock or
schedule → the main transaction (sale, booking, order) → money handling (shifts, cash,
credit, refunds) → reports and dashboards.

**For the main transaction:** one database transaction for the whole thing (check prices
on the server, lock and allocate stock, write the ledger, write payments, give a number).
Test two people doing it at the same time on the last item.

**Done when (per slice):** the "done when" line in the implementation plan is true.

**Prompt:**
> Phase 6, slice "<area>": build the API with validation and tests, prove it with real calls,
> then move the screens to it. Tell me what to check in the browser.

---

### Phase 7: Ready locally

**Goal:** the whole system works locally like it will live.

**The agent does:**
- Server-side **seed script** (realistic sample data through the same rules as the API) and a
  safe **reset** for the dev database only.
- Removes the browser stores and the prototype-only buttons.
- **Automated tests** for the risky parts (login, the main transaction, money totals, voids,
  concurrency).
- **Backup and restore** commands, tried once.
- `docs/RUNNING_LOCALLY.md`: how to start everything from zero.

**I do:** a **full test day** with two browsers, acting as the staff and the owner, every
payment type and every mistake case; then clear the browsers and check nothing is lost.

**Done when:** every item on the "ready locally" checklist is checked.

---

### Phase 8: Staging and client testing

**Goal:** a real online copy the client tests before going live.

**I do:** ask the client to buy the hosting plan (they own it) and share access with me;
set the server environment variables myself in the host panel; invite the client to test.

**The agent does:** writes the step list for the host, then `docs/DEPLOYMENT.md` **from what
actually worked**: create `staging.` subdomain and its own database, check the database and
Node versions, deploy the API from GitHub, run migrations, check health and verify, upload
only the web build, run the owner script.

**Done when:** the client tested a full day on staging and signed off.

**Rules:** ask before every action on a live account; back up before every migration; remote
database access only from my own address and removed after.

---

### Phase 9: Go-live

**Goal:** the real system with real data.

- Same deploy steps on the main domain with a **fresh** database (never copy the dev or
  staging database with test data).
- Import or type only real data (products, prices, real accounts).
- Daily backups confirmed; a restore tried once.
- Stay available for the first days of real use.

---

### Phase 10: Handover and support

- A short **owner guide** (how to do the daily tasks, who to call).
- Maintenance routine: backups, updates, renewal dates of hosting and domain.
- Change requests: each one becomes a small new phase-6 slice with a quote.
- Update this playbook with the lessons from the project.

---

## 3. The working loop for every agent request

1. **Context:** the agent reads `CLAUDE.md`, the implementation plan and this playbook.
2. **One clear request:** "Phase N" or "slice X", with what done looks like.
3. **Plan out loud:** the agent lists the steps before changing files.
4. **Smallest complete change:** no extra features nobody asked for.
5. **Checks:** type-check, lint, tests, database verify.
6. **Real proof:** API calls and/or the browser, good and bad cases.
7. **Commit** (and push if that is the project rule) with a clear message.
8. **Report:** what changed, how it was checked, what was not checked, what I must do.
9. **Update the docs:** plan status, `CLAUDE.md` status, playbook lessons.

## 4. Documents every project has

| File | Where | Purpose |
|---|---|---|
| `CLAUDE.md` | each repo | Who I am, the client, the stack, rules, status, plan (the agent reads it first) |
| `AGENTS.md` | server repo | Rules for any agent: commit after each task, run checks, no secrets |
| `docs/IMPLEMENTATION_PLAN.md` | web repo | Phases, decisions, "ready" checklist, progress |
| `docs/DEVELOPMENT_PLAYBOOK.md` | web repo | This method (copied into every project) |
| `database/README.md` | server repo | Migrations and database scripts |
| `docs/RUNNING_LOCALLY.md` | web repo | Start everything on a new computer |
| `docs/DEPLOYMENT.md` | web repo | The real deploy steps that worked |
| Owner guide | for the client | Daily tasks in plain words |

## 5. My default technical choices (change per client if needed)

- Web app, not desktop: owner can check remotely, central backups, one update for everyone.
- Front end: React + Vite + TypeScript. Back end: NestJS + TypeScript, raw SQL (`mysql2`),
  SQL migration files. Database: MariaDB (same as the host).
- Hosting: Hostinger web hosting with Node.js apps; web build on the main domain, API on
  `api.`, test copy on `staging.`; the client owns the account, I manage it with shared access.
- Security: bcrypt, httpOnly cookie sessions, private-by-default API, roles, rate limit.
- Money: `DECIMAL`, server rounding; history append-only.

## 6. Safety rules (always)

- The agent never types my or the client's passwords, never handles payment details, and
  asks before anything on a live database or hosting account.
- Secrets only in `.env` files that are never committed.
- Schema only through migrations; back up before every live migration.
- Never copy a development database (test data) to live.
- Remote database access only from my own address, removed when not needed.

## 7. Lessons learned (all projects)

| Problem | What happened | Do this instead |
|---|---|---|
| Built a "POS" before checking the law | A POS developer warned that receipt-issuing systems need BIR accreditation and a permit per computer, with fines per unit | Do the regulatory gate in Phase 0; for small clients start as an Inventory & Sales Record System with no customer receipts |
| Long prototype on browser storage | Every page later had to be moved to the API, with a temporary bridge | Keep the prototype short; keep data access in a few store files; build login and the database early |
| Port already in use | The API would not start because another project used the port | Check free ports at setup; give each project its own and write it in `CLAUDE.md` |
| Old server still running | New routes returned 404: a plain (non-watch) server kept running old code | Develop with the watch mode server; restart after big changes |
| Formatter touched everything | Formatting the whole folder changed dozens of unrelated files | Format only the files that changed |
| Password in a log | A setup script echoed piped input | Scripts never echo passwords; regenerate any test password that leaked |
| Agent cannot test logged-in screens | It must not type passwords (correct) | The agent proves the API with test accounts; I do the final browser login check |
| Database refused a query | MariaDB refuses an insert that reads the same table in a subquery | Select first, then insert |
| SQL `LIKE` matched too much | `_` is a wildcard | Escape it, or use test prefixes without `_` |
| Hidden error messages | The API returned "Internal server error" with the real reason buried | One error format with a readable message for user mistakes |
| Half a commit | `git add` stopped on one bad path, the commit took only part | Check `git status` after adding |
| Testing needs a login the agent may not type | The owner and cashier passwords belong to me | The agent makes a temporary test admin with a random password in the dev database, uses it, then removes it |
| Test rows that cannot be deleted | Ledger rows are never deleted (by design) | Name test rows clearly, hide them, and reset the dev database in Phase 7 |

---

## Appendix: Dagohoy Pharmacy (first client) as the example

Internal POS and inventory system: one owner, one shared cashier login (the staff on duty are
picked at Start shift), barcode scanner, thermal receipts, GCash, utang (credit), shifts and
cash drawer, BIR monthly sales report (the BIR checks only the monthly sales).

| Date | Playbook phase | What happened |
|---|---|---|
| 2026-11-06 → 11-09 | 0–2 | Scope, Hostinger quote, full clickable prototype on browser storage with sample data |
| 2026-11-09 | 1 | MariaDB locally (port 3307), limited app user, API on port 3001 |
| 2026-11-09 | 3 | `docs/IMPLEMENTATION_PLAN.md` (10 phases) |
| 2026-11-09 | 4 | Real login: bcrypt, cookie sessions, guards, users API, owner script (migration 004) |
| 2026-11-09 | 5 | Tables and rules for shifts, payments, utang, expenses, settings (migration 005, check-rules) |
| 2026-11-09 | 6, slice 1 | Products, suppliers, staff roster, settings on the server (migration 006) |
| 2026-11-10 | 0 (late) | BIR check: renamed to "Inventory & Sales Record System", "POS" labels became "Sales Counter", no customer receipts (on-screen internal sales record only), monthly report marked internal. Owner to confirm with the BIR officer |
| 2026-11-10 | 6, slice 2 | Stock on the server: deliveries (one purchase per supplier receipt no.), lots, adjustments and returns with FEFO and row locks; the test used a temporary admin account that was removed after |
| next | 6 | Shifts, sales, utang and expenses, reports |
