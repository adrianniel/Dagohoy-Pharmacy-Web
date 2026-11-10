# Running Dagohoy Pharmacy on this computer

How to start the system for development and testing. Two folders sit side by side in
`C:\Users\Niel Adrian\Documents\GitHub`:

- `Dagohoy-Pharmacy-Server`: the API (NestJS), port **3001**.
- `Dagohoy-Pharmacy-Web`: the screens (React + Vite), port **5173**.

The database is **MariaDB 11.4** (Windows service `MariaDB`, port **3307**), database
`dagohoy_pharmacy_dev`, used by the limited account `dagohoy_app`.

## Every day: start it

1. **Database.** It starts with Windows. To check, open *Services* and look for `MariaDB`
   (Running). If it is stopped: right-click → Start.
2. **API.** In a terminal, in the server folder:

   ```bash
   npm run dev
   ```

   Wait for "Nest application successfully started". Check it in a browser:
   <http://localhost:3001/api/health> should say `"database":"connected"`.
3. **Web.** In a second terminal, in the web folder:

   ```bash
   npm run dev
   ```

   Open <http://localhost:5173> and log in.

Leave both terminals open while you work. To stop one, click its terminal and press `Ctrl + C`.

## First time on a new computer

Run these in the **server** folder, in this order:

1. Copy `.env.example` to `.env` and fill in the database password (and the BarCloud key if
   you use the barcode lookup). Never commit `.env`.
2. `npm install`
3. `npm run db:migrate` creates the tables. Running it again is safe (it skips what is done).
4. `npm run db:verify` checks the tables, keys and rules.
5. `npm run db:create-owner` creates the owner login. You type the password yourself; it is
   hidden and only its hash is saved.

Then in the **web** folder: copy `.env.example` to `.env`, `npm install`, `npm run dev`.

## Database commands (server folder)

| Command | What it does | Safe on real data? |
|---|---|---|
| `npm run db:migrate` | Applies new migration files | Yes, after a backup |
| `npm run db:verify` | Checks the schema, changes nothing | Yes |
| `npm run db:check-rules` | Tries good and bad rows, then rolls back. Run with no shift open | Dev only |
| `npm run db:create-owner` | Creates the owner or resets the owner's password | Yes |
| `npm run db:backup` | Saves everything into `backups/<database>-<date>-<time>.sql` | Yes |
| `npm run db:create-test` | One time: creates `dagohoy_pharmacy_test` (asks for the MariaDB root password) | Dev only |

## Backup and restore

**Back up** (takes a few seconds, the store can keep working):

```bash
npm run db:backup
```

The file lands in the server's `backups/` folder. That folder is never committed, because a
backup holds real sales, names of utang customers and password hashes. Copy the file to a USB
drive or cloud drive too: a backup on the same computer does not survive a broken disk.

**Restore** only into an **empty** database, never over one that is in use. To practise, restore
into the test database. Run this in **Command Prompt (cmd)**, not PowerShell, in the server
folder (it asks for the `dagohoy_app` password):

```bat
"C:\Program Files\MariaDB 11.4\bin\mariadb.exe" --host=127.0.0.1 --port=3307 --user=dagohoy_app -p dagohoy_pharmacy_test < backups\FILE_NAME.sql
```

Then point `DB_NAME` in `.env` at that database for a moment, start the API and look at
`/api/health` and a few pages. Put `DB_NAME` back after.

A backup you have never restored is only a hope. Practise the restore once before going live,
and again after any big change.

## When something is wrong

| What you see | Likely cause | Fix |
|---|---|---|
| Web says it cannot reach the server; browser console shows `ERR_CONNECTION_REFUSED` | The API is not running | Start it (`npm run dev` in the server folder) |
| `/api/health` says the database is not connected | MariaDB service is stopped, or wrong password in `.env` | Start the service; check `.env` |
| API fails to start: port already in use | Another program uses 3001 (port 3000 belongs to LISA-Web) | Stop the other program, or change `PORT` in the server `.env` and `VITE_API_BASE_URL` in the web `.env` |
| Login says wrong username or password, many times | Typo, or the login limiter is counting | Wait a minute and try again; reset the owner with `npm run db:create-owner` |
| "No shift is open" at the Sales Counter | Sales need an open shift | Start a shift first |
| A page shows old numbers | The browser copy is from before a change | Reload the page (it syncs from the server after login) |
| A migration fails halfway | DDL cannot be rolled back in MariaDB | Do not edit the migration. Read the error, fix the cause, check which objects exist, then run again |

## Rules that always apply

- Schema changes go through a new numbered migration. Never edit an applied one, never change
  tables by hand.
- Never UPDATE or DELETE `stock_movements`. Correct stock with an adjustment.
- Sales are never deleted. A mistake is voided, which keeps the record.
- Back up before every migration on real data.
- Never copy the dev database (test data) into the live one.
