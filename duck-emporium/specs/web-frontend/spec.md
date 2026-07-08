# Spec: Web frontend for the Duck Emporium (`web-frontend`)

**Source story:** `../user-stories/09-web-frontend.md`  
**Depends on:** `browse-catalog`, `duck-detail`, `add-to-cart`, `checkout`, `search-and-filter`, `curator-add-duck`, `duck-of-the-day`, `personality-quiz`  
**Status:** Draft — awaiting approval

## Problem

The app has usable JSON APIs but the browser UI currently behaves like a dense
"everything on one page" dashboard. That violates the intended customer flow:
shopping should prioritize catalog browsing, cart should be opened on demand,
checkout should appear only in cart context, and non-shopping content (quiz)
must not compete with the buying flow.

## Users

- **Quincy Quacker (customer):** wants a clean shopping-first UI with optional
  cart/checkout and a separate quiz experience.
- **Workshop maintainers (indirect):** want the frontend to stay a thin SPA over
  existing API contracts.

## Scope

### In scope

- Single-page frontend served by the same Node app at `/` and/or `/app`.
- Shopping-first layout with:
  - catalog list as the primary area,
  - duck detail rendered as its own page/view,
  - cart rendered as its own page/view, opened manually via button,
  - checkout visible only on the cart page,
  - duck-of-the-day shown as a compact featured card,
  - quiz rendered in a separate section/view from the default shopping area.
- Existing JSON APIs only (no new frontend-only backend routes).
- Human-friendly API error messages for 400/404/409.
- Responsive behavior without horizontal scroll.

### Out of scope

- New backend routes purely for frontend convenience.
- Multi-page SSR or template engines.
- Framework build pipeline requirements.
- Admin/curator browser UX.

## Functional requirements

### FR1 — Frontend entrypoint and static delivery

- Frontend is served at `/` or `/app` (both may serve the same shell).
- Opening entry URL loads usable app shell without direct API tooling.

### FR2 — Information architecture and default view

- Default view prioritizes catalog browsing.
- The default viewport does **not** render a fully expanded cart/checkout panel.
- Primary top-level areas are:
  - catalog/listing region,
  - duck-of-the-day compact card region,
  - optional entry point to quiz (nav button/link/tab), with quiz content not
    dominant in the default shopping viewport.

### FR3 — Cart toggle and item-count affordance

- UI includes a cart toggle button available in global chrome (for example
  header/top bar).
- Cart affordance shows item count badge/label (for example `Cart (2)`).
- Clicking cart toggle navigates to cart page/view explicitly.
- Users can return from cart page/view to shop page/view without reload.

### FR4 — Cart contents and editing (on cart page)

- Cart page/view shows line items with quantity and line totals.
- Cart page/view shows running total.
- Users can update quantities and remove items.

### FR5 — Checkout visibility and submission

- "Proceed to Checkout" action is available only in cart context.
- Checkout form is visible only on cart page/view after entering checkout
  sub-flow.
- Checkout form collects shipping name, email, address, and mocked card number.
- Validation/API errors render inline and human-friendly.
- Success shows order confirmation (ID, items, total).

### FR6 — Catalog, detail, and search/filter

- Catalog cards/list rows include name, category, price, and tagline.
- Search and filter controls (text/category/price bounds) update visible ducks.
- Selecting a duck opens detail info including description, traits, stock, and
  add-to-cart action.
- Detail content is shown on a dedicated detail page/view (not mixed into the
  default catalog page viewport).

### FR7 — Duck of the Day as compact feature

- Duck-of-the-day is visibly featured but compact (small card/teaser format).
- Feature includes clear link/action to open duck detail.
- It should not occupy dominant page real estate over catalog/cart flows.

### FR8 — Quiz separation from shopping flow

- Quiz is available from a separate section/view entry point.
- Quiz UI is not always expanded in the same immediate viewport as cart and
  checkout by default.
- Quiz submit shows recommended duck and message.

### FR9 — Error handling

- API responses 400/404/409 show readable, feature-scoped messages.
- Errors in one feature region do not collapse unrelated regions.

### FR10 — No-build runtime

- Frontend runs from static assets served by Node with no required frontend
  build command.

## Non-functional requirements

- **NFR1 — Stack:** TypeScript/Node backend + plain browser assets.
- **NFR2 — Responsiveness:** no horizontal scrolling at common mobile widths.
- **NFR3 — Accessibility baseline:** keyboard-usable controls, visible labels.
- **NFR4 — Test coverage:** tests verify interactive visibility rules and
  feature flows.

## Acceptance criteria

1. Visiting `/` or `/app` loads the frontend shell from the app process.
2. Catalog is the default primary visible experience.
3. Detail content is rendered in a dedicated detail page/view.
4. Cart is rendered in a dedicated cart page/view and opens only after explicit
   cart-button click.
5. Cart button shows item count summary and cart page shows line items, quantity controls, line totals, and running
   total.
6. Checkout controls/form are only visible on the cart page within the cart flow (not always
   visible on initial page load).
7. Duck-of-the-day appears as a compact featured card with link to detail.
8. Quiz is accessible from a separate section/view and is not always expanded in
   the same default shopping viewport.
9. Catalog/detail/search/filter/add-to-cart/checkout/quiz all integrate with
   existing JSON APIs only.
10. API errors (400/404/409) are displayed in human-friendly form.
11. UI is usable on mobile and desktop without horizontal scrolling.
12. `npm test` remains green.
