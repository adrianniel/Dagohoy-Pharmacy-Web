# Dagohoy Pharmacy Web

React + TypeScript + Vite frontend foundation for the Dagohoy Pharmacy POS and Inventory Management System.

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

## Architecture notes

The browser communicates only with the backend REST API. Routing, API access, reusable layout, loading/error states, and a protected-route boundary are established; authentication and pharmacy business modules are intentionally placeholders for future milestones.
