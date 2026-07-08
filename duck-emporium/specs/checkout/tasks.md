# Tasks: Check out with a mocked payment (`checkout`)

**Source plan:** `specs/checkout/plan.md`
**Status:** Draft — awaiting approval

Cross-story prerequisite: per the plan, `src/cart.ts` (`Cart`, `CartLine`,
`EMPTY_CART`, `CartResult`, `cartTotal`) is delivered by **add-to-cart
tasks 1 and 3** and does not exist yet. Tasks 1–4 below don't touch the
cart and may proceed regardless; **task 5 must not start** before those
add-to-cart tasks land. Nothing here re-plans them.

Every task's acceptance check includes `npx tsc --noEmit` passing and
`npm test` green. Filesystem tests always use `mkdtempSync` sandboxes and
injected paths — never the repo's `data/` files (spec AC9). Failure-message
tests assert essentials by substring, never exact strings.

## Task 1 — Atomic JSON writer

**Files:** `src/persist.ts`, `src/persist.test.ts`
**Depends on:** nothing new

Create `writeJsonAtomic(filePath, value)` per the plan: serialize as
2-space-indented JSON with trailing newline, write to `<filePath>.tmp`,
`renameSync` over the target.

Tests: writes a new file and overwrites an existing one; content parses
back to a deep-equal value; output ends with `\n`; no `.tmp` file remains
afterwards.

**Acceptance check:** `npm test` green including all `persist.test.ts`
cases.

## Task 2 — saveCatalog

**Files:** `src/catalog.ts`, `src/catalog.test.ts`
**Depends on:** Task 1

Add `saveCatalog(catalog: Duck[], filePath?)` (default
`DEFAULT_SEED_PATH`) using `writeJsonAtomic`. It writes the duck records
as given — callers pass loaded records with updated stock, so fields
unknown to this story survive a round-trip.

Tests (sandboxed copy of a fixture catalog): save-then-`loadCatalog`
round-trips exactly; a record carrying an extra field survives
save/load-raw; existing `loadCatalog` behaviour untouched.

**Acceptance check:** `npm test` green including the new `saveCatalog`
cases; all pre-existing catalog tests still pass.

## Task 3 — Checkout data model and orders persistence

**Files:** `src/checkout.ts`, `src/orders.ts`, `src/orders.test.ts`
**Depends on:** Task 1

Create `src/checkout.ts` containing only the plan's exported types
(`CheckoutDetails`, `OrderItem`, `Order`, `OrderConfirmation`,
`CheckoutResult`, `CheckoutOptions`) — no functions yet. `CheckoutResult`
references `Cart` from the add-to-cart spec via `import type`; if
`src/cart.ts` has not landed when this task starts, model `Cart` per that
spec is **not** an option — instead defer only the `CheckoutResult` type
to task 5 and note it in the commit. Create `src/orders.ts` with
`DEFAULT_ORDERS_PATH` (module-relative `data/orders.json`),
`OrdersLoadError`, `loadOrders(filePath?)` (missing file → `[]`;
unreadable/corrupt/non-array → throws `OrdersLoadError` naming file and
problem), `appendOrder(order, filePath?)` (load → append →
`writeJsonAtomic`).

Tests (sandboxed): `loadOrders` on a missing path returns `[]`; corrupt
JSON and non-array top level throw `OrdersLoadError`; `appendOrder`
creates the file on first order and preserves append order across
multiple orders; append-then-load round-trips all `Order` fields.

**Acceptance check:** `npm test` green including all `orders.test.ts`
cases.

## Task 4 — Order confirmation rendering

**Files:** `src/render.ts`, `src/render.test.ts`
**Depends on:** Task 3 (the `Order` type)

Add `renderOrderConfirmation(order: Order): string`: order ID line, one
line per item (duck name, quantity, `formatPrice` unit price, line
subtotal), formatted total — same style as `renderCart`.

Tests on a fixture `Order` (spec AC8): output contains the ID, each name,
quantity, formatted unit price, line subtotal, and the formatted total;
multi-item order renders one line per item.

**Acceptance check:** `npm test` green including the new render cases;
pre-existing render tests still pass.

## Task 5 — checkout() and integration tests

**Files:** `src/checkout.ts`, `src/checkout.test.ts`
**Depends on:** Tasks 2, 3, 4 **and add-to-cart tasks 1 & 3**
(`src/cart.ts` with `Cart`, `EMPTY_CART`, `cartTotal`)

Implement `checkout(cart, details, options?)` with the plan's exact
seven-step flow: validate details (first invalid field fails, message
names it; email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`); reject empty cart;
load catalog from `catalogPath` and revalidate every line (duck exists,
`quantity ≤ stock`) failing with the offending duck named, nothing
written; mock payment no-op; build decremented catalog without mutation
and `saveCatalog`; build `Order` (`randomUUID`, ISO timestamp, items with
purchase-time name/price, cent-safe total, customer without card) and
`appendOrder`; return `{ ok: true, confirmation: { order, text }, cart:
EMPTY_CART }` with `text` from `renderOrderConfirmation`. Add the
`CheckoutResult` type here if it was deferred in task 3.

Tests (sandboxed per the plan's testing strategy):

- validation rejections — blank/whitespace name, address, card; email
  variants (no `@`, no domain dot, empty local/domain); each names the
  field; nothing written (spec AC2);
- empty cart fails (AC3);
- stock revalidation — one valid + one over-stock line fails naming the
  over-stock duck, catalog file byte-identical; duck removed from the
  catalog after carting also fails (AC4);
- success — stock decremented and persisted (fresh `loadCatalog`), order
  appended and re-readable (fresh `loadOrders`) with all FR4 fields,
  UUID/ISO shape checks, cent-safe total (0.10-style prices), returned
  cart is `EMPTY_CART` (AC1, AC5, AC6);
- card string absent from the raw text of both files (AC6);
- two sequential checkouts of the last-in-stock duck: first succeeds,
  second fails (AC7).

**Acceptance check:** `npm test` fully green — all `checkout.test.ts`
cases plus the entire pre-existing suite (spec AC10).
