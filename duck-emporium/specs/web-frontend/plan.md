# Plan: Web frontend for the Duck Emporium (`web-frontend`)

**Source spec:** `specs/web-frontend/spec.md`  
**Depends on:** `browse-catalog`, `duck-detail`, `add-to-cart`, `checkout`, `search-and-filter`, `curator-add-duck`, `duck-of-the-day`, `personality-quiz`  
**Status:** Draft — awaiting approval

## UX decisions locked by this plan

- Catalog is the default main view.
- Duck detail is its own page/view.
- Cart is its own page/view and opened manually by cart button.
- Header/cart button shows item count.
- Checkout is gated inside the cart page flow only.
- Duck-of-the-day is rendered as a compact card, not a hero takeover.
- Quiz is separate from the default shopping viewport (tab/view/section entry).

## Architecture and module shape

```text
src/
  server.ts
  server.test.ts

public/
  index.html
  app.css
  app.js
  api.js
  state.js
  render.js
  __tests__/
    app.dom.test.ts
```

## Client state model (minimum)

```ts
interface UiState {
  ducks: Duck[];
  selectedDuckId: string | null;
  duckOfTheDay: Duck | null;
  cart: Cart;
  cartOpen: boolean;          // cart page visibility flag
  checkoutOpen: boolean;      // only meaningful when activeView is "cart"
  activeView: "shop" | "detail" | "cart" | "quiz";
  filters: {
    query: string;
    category: string;
    minPrice: string;
    maxPrice: string;
  };
  errors: Record<string, string | null>;
}
```

Rules:
- `activeView = "shop"` on initial load.
- duck detail page is shown by setting `activeView = "detail"`.
- cart page is shown by setting `activeView = "cart"`.
- checkout UI renders only when `activeView === "cart" && checkoutOpen`.
- quiz content renders when `activeView === "quiz"`.

## Implementation phases

1. **Server/static baseline:** ensure `/` + `/app` and static assets are served.
2. **Layout skeleton:** create header, catalog region, compact duck-of-day card
   slot, cart toggle button with item count, and quiz entry affordance.
3. **State + API wiring:** add fetch wrappers and state transitions for
   cart toggle, checkout gating, and view switching.
4. **Catalog/detail/search flow:** implement browsing interactions.
5. **Cart page flow:** implement page navigation behavior, edits, totals.
6. **Checkout sub-flow:** render only inside cart-page context and handle submit
   states/success/errors.
7. **Quiz view flow:** render and submit from separate view/section.
8. **Regression + UX assertions:** verify visibility behavior and full suite.

## Test strategy

1. **Server tests**
   - `/` and `/app` serve shell.
   - static assets available.
2. **DOM integration tests**
   - initial render: shop page visible, detail/cart/quiz pages hidden.
   - cart button shows item count summary.
   - clicking cart opens cart page; returning to shop hides cart page.
   - checkout controls visible only inside cart-page flow.
   - duck-of-day renders as compact card region.
   - quiz opens via explicit entry and is not always expanded by default.
3. **Error UX tests**
   - 400/404/409 messages render in correct feature scope.
4. **Regression gate**
   - full `npm test` passes.

## Risks and mitigations

- **Regression to "everything visible":** enforce with explicit DOM tests on
  initial page visibility and navigation states.
- **State coupling bugs (`cartOpen`/`checkoutOpen`):** model state transitions
  centrally and test invariants.
- **Responsive overflow from cart/detail panels:** mobile-first styles and
  test checks for layout constraints.
