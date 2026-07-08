# Tasks: Web frontend for the Duck Emporium (`web-frontend`)

**Source plan:** `specs/web-frontend/plan.md`
**Status:** Draft — awaiting approval

Task sequencing note: the plan assumes the JSON API contracts from stories 1–8
already exist and are stable. Task 1 validates/wires that boundary first; all
subsequent frontend tasks depend on it.

## Task 1 — HTTP entrypoint and static asset serving

**Files:** `src/server.ts`, `src/server.test.ts`
**Depends on:** existing API contracts from stories 1–8

Create the server bootstrap and routing shell that:
- serves the SPA entry HTML for both `/` and `/app`
- serves static assets from `public/`
- keeps API route behavior/status semantics unchanged for existing JSON
  contracts (no new frontend-only endpoints)

Tests:
- `/` and `/app` return HTML
- static assets resolve with expected content types
- unknown static path returns 404
- API routes still return existing status codes (including 400/404/409 paths)

**Acceptance check:** `npm test -- src/server.test.ts` passes.

## Task 2 — Frontend shell, layout, and responsive baseline

**Files:** `public/index.html`, `public/app.css`
**Depends on:** Task 1

Add a no-build SPA shell and mobile-first styles with:
- semantic landmarks/labels for accessibility baseline
- defined sections for catalog, duck detail, duck-of-the-day, cart, checkout,
  and quiz
- responsive rules that avoid horizontal scrolling at mobile widths

Tests:
- server test confirms new static assets are served
- DOM smoke test confirms root regions render and are selectable

**Acceptance check:** `npm test -- src/server.test.ts` and `npm test -- public/__tests__/app.dom.test.ts` pass for shell smoke coverage.

## Task 3 — Browser API client and in-memory state store

**Files:** `public/api.js`, `public/state.js`, `public/__tests__/app.dom.test.ts`
**Depends on:** Tasks 1–2

Implement fetch wrappers and central UI state helpers per plan:
- API functions for catalog/detail/duck-of-the-day/cart/checkout/quiz
- error normalization into feature-scoped messages
- in-memory-only state updates (no URL query synchronization)

Tests:
- mocked fetch verifies each API wrapper calls expected endpoint/method/payload
- error responses normalize into user-facing error objects
- state store create/get/set behavior is deterministic and immutable by caller

**Acceptance check:** `npm test -- public/__tests__/app.dom.test.ts` passes for API/state unit coverage.

## Task 4 — Catalog, filters, duck detail, and duck-of-the-day UI flow

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`
**Depends on:** Task 3

Implement catalog-driven UI flow:
- render catalog cards with name/category/price/tagline
- wire free-text/category/price filter controls to refresh list
- show duck detail panel (description, traits, stock, add-to-cart action)
- render duck-of-the-day prominently in catalog area

Tests:
- catalog renders required fields
- filter interactions update visible ducks
- selecting duck opens detail view with required fields
- duck-of-the-day block renders when API returns data

**Acceptance check:** `npm test -- public/__tests__/app.dom.test.ts` passes for catalog/detail/day flow scenarios.

## Task 5 — Cart rendering and cart mutations

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`
**Depends on:** Task 4

Implement cart behavior:
- render line items with quantity and line totals
- show running total
- support quantity updates and item removal
- provide proceed-to-checkout action and state transition

Tests:
- add-to-cart updates cart view
- quantity update recomputes line totals/running total
- removal updates totals and empty-state behavior
- cart API errors render feature-local friendly messages

**Acceptance check:** `npm test -- public/__tests__/app.dom.test.ts` passes for cart scenarios.

## Task 6 — Checkout form, inline validation errors, and confirmation view

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`
**Depends on:** Task 5

Implement checkout interaction:
- collect name/email/address/card fields
- submit to existing checkout API contract
- show inline field/form errors for validation/API failures
- show success confirmation with order ID, items, and total

Tests:
- required field and invalid input errors render inline
- API 400/409 checkout failures show recoverable user messages
- successful checkout renders confirmation contract fields

**Acceptance check:** `npm test -- public/__tests__/app.dom.test.ts` passes for checkout scenarios.

## Task 7 — Personality quiz flow and feature-scoped error UX

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`
**Depends on:** Task 6

Implement quiz flow and finalize shared error messaging:
- render quiz questions/options and collect answers
- submit answers to existing quiz API behavior
- show recommended duck + recommendation message
- ensure 400/404/409 errors across catalog/detail/cart/checkout/quiz are
  human-friendly and scoped to the active feature region

Tests:
- quiz submission returns and renders recommendation result
- quiz failure shows local error message without collapsing whole app
- cross-feature error handling assertions for 400/404/409

**Acceptance check:** `npm test -- public/__tests__/app.dom.test.ts` passes for quiz and error UX scenarios.

## Task 8 — Final integration and regression sweep

**Files:** `package.json` (dev dependency only if missing), tests only for fixes
**Depends on:** Tasks 1–7

Complete story-wide verification:
- ensure `jsdom` test dependency is present for DOM/integration tests
- run full test suite and close any regressions
- verify no frontend build step is required to serve and use the app

Tests:
- full repo test run is green
- targeted checks confirm `/` and `/app` both load SPA shell
- acceptance criteria traceability from spec to passing tests is documented in
  commit notes

**Acceptance check:** `npm test` passes.

## Suggested commit order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
