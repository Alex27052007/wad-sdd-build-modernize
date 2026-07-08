# Plan: Web frontend for the Duck Emporium (`web-frontend`)

**Source spec:** `specs/web-frontend/spec.md`
**Depends on:** `browse-catalog`, `duck-detail`, `add-to-cart`, `checkout`, `search-and-filter`, `curator-add-duck`, `duck-of-the-day`, `personality-quiz`
**Status:** Draft — awaiting approval

## Resolved open questions

- **Entry URL canonicalization:** both `/` and `/app` are first-class entry URLs; both serve the same SPA HTML directly (no redirect required).
- **Client state strategy:** in-memory UI state only for this story (no URL query synchronization).
- **Frontend test depth:** include deeper DOM/integration tests for key flows, not only API/static-route smoke tests.

## Implementation state this plan builds on

- **Exists today:** domain modules for catalog/cart/checkout/orders/rendering in `src/`, plus unit tests.
- **Gap to close in this story:** there is no HTTP/static serving layer in `src/` yet, and no browser assets.
- **Constraint:** frontend must consume existing JSON API contracts only; if route wiring is missing, add a thin HTTP adapter for those contracts without inventing new frontend-only endpoints.

## Data model

The frontend adds client-side view state and form models (runtime in browser JS):

```ts
interface CatalogFilters {
  query: string;
  category: string; // empty string = all
  minPrice: string; // kept as text in form controls
  maxPrice: string;
}

interface CheckoutFormState {
  name: string;
  email: string;
  address: string;
  card: string;
  errors: Partial<Record<"name" | "email" | "address" | "card" | "form", string>>;
}

interface QuizState {
  answers: Record<string, string>;
  result: null | { duckId: string; message: string };
}

interface UiState {
  ducks: Duck[];
  filteredDucks: Duck[];
  duckOfTheDay: Duck | null;
  selectedDuckId: string | null;
  cart: Cart;
  filters: CatalogFilters;
  checkout: CheckoutFormState;
  quiz: QuizState;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
}
```

Notes:
- Form fields remain string-first in UI state; parsing/validation for price bounds happens before API requests.
- API errors are normalized into `{ status, message }` and mapped to feature-scoped error slots.

## Module / file layout

```text
src/
  server.ts                 # Node HTTP server bootstrap + route dispatch + static serving
  server.test.ts            # static serving + API pass-through integration tests

public/
  index.html                # SPA shell used by both / and /app
  app.css                   # responsive layout + component styling
  app.js                    # app bootstrap + event wiring
  api.js                    # fetch wrappers for existing JSON endpoints
  state.js                  # centralized in-memory UiState + update helpers
  render.js                 # DOM render functions for catalog/detail/cart/checkout/quiz/errors

public/__tests__/
  app.dom.test.ts           # jsdom-driven flow tests (catalog/filter/cart/checkout/quiz)
```

Design choices:
- Browser runtime remains plain ES modules (no bundler, no transpile step required at runtime).
- Server serves static files from `public/` and maps both `/` and `/app` to `public/index.html`.
- Existing domain logic stays in `src/`; frontend composes through HTTP only.

## Public interfaces

```ts
// src/server.ts
export interface ServerOptions {
  port?: number;
  host?: string;
  staticDir?: string;
}

export function createServer(options?: ServerOptions): import("node:http").Server;
export function startServer(options?: ServerOptions): Promise<{ server: import("node:http").Server; port: number }>;
```

```js
// public/api.js
export async function fetchCatalog(filters);
export async function fetchDuckDetail(duckId);
export async function fetchDuckOfTheDay();
export async function fetchCart();
export async function updateCartItem(duckId, quantity);
export async function removeCartItem(duckId);
export async function submitCheckout(payload);
export async function submitQuizAnswers(payload);
```

```js
// public/state.js
export function createInitialState();
export function setState(patch);
export function getState();
```

```js
// public/render.js
export function renderApp(root, state);
export function renderFeatureError(targetEl, message);
```

Endpoint paths in `api.js` are bound to the already defined JSON API contract from stories 1–8; this plan does not introduce new backend convenience routes.

## External dependencies

- **Runtime:** none new (Node + browser built-ins).
- **Dev/test:** add `jsdom` as a dev dependency to run DOM integration tests with Vitest.
- **No framework/toolchain additions:** no React/Vue/Svelte, no bundler requirement.

## Testing strategy

1. **Server/static route tests (Vitest, Node):**
   - `/` and `/app` both return the SPA HTML.
   - static assets (`/app.css`, `/app.js`, module imports) return expected content types.
   - unknown static path returns 404.
2. **API contract pass-through tests:**
   - server wiring reuses existing API contracts and status codes (400/404/409) without remapping route semantics.
3. **DOM integration tests (Vitest + jsdom):**
   - catalog renders expected fields and updates after filter changes.
   - selecting a duck opens detail view and add-to-cart updates cart display.
   - cart quantity change/removal recomputes line totals and running total.
   - checkout form shows inline validation/API errors and success confirmation payload.
   - quiz submission renders recommendation duck/message.
4. **Error UX tests:**
   - simulated API 400/404/409 responses render human-friendly, feature-local error messages.
5. **Responsive guardrails:**
   - CSS tests/assertions for mobile breakpoints (no forced horizontal overflow from fixed-width layout primitives).
6. **Regression gate:**
   - full suite stays green via `npm test`.

## Risks

- **API contract drift:** if stories 1–8 were implemented library-first without final HTTP route shape, frontend integration can stall. Mitigation: define/lock the route map first and keep adapters thin.
- **State consistency across async flows:** cart/checkout/quiz updates can race if multiple requests overlap. Mitigation: per-feature loading flags + last-write-wins state updates.
- **DOM test fragility:** deep integration tests can become brittle with markup churn. Mitigation: query by semantic roles/labels/data-testid and avoid snapshot-heavy assertions.
- **Responsive regressions:** dense cart/checkout rows can overflow on narrow screens. Mitigation: mobile-first CSS with wrapping/flexible columns and dedicated overflow checks in tests.
- **No-build constraint pressure:** keeping plain JS modular can increase manual wiring complexity. Mitigation: strict separation (`api.js`, `state.js`, `render.js`) and minimal shared conventions.
