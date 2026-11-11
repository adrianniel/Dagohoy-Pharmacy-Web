# Hostinger staging: deploy checklist (DRAFT)

Written 2026-11-10, **before** the client bought Hostinger. Nothing here is tested on Hostinger
yet. Follow it step by step on the first staging deploy, fix what is wrong, then turn it into
`docs/DEPLOYMENT.md` from what really worked (and update the playbook).

Layout (from CLAUDE.md): web `dist/` on the domain, API as a Hostinger **Node.js app** on an
`api.` subdomain, Hostinger **MariaDB**, HTTPS. Staging first, on its own subdomains and its own
database, so the owner can try it before real use.

| Part | Staging | Live (later) |
|---|---|---|
| Web | `staging.YOUR-DOMAIN.com` | `YOUR-DOMAIN.com` |
| API | `api-staging.YOUR-DOMAIN.com` | `api.YOUR-DOMAIN.com` |
| Database | name ending in `_staging` | name **not** ending in `_dev`, `_test` or `_staging` |

## 0. Before you start

- [ ] Owner bought **Hostinger Unlimited** (12 months), domain chosen, and gave you access
      (hPanel → Profile → **Account sharing**).
- [ ] You have the BarCloud key ready (regenerated after the `contributedBy` leak).
- [ ] Both repos are pushed (`dev`), `npm test` and `npm run test:db` pass locally.
- [ ] A fresh local backup exists: `npm run db:backup` (server folder).

## 1. Find out what this Hostinger plan gives (write the answers down)

- [ ] hPanel → **Websites** → the site → **Node.js**: is it there on Unlimited? How many apps?
      Which **Node versions** can be picked? (Local is v24; the server needs Node 20+.)
- [ ] Can the Node.js app deploy **from GitHub** with a build command, or only by upload?
- [ ] Is **SSH** available on this plan? (Needed to run `npm run db:migrate` there.)
- [ ] hPanel → **Databases** → create the staging DB, then phpMyAdmin → `SELECT VERSION();`.
      Must be MariaDB 10.6+ (migrations were tested on 10.11 and 11.4).
- [ ] Do the **SSL** certificates cover `staging.` and `api-staging.`? Turn on **Force HTTPS**.

## 2. Database (staging)

- [ ] hPanel → Databases: create database `…_dagohoy_staging` and its user with a long random
      password (store it in your password manager, not in chat or git).
- [ ] Note the host, port (usually 3306), database name and user exactly as hPanel shows them.

## 3. API (Node.js app on `api-staging.`)

- [ ] Create the subdomain `api-staging` and the Node.js app pointing at the server repo
      (`Dagohoy-Pharmacy-Server`, branch `dev` for staging).
- [ ] Build command: `npm ci --include=dev && npm run build`. Start file / command:
      `dist/main.js` (`npm start` runs `node dist/main.js`). `--include=dev` matters: with
      `NODE_ENV=production`, plain `npm ci` skips the build tools (Nest CLI, TypeScript) and the
      tools the database scripts use (ts-node for the seed).
- [ ] Create the server `.env` **on Hostinger** (File Manager or SSH), never in git:

  ```
  NODE_ENV=production
  PORT=            # only if Hostinger does not give one
  DB_HOST=…        # from hPanel
  DB_PORT=3306
  DB_NAME=…_dagohoy_staging
  DB_USER=…
  DB_PASSWORD=…
  DB_CONNECTION_LIMIT=10
  CORS_ORIGIN=https://staging.YOUR-DOMAIN.com   # exact address; the API refuses to start with * in production
  BARCODE_LOOKUP_ENABLED=true
  BARCODE_API_URL=https://api.barcloud.ph
  BARCODE_API_KEY=…
  BARCODE_DAILY_LIMIT=200
  BILLING_START=YYYY-MM          # first billed month; leave empty until the plan starts
  BILLING_MONTHLY_FEE=1000
  BILLING_QR_FILE=private/billing-qr.png
  BILLING_REVIEW_KEY=…           # 32+ random characters, only you know it
  ```

- [ ] Upload your GCash QR picture to `private/billing-qr.png` in the app folder (File Manager).
      It is not in git. Then open `https://api-staging.YOUR-DOMAIN.com/api/billing/review`, type
      the review key, and save it in your phone's password manager.

- [ ] Over SSH, in the app folder: `npm run db:migrate`, then `npm run db:verify` (all OK).
- [ ] `npm run db:create-owner` (you type Jeanette's username and password; it is hidden).
- [ ] Optional demo data: `npm run db:reset:dev` then `npm run db:seed:dev` (allowed only because
      the name ends in `_staging`; the live database refuses both).
- [ ] Open `https://api-staging.YOUR-DOMAIN.com/api/health`: `"database":"connected"`.

## 4. Web (static files on `staging.`)

- [ ] Locally, in the web folder: copy `.env.production.example` to `.env.production` and set
      `VITE_API_BASE_URL=https://api-staging.YOUR-DOMAIN.com/api`.
- [ ] `npm run build`. Upload **the contents of `dist/`** (including the hidden `.htaccess`) to
      the `staging` subdomain's `public_html`. Do not upload `node_modules` or the source.
- [ ] Open `https://staging.YOUR-DOMAIN.com/cashier/pos` directly: the page loads (the
      `.htaccess` sends deep links to the app), not a 404.

## 5. Check it works

- [ ] Log in as the owner. Create the cashier account (Staff), add the staff roster names.
- [ ] Cashier login in a second browser: start shift, scan or search a product, sell with cash,
      GCash and utang, void one, cash out with a category, close the shift.
- [ ] Owner: Overview, Reports → Monthly sales (Excel and PDF download), Duty reports, Expenses,
      Credit accounts.
- [ ] Times are right (Philippine time) on the sales list and duty report.
- [ ] Clear the browser data, log in again: nothing is lost.
- [ ] Back up the staging DB (phpMyAdmin → Export) and note where Hostinger's daily backup is.

## 6. After it works

- [ ] Write `docs/DEPLOYMENT.md` from what you really did (the real menu names, versions, paths).
- [ ] Update `docs/DEVELOPMENT_PLAYBOOK.md` (stage notes, lessons, project log) and CLAUDE.md
      (Node and MariaDB versions; then pin Node in `package.json` `engines`).
- [ ] Remote MySQL: only your own IP if you used it, and remove it when done.

## Going live later (not now)

New database (name not ending in `_staging`), the same steps, live subdomains, **no seed**,
only real products and accounts. Back up before every migration.
