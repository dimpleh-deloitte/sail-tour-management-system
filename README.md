# SAIL Tour Management System

Enterprise Tour Request / Travel Advance / Approval Workflow system for Steel
Authority of India Limited, built to the v2.0 Single Source of Truth (SSoT):
React frontend, Node.js backend, Oracle Database, ORDS integration points,
Oracle Fusion HCM integration points.

See `/docs` (in this repo) and the project's `Phase1_Inspection_and_Implementation_Plan.md`
for the full analysis, architecture decisions, reuse/non-reuse register and the
TBD register that governs everything this codebase intentionally leaves as a
swappable interface rather than a guess.

## Layout

```
apps/web/       React SPA (Vite + TypeScript + Tailwind)
apps/api/       Node.js/Express API (all authoritative business logic)
database/       Oracle DDL, seed data, ORDS enablement scripts
docs/           Architecture and TA rule engine documentation
tests/          Unit / integration / e2e tests
```

## Getting started (mocked mode — no Oracle needed)

By default the API runs against an in-memory data store (`DATA_MODE=memory`
in `.env.example`) seeded with the 154 destinations, the 24-grade TA rule
table, and a handful of mock employees/roles — so you can run the whole
thing end-to-end without a real Oracle instance, SSO provider, or Fusion
HCM connection while those integrations are still TBD.

```bash
npm install
cp .env.example .env      # defaults already work for mocked mode
npm run dev:api           # API on http://localhost:4000
npm run dev:web           # frontend on http://localhost:5173 (open this one)
```

Sign in on the login screen by picking one of the mock identities (employee,
forwarding/recommending/approving authority, HR admin) — there's no
password in mock mode. Try: create a tour as the employee, then sign out
and sign back in as the Forwarding Authority to see it in their worklist.

## Entitlements and the tour lifecycle

Entitlements are derived from the employee's grade under the SAIL Travelling
Allowance Rules-2021 (PER/RULES/4001, eff. 17-Dec-2021). Two modules own
that logic, and neither the API routes nor the React components may
re-implement any of it:

- `domain/ta-rule-engine.ts` — *eligibility*: may I travel this way at all?
  Rail/air/road/waterway class by grade, the §6(c) 500km air gate for
  E-1/E-2, own-vehicle and higher-class approval gates.
- `domain/entitlement-calculator.ts` — *quantum*: how much may I claim?
  The §7.3 duration bands (under 6h nil, 6–12h half, 12–24h full, beyond
  that full per 24h plus half for a remainder up to 12h), the §7.2A lodging
  ceiling split between the twelve §4.5 Specified Locations and everywhere
  else, and the §7.2C(9) halving where accommodation is retained.

Journey fare is deliberately **not** given a monetary ceiling: §6 reimburses
it at actuals by the entitled class and sets no figure, so the calculator
returns none rather than inventing one. The "maximum admissible" shown to an
employee is DA plus lodging; fare sits on top of it, at actuals.

A request runs: `DRAFT → PENDING_FORWARDING → PENDING_RECOMMENDATION →
PENDING_APPROVAL → APPROVED` (the SSoT §13 workflow), then
`IN_PROGRESS → COMPLETED → PENDING_SETTLEMENT_APPROVAL → SETTLED`. Along the
way: journey-start acknowledgement by the employee or their Forwarding
Authority acting as controlling officer; tour extension (approved by the
Approving Authority alone, since the tour is already sanctioned, and which
recomputes the entitlement); cancellation and advance withdrawal; and bill
settlement under §11, which holds each line to its ceiling and nets the
admitted total against the advance drawn.

**Bill Settlement** in the sidebar is the entry point for §11 obligations: it
lists tours awaiting a bill with a countdown to the one-month due date,
flags overdue ones (where the advance becomes recoverable), and shows an
Approving Authority the settlements waiting on their decision. An individual
tour's settlement is also reachable from its detail page.

Authorities can nominate an **acting authority** for a date range
(Acting Authority in the sidebar). Delegation is additive, never a transfer —
the original authority keeps access throughout, and an expired delegation
simply stops applying.

### Distance data is not populated

The §6(c) 500km condition needs a one-way distance from the employee's
headquarters to the destination. That matrix (`repository/seed-distances.ts`)
**ships empty**, because a wrong distance does not produce a visible error —
it silently flips an entitlement decision at the 500km boundary. Until a pair
is recorded, the rule engine reports `DISTANCE_NOT_RECORDED` and routes the
request to special approval rather than passing or failing it quietly.
Populate it under HR Admin → Distance Matrix before any real use.

## Switching to real Oracle / SSO / Fusion HCM

This reference build's data layer (`apps/api/src/repository/store.ts`) is
in-memory only — the Oracle DDL/seed scripts in `/database` define the
target schema, but an Oracle-backed repository implementation has not been
wired up yet (tracked as follow-up work). `AUTH_USE_MOCK_PROVIDER=false`
and `HCM_USE_MOCK_ADAPTER=false` are wired seams (see `modules/auth`,
`modules/hcm/client.ts`) ready for a real SSO/Fusion HCM implementation once
those providers are confirmed; the in-memory store is what still needs an
Oracle counterpart before this can run against production data.

## Architecture boundary (do not violate)

React never talks to Oracle, ORDS or Fusion HCM directly. All requests go
`apps/web` → `apps/api` → (Oracle DB / ORDS / Fusion HCM). No database
credentials, Fusion credentials or secrets are ever sent to the browser.

## TBD items

Several integration points (SSO provider, Fusion HCM endpoints, ORDS
endpoints, authority-resolution source, etc.) are explicitly marked TBD in
the SSoT. Each is implemented here behind a clean interface with a mock
implementation wired in for local development (see `apps/api/src/modules/auth`,
`modules/hcm`, and `domain/authority-resolver.ts`), so the app runs
end-to-end today and the real integration can be substituted without
touching business logic. Search for `TBD` in `apps/api/src` to find every
seam.
