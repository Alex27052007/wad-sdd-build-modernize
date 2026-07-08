# Implementation Plan: Check out with a Mocked Payment

**Branch**: `04-checkout` | **Date**: 2026-07-08 | **Spec**: [spec.speckit.md](spec.speckit.md)

**Input**: Feature specification from `/specs/checkout/spec.speckit.md`

## Summary

Add a `checkout(cart, details, options?)` function that validates customer details, revalidates stock, atomically decrements stock, creates a persisted order record, clears the cart, and returns an order confirmation. Payment is fully mocked — no real provider is involved.

## Technical Context

**Language/Version**: TypeScript strict mode, Node 20+

**Primary Dependencies**: `node:crypto` (UUID), `node:fs` (read/write/rename), `node:path`, `node:os` (temp dirs in tests); vitest for testing

**Storage**: `data/ducks.json` (catalog + stock), `data/orders.json` (appended order records); both via a write-temp-then-rename atomic strategy

**Testing**: vitest (`*.test.ts` co-located with source)

**Target Platform**: Node 20+ server-side library (no HTTP layer in this story)

**Project Type**: library

**Performance Goals**: N/A for workshop scale

**Constraints**: No new runtime dependencies; TypeScript strict mode; ES modules with `node:` prefixes; all tests use injected temp paths — never `data/` in the repo

**Scale/Scope**: Workshop — single-process, sequential calls; no cross-process concurrency

## Constitution Check

- TypeScript strict mode: all new types must be fully explicit ✓
- No real payment provider: card field is mocked / validated non-empty only ✓
- Tests mandatory: every rejection path, atomicity guarantee, persistence round-trip, and card-exclusion must be covered ✓
- Pure/IO split: validation, order construction, rendering are pure; all file I/O confined to persistence helpers ✓
- Paths injectable: both catalog and orders paths injected via `CheckoutOptions` so tests never touch `data/` ✓

## Project Structure

### Documentation (this feature)

```text
specs/checkout/
├── spec.speckit.md      # Speckit spec (this workflow)
├── plan.speckit.md      # This file
└── tasks.speckit.md     # /speckit.tasks output
```

### Source Code

```text
src/
├── persist.ts           # NEW — writeJsonAtomic helper
├── persist.test.ts      # NEW
├── orders.ts            # NEW — loadOrders / appendOrder
├── orders.test.ts       # NEW
├── catalog.ts           # EXTEND — add saveCatalog
├── catalog.test.ts      # EXTEND
├── checkout.ts          # NEW — types + checkout()
├── checkout.test.ts     # NEW
├── render.ts            # EXTEND — add renderOrderConfirmation
└── render.test.ts       # EXTEND
data/
├── ducks.json           # MUTATED by real checkouts (git recovers pristine seed)
└── orders.json          # CREATED on first order
```

## Data Model

All types exported from `src/checkout.ts`:

```ts
interface CheckoutDetails {
  name: string;    // non-empty after trim
  email: string;   // /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  address: string; // non-empty after trim
  card: string;    // non-empty after trim; mocked, NEVER persisted
}

interface OrderItem {
  duckId: string;
  name: string;     // duck name at purchase time (snapshot)
  quantity: number;
  price: number;    // unit price at purchase time (snapshot)
}

interface Order {
  id: string;        // crypto.randomUUID()
  items: OrderItem[];
  total: number;     // cent-safe; same arithmetic as cartTotal
  createdAt: string; // new Date().toISOString()
  customer: { name: string; email: string; address: string }; // no card
}

interface OrderConfirmation {
  order: Order;
  text: string;     // renderOrderConfirmation(order)
}

type CheckoutResult =
  | { ok: true;  confirmation: OrderConfirmation; cart: Cart } // cart = EMPTY_CART
  | { ok: false; message: string };

interface CheckoutOptions {
  catalogPath?: string; // default DEFAULT_SEED_PATH
  ordersPath?: string;  // default DEFAULT_ORDERS_PATH
}
```

Orders file (`data/orders.json`) is a JSON array of `Order`. Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

## Public Interfaces (new / changed exports only)

```ts
// src/persist.ts
export function writeJsonAtomic(filePath: string, value: unknown): void;

// src/orders.ts
export const DEFAULT_ORDERS_PATH: string;
export class OrdersLoadError extends Error {}
export function loadOrders(filePath?: string): Order[];
export function appendOrder(order: Order, filePath?: string): void;

// src/catalog.ts (addition)
export function saveCatalog(catalog: Duck[], filePath?: string): void;

// src/checkout.ts
export type { CheckoutDetails, OrderItem, Order, OrderConfirmation, CheckoutResult, CheckoutOptions };
export function checkout(cart: Cart, details: CheckoutDetails, options?: CheckoutOptions): CheckoutResult;

// src/render.ts (addition)
export function renderOrderConfirmation(order: Order): string;
```

## Checkout Control Flow (spec FR3, exact order)

1. **Validate details** — first invalid field fails with `{ ok: false, message }` naming the field.
2. **Reject empty cart** — `{ ok: false, message }`.
3. **Revalidate stock** — `loadCatalog(catalogPath)`; for each line: duck must exist and `quantity ≤ stock`. First failure returns `{ ok: false, message }` naming the duck; nothing is written.
4. **Mock payment** — no-op (card already validated non-empty in step 1).
5. **Atomic decrement** — build updated catalog immutably (no mutation), call `saveCatalog(updated, catalogPath)`.
6. **Create & persist order** — build `Order` (UUID, ISO timestamp, snapshot items/total, customer without card), call `appendOrder(order, ordersPath)`.
7. **Return success** — `{ ok: true, confirmation: { order, text }, cart: EMPTY_CART }` where `text = renderOrderConfirmation(order)`.

## Testing Strategy

Every filesystem test uses `mkdtempSync(join(tmpdir(), …))` as a sandbox, copies a catalog fixture into it, and passes the sandbox paths via `CheckoutOptions`. The repo's `data/` files are never written.

- **Validation (US2, FR-002):** each field blank/whitespace, email variants without `@` / without domain dot / empty parts — each fails naming the field; nothing written.
- **Empty cart (US3, FR-003):** `checkout([], validDetails)` returns `{ ok: false }`.
- **Stock revalidation + atomicity (US4, FR-004):** one valid + one over-stock line → failure names the duck; catalog file byte-identical. Duck deleted after carting → failure.
- **Success (US1, FR-005–008):** stock decremented and persisted (verify via fresh `loadCatalog`); order appended (verify via fresh `loadOrders`) with all FR-006 fields; UUID regex and ISO 8601 shape; cent-safe total; returned cart is `EMPTY_CART`.
- **Card exclusion (FR-009):** raw text of both files contains no card string.
- **First-checkout-wins (US4 AC2):** two sequential checkouts of last-in-stock duck — first `ok: true`, second `ok: false`.
- **Rendering (US5, FR-011):** `renderOrderConfirmation` output contains order ID, each duck name, quantity, formatted unit price, line subtotal, formatted total.

## Resolved Open Questions

- **Duplicate duck IDs in cart:** checkout does not merge; if the same `duckId` appears in two lines it will count both quantities against stock. Callers (add-to-cart) are responsible for merging duplicates.
- **Seed mutation:** real checkouts overwrite `data/ducks.json`; git recovers the pristine seed. Accepted for workshop scope.
- **Crash-window ordering:** stock is persisted before the order; a crash between the two loses the order but keeps the decrement. Accepted at workshop scale.
- **Message wording:** illustrative, not contractual — tests assert essentials only (field name, duck name), never exact strings.
