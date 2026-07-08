# Spec: Web frontend for the Duck Emporium (`web-frontend`)

**Source story:** `../user-stories/09-web-frontend.md`
**Depends on:** `browse-catalog`, `duck-detail`, `add-to-cart`, `checkout`, `search-and-filter`, `curator-add-duck`, `duck-of-the-day`, `personality-quiz`
**Status:** Draft — awaiting approval

## Problem

The application already exposes API behavior for catalog browsing, duck detail,
cart management, checkout, and quiz recommendations, but customers still need
curl or Postman to use it. That makes the shop inaccessible for normal browser
usage. This story adds a browser-based frontend served by the same app, reusing
existing JSON APIs without introducing new backend routes.

## Users

- **Quincy Quacker (customer):** wants to browse, filter, add to cart, take the
  quiz, and check out from a browser on desktop or mobile.
- **Workshop maintainers (indirect):** want the UI to stay thin and API-driven,
  preserving the existing backend contracts from stories 1–8.

## Scope

### In scope

- Serve a single-page frontend at either `/` or `/app` (both acceptable).
- Static assets delivered by the same Node application/process.
- Browser UI flows for:
  - catalog listing,
  - duck detail,
  - duck of the day,
  - cart viewing/editing,
  - checkout submission,
  - personality quiz submission.
- Frontend integration with existing JSON API routes only.
- Human-friendly display of API errors (400, 404, 409).
- Responsive layout with no horizontal scrolling on common mobile widths.
- No required build step for frontend runtime (plain HTML/CSS/JS or equivalent
  pre-bundled artifact committed to source control).

### Out of scope

- Any new backend API routes solely for frontend convenience.
- Server-side rendering, template engines, or multi-page routing.
- Framework toolchains requiring project build setup (React/Vue/Svelte apps
  with dev/build pipelines).
- Admin/curator browser UX for story 6 endpoints.
- Service workers, offline support, push notifications.

## Functional requirements

### FR1 — Frontend entrypoint and static delivery

- The application serves a single-page frontend entry at `/` or `/app`.
- Entry HTML includes or references required CSS/JS assets from static routes.
- Opening the entry URL in a browser loads a usable app shell without requiring
  manual API calls.

### FR2 — Catalog page with search/filter controls

- The catalog view lists ducks with at least: `name`, `category`, `price`, and
  `tagline`.
- UI provides:
  - free-text search input,
  - category selection,
  - price range controls (min/max).
- Submitting or changing controls updates displayed ducks using existing API
  capabilities from stories 1 and 5.

### FR3 — Duck detail view

- Selecting a duck opens a detail view showing:
  - full description,
  - personality traits,
  - stock status,
  - an `Add to Cart` action.
- If the selected duck is missing or unavailable by API response, the UI shows
  a user-friendly not-found or unavailable message.

### FR4 — Duck of the Day display

- The frontend prominently shows the duck of the day in either:
  - a dedicated section on the catalog page, or
  - an equivalent clearly visible feature area.
- Content is fetched from the existing story 7 API behavior.

### FR5 — Cart view and editing

- The cart UI shows each line item with quantity and line total.
- The cart UI shows a running cart total.
- Users can change quantities and remove items from the cart.
- UI includes a clear `Proceed to Checkout` action.
- Cart actions call existing cart API behavior and refresh visible totals.

### FR6 — Checkout form and confirmation

- Checkout form collects:
  - shipping name,
  - email,
  - address,
  - mocked card number.
- Client sends checkout request to existing checkout endpoint/contract.
- Validation and API errors are displayed inline near relevant fields or form
  region.
- On success, UI displays confirmation including:
  - order ID,
  - purchased items,
  - final total.

### FR7 — Personality quiz flow

- The frontend presents quiz questions (single-step or multi-step is allowed).
- Submitting answers calls existing quiz API behavior.
- Result view shows recommended duck and recommendation message.

### FR8 — API error handling and user messaging

- For API responses with status 400, 404, or 409, the UI displays readable
  error feedback rather than raw JSON or silent failure.
- Errors are scoped to the active feature region (catalog, detail, cart,
  checkout, quiz) so users can recover without full-page reload.

### FR9 — No-build frontend runtime

- Running the app and opening the frontend does not require a frontend build
  command.
- Any JS/CSS used by the page is directly servable by Node as static files.

## Non-functional requirements

- **NFR1 — Stack:** Keep TypeScript/Node 20+ backend and plain browser
  technologies for frontend delivery; no new framework build pipeline.
- **NFR2 — Responsiveness:** UI remains usable on desktop and mobile (typical
  widths around 360px and above) without horizontal overflow.
- **NFR3 — Accessibility baseline:** interactive controls are keyboard-usable,
  have visible labels, and preserve readable text contrast.
- **NFR4 — Test coverage:** add/adjust automated tests for static route serving
  and key frontend/API integration behavior where practical; preserve passing
  `npm test` for the repo.

## Acceptance criteria

1. Visiting `/` or `/app` loads a single-page frontend served by the app.
2. The frontend uses existing JSON API endpoints only; no new backend routes are
   introduced for this story.
3. Catalog view shows name, category, price, and tagline for ducks, and includes
   free-text, category, and price-range controls.
4. Duck detail view shows description, personality traits, stock status, and an
   add-to-cart action.
5. Duck of the day is prominently displayed in the frontend.
6. Cart view supports quantity edits/removal, shows line totals and running
   total, and offers proceed-to-checkout action.
7. Checkout form collects shipping and mocked payment fields, surfaces inline
   errors, and shows order confirmation with ID, items, and total on success.
8. Personality quiz can be completed in the browser and shows a recommended duck
   plus message.
9. API errors (400/404/409) are shown in human-friendly UI messages.
10. Frontend works on mobile and desktop without horizontal scrolling.
11. App frontend runs without requiring a frontend build step.
12. Project test suite remains green via `npm test`.

## Open questions

- **Entry URL canonicalization:** both `/` and `/app` are acceptable. During
  implementation, decide whether one redirects to the other or both serve the
  same HTML directly.
- **Client-side state strategy:** use lightweight in-memory state first, with
  optional URL/query synchronization only if needed for filter persistence.
- **Frontend integration test depth:** confirm whether to add full DOM-level
  tests or limit to API/static-route tests plus targeted rendering utilities.
