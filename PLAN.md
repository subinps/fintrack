# FinTrack — Grid Precision redesign

## Goal and users

Redesign the FinTrack web app (React + Vite frontend, Express/Prisma backend) for people who
check their money daily: power users who self-host and want a fast, trustworthy read on net
worth, cash flow, holdings and debts. "Working" means: every screen loads from the real API,
the shell works from 360 px to 1280 px, and no control is a dead end.

## Design brief

- **Who:** daily personal-finance users on a self-hosted instance; also evaluators on the landing page.
- **Job per screen:** Landing — earn a sign-in; Login — get in without friction; Dashboard — read the whole financial state in one grid and act on it.
- **Mood:** precise, calm, unmistakably financial.
- **Direction:** *Grid Precision* (selected) with the attached reference's colour energy: deep ink dark surfaces, electric blue accent, violet as a secondary data hue, pill primary buttons against hairline panels, mono micro-labels and tabular numerals.
- **Memorable:** the hairline "signal grid" backdrop plus a stat band whose numbers carry mono eyebrows and explicitly worded status chips — colour never carries meaning alone.

## Scope

In scope: design tokens (light + dark), shared primitives, app shell (sidebar rail, top bar,
mobile sheet nav), Overview dashboard, Landing, Login, and colour/radius normalisation across
the existing tabs. Out of scope: new features, new API endpoints, the mobile app, payment flows,
backend behaviour changes, and the attached screenshot's product layout (a different app is only
a colour reference).

## Architecture

- **Frontend:** existing React 18 + Vite + Tailwind v3 + shadcn/ui. No framework change; shadcn
  primitives are edited in place so every screen inherits the new system.
- **Tokens:** one source of truth in `frontend/src/index.css` (HSL CSS variables consumed by
  `tailwind.config.js`). Semantic names only (`--background`, `--card`, `--primary`, `--success`…).
- **Type:** Inter Variable (display + text) and JetBrains Mono Variable (labels, numerals),
  self-hosted through `@fontsource-variable` so nothing depends on an external font CDN.
- **Data:** unchanged REST API (`/api/...`) via TanStack Query. No mocks shipped.
- **Verification:** local Postgres + real backend, seeded demo account, preview at 127.0.0.1,
  browser checks at 390 px and 1280 px.
- **Secrets:** none needed for the redesign; backend reads `DATABASE_URL` / `JWT_SECRET` from a
  local, git-ignored `.env`.

## Risks and assumptions

- The reference is a dark dashboard for a different product; only palette, contrast and control
  styling are adopted, not its layout or copy.
- Existing tab components use hardcoded utility classes (slate/blue/violet, large radii); they are
  normalised to tokens, which may shift some spacing slightly.
- Market price calls may fail offline; the dashboard must still render from stored values.
- Assumed: light theme is the default (`next-themes` default stays "system", as before).

## Phase 1: The full redesign pass

Goal: ship the complete visual system and every touched screen, working end to end.

- [ ] Token layer: palette, type scale, spacing, radii, shadows, motion, reduced-motion rules
- [ ] Shared primitives: button, card, input, badge, tabs, skeleton, dialog, sheet, table, progress
- [ ] App shell: sidebar rail with grouped nav, top bar with live status, mobile sheet navigation
- [ ] Overview: greeting eyebrow, stat band, net-worth chart, allocation, empty and loading states
- [ ] Landing and Login rebuilt on the same tokens with real product copy
- [ ] Colour/radius sweep across remaining tabs so nothing falls back to stock shadcn
- [ ] Verified: `tsc && vite build` passes, browser checks at 390 px and 1280 px, no overflow

**Acceptance:** signing in shows the redesigned shell; every nav item opens a screen that matches
the system; the landing page and login page share the same typography, palette and motion; the app
is usable on a phone with no sideways scroll.

## Phase 2: Data-density and chart pass

Goal: make the charts and tables carry the instrument-panel language.

- [ ] Restyle Recharts tooltips, axes and series to the token palette
- [ ] Tabular numerals and hairline row rhythm in every table
- [ ] Empty states with a real next action on each tab

**Acceptance:** every chart and table reads consistently in both themes.

## Phase 3: Polish and delivery

Goal: ship-ready quality.

- [x] Keyboard audit and focus order on the shell and dialogs
- [x] Lighthouse pass on the landing page
- [x] Screenshot set for the README

**Acceptance:** a new user can go landing → sign up → dashboard with no visual or accessibility break.
