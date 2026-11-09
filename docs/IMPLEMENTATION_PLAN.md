# Implementation plan: system ready locally

Goal: Dagohoy Pharmacy runs fully on this PC. The web app (React, port 5173) talks to the
API (NestJS, port 3000), and every record lives in MariaDB (`dagohoy_pharmacy_dev`, port 3307).
Nothing important stays in the browser's localStorage anymore.

Written 2026-11-09. Both repos: `Dagohoy-Pharmacy-Web` and `Dagohoy-Pharmacy-Server`, branch `dev`.

## "Ready locally" means

1. Login is real: passwords checked by the server (bcrypt), sessions in an httpOnly cookie,
   owner and cashier roles enforced by the server, not by the browser.
2. Every page reads and writes MariaDB through the API. Clearing the browser loses nothing.
3. Two browsers at the same time (cashier PC + owner laptop) see the same data.
4. A sale is saved as one database transaction: price check, FEFO lot allocation, stock
   movements, payment, shift link. If any part fails, nothing is saved.
5. Stock is never edited directly. It is the sum of `stock_movements` (append-only ledger).
6. `npm run db:migrate` and `npm run db:verify` pass on a fresh database.
7. A dev seed fills the database with sample data (the same 45-day simulation as the
   current "Load sample data" button), and a clean reset is one command.
8. Automated tests cover the risky parts: login, sale posting, FEFO, void, shift cash totals.
9. A backup command (`mysqldump`) exists and a restore was tried once.
10. A short runbook explains how to start everything.

## Where we are today

| Area | Web | Server / database |
|---|---|---|
| Login, accounts, roles | localStorage, SHA-256 in the bundle | `users` (email), `roles`, `user_roles`. No API |
| Products, categories, units, prices | localStorage, one price per product | Tables exist (units, effective-dated prices, barcodes). Barcode lookup API only |
| Lots, receive stock, adjustments | localStorage | `batches`, `purchases`, `purchase_item_batches`, `stock_movements`, `vw_batch_inventory`. No API |
| Sales, payments, voids, no-charge | localStorage | `sales`, `sale_items`, `sale_item_allocations`. No payment, discount, shift or void columns |
| Shifts, cash in/out, duty reports | localStorage | Nothing |
| Utang (credit), customers | localStorage | Nothing |
| Expenses, staff roster, settings | localStorage | Nothing |
| Reports, dashboards | Computed in the browser | Nothing |

## Decisions (defaults chosen; change them before Phase 2 if the client says otherwise)

| Question | Default in this plan | Why |
|---|---|---|
| Login with username or email? | **Username** (as the web has now). `users.email` becomes optional | The shop has no staff emails; the UI is already built for usernames |
| Session type | **Server session**: random token in an httpOnly cookie, stored hashed in a `user_sessions` table, 12-hour expiry | Can be revoked (log out everywhere), no token in localStorage, works on `example.com` + `api.example.com` |
| Password hash | **bcryptjs** (pure JS) | No native build step, so it installs on Hostinger without trouble |
| Shared cashier account | Keep **one cashier login**; who is on duty is picked at Start shift (staff roster) | Matches how the shop works and the UI we built |
| Senior/PWD discount | Discount type on the sale: `none`, `manual_percent`, `senior`, `pwd`. Senior/PWD stores the **ID number and name** | Required for the senior/PWD sales book. VAT exemption fields added but unused until the client confirms VAT status |
| VAT | Store not VAT-registered for now (no VAT lines on receipt) | Unconfirmed. Ask the client (see below) |
| Receipt | Stays "This is not an official receipt" | Official receipts need BIR registration, out of scope |
| Web data fetching | **TanStack Query** (one dependency) | Caching, refetch after a save, loading and error states for every page without writing it 20 times |

Ask the client: (1) Is the store VAT-registered? (2) For Senior/PWD sales, do they record
the ID number and name in a booklet today? (3) Thermal printer width: 58 mm or 80 mm?

## Phases

Each phase ends with: checks pass (`typecheck`, `lint`, tests, `db:verify`), the feature tried
in the browser, a commit in each repo touched. One phase at a time, in order.

### Phase 1: Real login and accounts (server + web)

Server
- Migration `004_auth_usernames_sessions.sql`: `users.username` (unique), `users.email`
  nullable, `user_sessions` (token hash, user, expires, last seen, user agent).
  Roles seeded: `ADMIN`, `CASHIER`.
- `auth` module: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  Login rate limit (5 tries per minute per username + IP). Same error for wrong user or password.
- Global `AuthGuard` + `@Roles('ADMIN')` decorator. Every route is private unless marked public
  (`/health`, `/auth/login`).
- `users` module (owner only): list, create, change role/status, reset password. The built-in
  owner cannot be disabled.
- Lock `POST /products/ai-category-suggestions` to ADMIN.
- Script `npm run db:create-owner`: asks for the owner's password in the terminal (you type it,
  I never see it), stores the bcrypt hash.
- CORS with credentials for `http://localhost:5173`.

Web
- `apiClient` sends `credentials: 'include'`; on 401 it goes to /login.
- Login page calls the API. `AdminRoute`/`ProtectedRoute` ask `/auth/me` instead of trusting
  localStorage. Remove the SHA-256 hash and `accountStore` password logic from the bundle.
- Staff → Accounts uses the users API.

Done when: wrong password is refused by the server; cashier cannot open owner pages even by
typing the URL or editing localStorage; logout ends the session.

### Phase 2: Database for everything the web already does

Migration `005_operations.sql` (MariaDB 10.6-safe, no triggers or procedures):
- `products`: `display_name`, `reorder_point` (optional per product). Category stays
  `product_categories`.
- `stock_movements`: add `reason`, `reference`; movement types add `supplier_return`,
  `customer_return`.
- `purchases`: status adds `ordered` (purchase orders); `purchase_items` used for receiving.
- `staff` (roster names, active flag).
- `shifts` (opened/closed at, opened/closed by user, opening float, carried-over float,
  adjustment reason, expected cash, counted cash, variance note) and `shift_staff`
  (shift, staff, is_cashier).
- `cash_events` (shift, type `paid_in`/`paid_out`, amount, reason, time, user).
- `customers` (name, phone, notes) for utang.
- `sales` adds: `shift_id`, `cashier_name`, `customer_id`, `subtotal`, `discount_type`,
  `discount_percent`, `discount_amount`, `discount_id_number`, `discount_holder_name`,
  `total`, `payment_method` (`cash`, `gcash`, `credit`, `no_charge`), `amount_tendered`,
  `change_due`, `gcash_reference`, `gcash_confirmed_at`, `no_charge_reason`,
  `void_reason`, `voided_at`, `voided_by`.
- `sale_payments` (sale, shift, method, amount, time, user): the down payment and every later
  utang payment. Balance = total − payments, never stored twice.
- `expenses` (date, category, description, payment method, amount, user).
- `store_settings` (one row: name, address, phone, email, hours, low-stock threshold,
  GCash number, GCash QR image path).
- Update `verify-schema.cjs` for the new tables, keys and checks.

Done when: fresh database migrates 000→005 cleanly, re-run skips, `db:verify` passes, also
tested with the limited `dagohoy_app` user (no SUPER).

### Phase 3: Products, suppliers, staff, settings (API + wire the pages)

- `GET/POST/PATCH /products` (list with on-hand from `vw_batch_inventory`, status, latest cost,
  current price), barcode uniqueness checked by the server, price change = new
  `product_prices` row (history kept).
- `GET /products/lookup?q=` for the type-or-scan field (name, generic, barcode).
- Categories, suppliers, staff roster, store settings endpoints.
- Web: Products list + New/Edit product form, Suppliers, Staff roster, Settings read and
  save through the API. ScanInput/ProductPicker search through the API.

Done when: a product added on one browser appears on another; duplicate barcode is refused by
the server, not only by the form.

### Phase 4: Stock (receive, lots, adjustments, movements)

- `POST /stock/receive`: one transaction creates the purchase, batch (or adds to the same
  lot), `purchase_item_batches`, a `purchase` movement, optional new selling price.
- `POST /stock/adjustments`: adjustment, damaged, expired, supplier return, customer return.
  Refuses to take more than a lot has.
- `GET /stock/lots` (expiry check: expired / sell first / watch), `GET /stock/movements`
  (filters by product, type, date), purchase orders CRUD.
- Web: Stock control center (receive, health, expiry, lots, order, return, adjustments),
  Stock movements page.

Done when: receive 10 → on hand +10; adjust −3 → +7 shown everywhere; the ledger shows both
and nothing was updated in place.

### Phase 5: Shifts and cash drawer

- `POST /shifts/start` (staff on duty, opening float = last counted cash unless adjusted with a
  reason), `GET /shifts/current`, `POST /shifts/current/cash-events`,
  `POST /shifts/current/close` (expected cash computed by the server, counted cash, note),
  `GET /shifts` + `GET /shifts/:id/report` (the duty report data).
- Only one open shift at a time (enforced by the server).
- Web: Start shift / Close shift popups, Cash drawer page, Shift / Duty reports, top bar status.

Done when: two browsers cannot both start a shift; expected cash matches a hand count of a
test shift.

### Phase 6: Sales (the core)

- `POST /sales`: one DB transaction. The server re-reads prices (the browser's price is not
  trusted), checks the open shift, allocates lots FEFO with `SELECT … FOR UPDATE`, writes
  `sale_items`, `sale_item_allocations`, `sale` movements, `sale_payments`, receipt number.
  Refuses if stock is short. Handles cash (tendered/change), GCash (reference, pending or
  confirmed), credit (customer, down payment), no-charge (reason, owner only or with reason),
  Senior/PWD (ID + name).
- `POST /sales/:id/void`: reason required, `void_reversal` movements back to the same lots,
  payments reversed; cannot void twice.
- `POST /sales/:id/confirm-gcash`, `GET /sales` (today, 7 days, 30 days, search),
  `GET /sales/:id` (receipt data).
- Receipt numbers from the database (no `Date.now()` collisions).
- Web: POS (scan, cart, payment popup, receipt), Transactions (list, receipt, void, Excel).

Done when: two cashiers selling the last 1 piece at the same time → one succeeds, one gets
"not enough stock"; a void puts the stock back to the same lot.

### Phase 7: Utang and expenses

- `GET /customers` with balances, `POST /sales/:id/payments` (utang collection, added to the
  open shift's cash), rename/merge customer.
- Expenses CRUD with month and category views.
- Web: Credit accounts and Expenses pages.

### Phase 8: Reports and dashboards

- `GET /reports/overview` (today vs yesterday, month, utang, stock value, low stock, expiring),
  `GET /reports/hourly?days=7`, `GET /reports/monthly-sales?month=` (per day, for BIR),
  best sellers, payment mix. Computed with SQL on the server.
- Web: owner Overview, cashier Dashboard, Reports, Monthly sales Excel/PDF from API data.

### Phase 9: Dev seed, cleanup, tests, backup, runbook

- `npm run db:seed:dev`: ports the 45-day simulation to the server and writes through the same
  services as the API (so seeded data obeys every rule). `npm run db:reset:dev` drops and
  recreates the dev database (refuses to run unless `NODE_ENV=development` and the DB name ends
  in `_dev`).
- Remove the localStorage stores, `FRESH_START_KEYS`, and the browser "Load sample data" button.
  Settings → Start fresh becomes an owner action on the server (dev only for now).
- Tests (Jest, against a separate `dagohoy_pharmacy_test` database): login and roles, sale
  posting, FEFO across two lots, short stock, void, shift expected cash, utang balance.
- `npm run db:backup` (mysqldump to `backups/`, gitignored) and a restore test.
- `docs/RUNNING_LOCALLY.md`: start MariaDB, `npm run dev` in both repos, create owner, seed.

### Phase 10: Local acceptance run

Walk through one full store day with two browsers: start shift → receive stock → 20 sales of
every payment type → void one → utang payment → paid out → close shift → owner checks Overview,
Reports, Duty report, Monthly sales Excel. Clear both browsers' data and confirm nothing is lost.
Fix what breaks, then plan step 8 (Hostinger staging).

## Order and rough size

| Phase | Size | Depends on |
|---|---|---|
| 1 Login | Medium | — |
| 2 Migration 005 | Medium | 1 (users) |
| 3 Products etc. | Medium | 2 |
| 4 Stock | Medium | 3 |
| 5 Shifts | Medium | 2 |
| 6 Sales | Large | 3, 4, 5 |
| 7 Utang, expenses | Small | 6 |
| 8 Reports | Medium | 6, 7 |
| 9 Seed, tests, backup | Medium | all |
| 10 Acceptance | Small | all |

## Risks

- **Big refactor of the web**: pages read localStorage synchronously today. Each page moves to
  API hooks with loading and error states. Done page by page so the app always runs.
- **Old browser data is not migrated** into MariaDB. It is test data (CLAUDE.md: never carry
  test data into real use). Real products are entered fresh or imported from a list later.
- **Internet/server down at the counter**: once wired, the POS needs the API. Locally it is the
  same PC; online it needs internet (backup pocket WiFi, as advised).
- **Money math**: amounts as DECIMAL in the database and rounded to centavos on the server only.
