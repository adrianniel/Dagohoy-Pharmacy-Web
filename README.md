# Dagohoy Pharmacy Web

React + TypeScript + Vite frontend for Dagohoy Pharmacy's internal point-of-sale and inventory operations. This application is for pharmacy owners, administrators, and cashiers; it does not provide customer shopping or online ordering.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

The development server runs on the Vite-provided local URL, usually `http://localhost:5173`.

## Environment

`VITE_API_BASE_URL` is the backend API base URL. It defaults to `http://localhost:3000/api` when omitted. Do not put database credentials or other server secrets in this repository.

## Commands

- `npm run dev` — start the Vite development server
- `npm run build` — type-check and build for production
- `npm run lint` — run ESLint
- `npm run typecheck` — run the TypeScript project check
- `npm run format:check` — verify Prettier formatting

## Workspaces

- **Owner / administrator:** overview, product and stock maintenance, suppliers, reports, staff, and pharmacy settings.
- **Cashier:** dashboard, barcode/search-based POS, product lookup, transaction history, and profile.
- The root URL opens the internal sign-in screen. The workspace selector is a local demo switch, not authentication.

## Data and integration status

The POS checkout, inventory edits, and transaction history currently use illustrative sample data and browser-local storage so the workflows can be reviewed without a backend. They do not record a real sale or update live stock. Do not use the demo workspace for pharmacy operations. Live sign-in, product/stock persistence, suppliers, staff access, reports, receipts, and payment processing require confirmed API contracts and server-side authorization. `VITE_API_BASE_URL` configures the existing API client for that integration work.
