# Deployment: what actually worked (Hostinger, 2026-11-13)

The live Dagohoy Pharmacy system was deployed this way on the first try that worked. Use it as
the recipe for the next deploy and for future clients. `docs/DEPLOY_CHECKLIST.md` is the older
plan; where the two differ, this file is right.

| Part | Address | Hostinger type |
|---|---|---|
| Web (owner and cashier) | https://dagohoypharmacy.boncales.com | Node.js web app, Vite preset |
| API | https://api-dagohoypharmacy.boncales.com (`/api/health`) | Node.js web app, NestJS preset |
| Database | `u885578654_dagohoy` (MariaDB **12.3.3**) | Hostinger MySQL, assigned to the API site |

Plan: **Unlimited Web Hosting** (PH name of the tier with Node.js web apps; Single and Premium
have none). Node **22.x**. No staging for now: deployed straight to live with an empty database.

## 0. Before you start

- The client buys the plan on **their own** account, claims the free domain there, and gives
  you **Admin** access (Profile → Account sharing). You work from your own login.
- Hostinger's API plugin for Claude Code (`hostinger@claude-plugins-official`) reads the shared
  plan: websites, deployments, databases. It was used read-only to check each step.
- GitHub deploy is **disabled under shared access** ("while managing clients"). Upload zips.

## 1. Make the upload zips (on the laptop)

Only committed files go in, so no `.env`, no `node_modules`, no private files:

```bash
# Web: the API address is built into the files, so it goes in as .env.production
cd Dagohoy-Pharmacy-Web
echo VITE_API_BASE_URL=https://api-dagohoypharmacy.boncales.com/api > .env.production
git archive --format=zip --add-file=.env.production -o deploy/dagohoy-web.zip HEAD
del .env.production

# API: the committed files, plus the GCash QR from private/ (never in git)
git -C ../Dagohoy-Pharmacy-Server archive --format=zip -o deploy/dagohoy-api.zip HEAD
python -c "import zipfile; z=zipfile.ZipFile('deploy/dagohoy-api.zip','a'); z.write('../Dagohoy-Pharmacy-Server/private/qrcode.jpg','private/qrcode.jpg')"
```

`deploy/` is listed in `.git/info/exclude`, so it stays local.

## 2. Web site

hPanel → Create a new site → **Deploy your web app → Upload your files** → `dagohoy-web.zip`.

- **Check the domain** at the top of "Review build settings". It first said `boncales.com`;
  it must say `dagohoypharmacy.boncales.com`.
- Preset **Vite**, Node **22.x**, build `npm run build`, output `dist` (the defaults).
- It asked for `VITE_API_BASE_URL`: the same value as in the zip.
- Build took about 2 minutes. The `html2canvas-pro wants Node 24` line is only a warning.

## 3. API site

Same flow with `dagohoy-api.zip`, domain `api-dagohoypharmacy.boncales.com`, preset **NestJS**,
Node 22.x, entry `dist/main.js`. Environment variables: **Import .env** from a local file
(`deploy/api.env`, never committed), then delete the **PORT** row (Hostinger gives the port).

```
NODE_ENV=production
NPM_CONFIG_INCLUDE=dev            # without it NODE_ENV=production skips the build tools and the build fails
DB_HOST=127.0.0.1                 # the app reaches MySQL locally; srvNNNN.hstgr.io is for outside only
DB_PORT=3306
DB_NAME=u885578654_dagohoy
DB_USER=u885578654_dagohoy
DB_PASSWORD=…                     # you type it
DB_CONNECTION_LIMIT=10
CORS_ORIGIN=https://dagohoypharmacy.boncales.com
BARCODE_LOOKUP_ENABLED=true
BARCODE_API_URL=https://api.barcloud.ph
BARCODE_API_KEY=…                 # you type it
BARCODE_DAILY_LIMIT=300
BARCODE_SETUP_LIMIT=3000          # stock-encoding days only...
BARCODE_SETUP_UNTIL=2026-11-18    # ...up to and including this day, then 300 by itself
BILLING_START=2026-12             # November 2026 was paid in person
BILLING_DUE_DAY=13                # went live on Nov 13: first payment Dec 13, then every 13th
BILLING_MONTHLY_FEE=800
BILLING_FREE_SCANS=0
BILLING_QR_FILE=private/qrcode.jpg
BILLING_REVIEW_KEY=…              # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Hostinger runs **only the build output** (`dist/`), so files beside it in the zip are not there
at run time. The QR first showed "not set up yet" for this reason; the build now copies
`private/` into `dist/private/`.

Right after the deploy `/api/health` answered `"database":"unavailable"`: expected before the
database exists.

## 4. Database

API site → **Databases → Hostinger MySQL → Create**: name `dagohoy`, user `dagohoy`. The
password needs an **uppercase letter** (and lower case and a digit). If it differs from the one
imported in step 3, change `DB_PASSWORD` under Environment variables and **Redeploy**.
`/api/health` then answered `"status":"ok","database":"connected"`.

## 5. Migrations and the owner, from the laptop

1. Database row → `>` → **External connections → Allow IP → Specific IP address**. Add your
   public IP. The ISP used **two** addresses (the one ipify showed, and another for the database
   connection); the error message names the one to add. Never "Any IP address".
2. `Dagohoy-Pharmacy-Server/.env.live` (gitignored): `NODE_ENV=production`,
   `DB_HOST=srv2186.hstgr.io`, `DB_PORT=3306`, name, user, password.
3. Run, in the server folder:
   ```bash
   node --env-file=.env.live database/run-migrations.cjs   # 13 migrations, 000–012
   node --env-file=.env.live database/verify-schema.cjs    # 31 tables, 51 FKs, 42 checks
   node --env-file=.env.live database/create-owner.cjs     # you type the owner's password
   ```
   `create-owner` once failed with "connection is in closed state": the remote database closes
   an idle connection while the password is typed. Fixed in the script (it saves on a fresh
   connection).
4. Afterwards: remove the IPs from External connections, empty the password in `.env.live`,
   move `deploy/api.env` into the password manager and delete it.

## 6. Check

- `https://api-dagohoypharmacy.boncales.com/api/health` → `ok`, `connected`, `production`.
- Log in as the owner, create the shared cashier in Staff, check Settings → Subscription (₱800,
  due every 13th, first payment Dec 13; the QR shows from Dec 10), scan one new product, start a
  shift and sell as the cashier.
- `https://api-dagohoypharmacy.boncales.com/api/billing/qr` (logged in) shows the QR.

## Updating later

Make new zips (step 1) and use **Redeploy / upload** on the same site. Schema changes: back up
first (hPanel backup or phpMyAdmin export), then step 5 with External connections opened for the
time it takes, then `/api/health` and `verify-schema`.
