# Tasks: Web frontend for the Duck Emporium (`web-frontend`)

**Source plan:** `specs/web-frontend/plan.md`  
**Status:** Draft — awaiting approval

## Task 1 — Server entrypoint and static delivery

**Files:** `src/server.ts`, `src/server.test.ts`  
**Depends on:** existing API stories

- Serve SPA entry at `/` and `/app`.
- Serve static assets from `public/`.
- Keep existing API contracts/statuses unchanged.

Tests:
- `/` and `/app` return HTML shell.
- static assets resolve.
- API routes preserve 400/404/409 behavior.

Acceptance check: `npm test -- src/server.test.ts`

## Task 2 — UX-first shell and responsive layout skeleton

**Files:** `public/index.html`, `public/app.css`, `public/__tests__/app.dom.test.ts`  
**Depends on:** Task 1

- Build shell with:
  - header/top bar containing cart button + count placeholder,
  - catalog as primary region,
  - dedicated detail page/view region,
  - dedicated cart page/view region,
  - compact duck-of-the-day card region,
  - quiz entry control (tab/link/button) without default expanded quiz content.
- Ensure detail/cart/quiz pages are hidden on initial load and checkout form is hidden until cart checkout flow.

Tests:
- initial DOM shows catalog region.
- initial DOM hides full cart and checkout regions.
- initial DOM includes cart button with count-only affordance.

Acceptance check: `npm test -- public/__tests__/app.dom.test.ts`

## Task 3 — API client and page-state transitions

**Files:** `public/api.js`, `public/state.js`, `public/__tests__/app.dom.test.ts`  
**Depends on:** Task 2

- Implement API wrappers for catalog/detail/day/cart/checkout/quiz.
- Add state transitions:
  - `activeView` switching between shop/detail/cart/quiz,
  - cart button navigation to cart page,
  - `checkoutOpen` gated by cart page.

Tests:
- `activeView` defaults to shop.
- selecting a duck opens detail page/view.
- leaving cart page forces checkout closed.
- quiz view requires explicit switch.

Acceptance check: `npm test -- public/__tests__/app.dom.test.ts`

## Task 4 — Catalog, filters, detail, and compact duck-of-day card

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`  
**Depends on:** Task 3

- Render catalog cards with required fields.
- Wire search/filter controls.
- Render selectable duck detail.
- Render duck-of-day in compact card form (teaser footprint, not dominant block).

Tests:
- filter interactions update displayed ducks.
- detail opens and includes required fields/add-to-cart action.
- duck-of-day appears in compact feature region.

Acceptance check: `npm test -- public/__tests__/app.dom.test.ts`

## Task 5 — Cart page behavior and count badge

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`  
**Depends on:** Task 4

- Keep cart page hidden by default.
- Clicking cart button opens cart page.
- Header cart state shows item count summary.
- Cart page supports quantity edits/removal and shows totals.

Tests:
- default state: cart page hidden, count summary visible.
- cart page state: cart lines/totals visible.
- back action returns to shop page.

Acceptance check: `npm test -- public/__tests__/app.dom.test.ts`

## Task 6 — Checkout gated inside cart page flow

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`  
**Depends on:** Task 5

- Show proceed-to-checkout action only on cart page.
- Render checkout form only when checkout sub-flow is active on cart page.
- Submit checkout and show inline errors/success confirmation.

Tests:
- checkout form hidden on initial load.
- checkout form not visible when cart page is not active.
- checkout form visible only after entering cart page and starting checkout flow.
- success confirmation and API error paths covered.

Acceptance check: `npm test -- public/__tests__/app.dom.test.ts`

## Task 7 — Quiz in separate view/section

**Files:** `public/render.js`, `public/app.js`, `public/__tests__/app.dom.test.ts`  
**Depends on:** Task 6

- Implement quiz UI behind explicit view switch or section entry.
- Ensure quiz is not always expanded in default shop view.
- Submit answers and render recommendation + message.

Tests:
- default shop view does not show expanded quiz content.
- quiz appears after explicit user action.
- quiz submit renders recommendation result.

Acceptance check: `npm test -- public/__tests__/app.dom.test.ts`

## Task 8 — Full regression and acceptance sweep

**Files:** tests and minimal fixes only  
**Depends on:** Tasks 1–7

- Run full suite.
- Confirm UX acceptance criteria:
  - catalog-first default,
  - dedicated detail page/view,
  - dedicated cart page/view + count badge,
  - checkout only in cart flow,
  - compact duck-of-day card,
  - separate quiz flow.

Acceptance check: `npm test`
