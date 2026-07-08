# Plan: Check out with a mocked payment (`checkout`)

**Source spec:** `specs/checkout/spec.md`
**Depends on:** `add-to-cart` (spec/plan/tasks committed; **implementation
pending** — `src/cart.ts` does not exist yet)
**Status:** Draft — awaiting approval

## Resolved open questions

All three spec open questions stand at their documented defaults, per
review:

- **Seed mutation:** real checkouts write decremented stock back to
  `data/ducks.json` in place; git recovers the pristine seed. No separate
  state file.
- **Crash between writes:** stock is persisted before the order; a crash
  between the two writes loses the order but keeps the decrement.
  Accepted at workshop scale.
- **Message wording:** illustrative, not contractual — tests assert
  essentials (field name, duck name, available count), never exact
  strings.

## Implementation state this plan builds on

- **Exists:** `src/duck.ts` (`Duck`, `assertDuck`), `src/catalog.ts`
  (`loadCatalog`, `listDucks`, `getDuckById`, `DEFAULT_SEED_PATH`,
  `CatalogLoadError`), `src/render.ts` (`formatPrice` et al.),
  `data/ducks.json`, vitest-wired `npm test`.
- **Pending prerequisite:** the add-to-cart tasks deliver `src/cart.ts`
  (`Cart`, `CartLine`, `EMPTY_CART`, `CartResult`, `cartTotal`) and
  `renderCart`. Checkout consumes `Cart`, `EMPTY_CART`, and `cartTotal`
  as specified there; no checkout task may start before add-to-cart
  tasks 1 and 3 (model + total) have landed.

## Data model

All types exported from `src/checkout.ts`:

```ts
interface CheckoutDetails {
  name: string;    // non-empty after trim
  email: string;   // conservative name@domain.tld pattern
  address: string; // non-empty after trim
  card: string;    // non-empty after trim; mocked, never persisted
}

interface OrderItem {
  duckId: string;
  name: string;     // duck name at purchase time
  quantity: number;
  price: number;    // unit price at purchase time
}

interface Order {
  id: string;        // crypto.randomUUID()
  items: OrderItem[];
  total: number;     // cent-safe, same arithmetic as cartTotal
  createdAt: string; // new Date().toISOString()
  customer: { name: string; email: string; address: string }; // no card
}

interface OrderConfirmation {
  order: Order;
  text: string; // renderOrderConfirmation(order)
}

type CheckoutResult =
  | { ok: true; confirmation: OrderConfirmation; cart: Cart } // cart = EMPTY_CART
  | { ok: false; message: string };

interface CheckoutOptions {
  catalogPath?: string; // default DEFAULT_SEED_PATH
  ordersPath?: string;  // default DEFAULT_ORDERS_PATH
}
```

The orders file is a JSON array of `Order`. Email pattern:
`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — at least one non-space/@ char before
`@`, and a domain with a dot flanked by characters (spec FR1).

## Module / file layout

| File | Change | Contents |
|---|---|---|
| `src/persist.ts` | new | `writeJsonAtomic(filePath, value)` — serialize (2-space JSON + trailing newline, matching the seed), write to `<filePath>.tmp`, `renameSync` over the target. Shared by catalog and orders writes. |
| `src/orders.ts` | new | `DEFAULT_ORDERS_PATH` (`data/orders.json`, resolved relative to the module like `DEFAULT_SEED_PATH`), `OrdersLoadError` (mirrors `CatalogLoadError`), `loadOrders(filePath?)` (missing file → `[]`; unreadable/corrupt → throw), `appendOrder(order, filePath?)` (load → append → `writeJsonAtomic`). |
| `src/catalog.ts` | extend | add `saveCatalog(catalog: Duck[], filePath?)` via `writeJsonAtomic`. Writes the full duck records as loaded (stock updated by the caller), so unknown-to-us extra fields survive a round-trip. |
| `src/checkout.ts` | new | types above + `checkout(cart, details, options?)`; internal `validateDetails` and stock revalidation helpers (pure). |
| `src/render.ts` | extend | `renderOrderConfirmation(order: Order): string` — order ID line, one line per item (name, quantity, `formatPrice` unit price, line subtotal), formatted total; same style as `renderCart`. |
| `*.test.ts` | new/extend | next to each touched source file. |

`checkout` control flow (spec FR3, exact order):

1. `validateDetails` — first invalid field fails with a message naming it.
2. Empty cart → failure.
3. `loadCatalog(catalogPath)`; every line: duck exists and
   `quantity ≤ stock`, else failure naming the offending duck(s). Pure
   check — nothing written on any failure (this is what makes step 5
   all-or-nothing).
4. Mock payment: no-op (card validated in step 1).
5. Build the decremented catalog (map, no mutation) and
   `saveCatalog(updated, catalogPath)`.
6. Build `Order` (items/total from the loaded catalog via `cartTotal`
   arithmetic), `appendOrder(order, ordersPath)`.
7. Return `{ ok: true, confirmation: { order, text }, cart: EMPTY_CART }`.

## Public interfaces

New/changed exports only:

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
export type { CheckoutDetails, OrderItem, Order, OrderConfirmation,
              CheckoutResult, CheckoutOptions };
export function checkout(
  cart: Cart,
  details: CheckoutDetails,
  options?: CheckoutOptions,
): CheckoutResult;

// src/render.ts (addition)
export function renderOrderConfirmation(order: Order): string;
```

No injectable clock or ID generator: tests assert `createdAt` parses as
ISO 8601 and `id` matches the UUID shape, rather than pinning values.

## External dependencies

None new. `node:crypto` (`randomUUID`), `node:fs`
(`readFileSync`/`writeFileSync`/`renameSync`/`existsSync`), `node:os` +
`node:path` (temp dirs in tests). Dev tooling unchanged (vitest, tsc).

## Testing strategy

Every filesystem test builds a sandbox with `mkdtempSync(join(tmpdir(),
…))`: a copied catalog fixture and an orders path inside it, passed via
`CheckoutOptions` — the repo's `data/` is never touched (spec AC9;
`DEFAULT_*` constants are asserted as paths, never written to).

- **Validation (AC2, AC3):** blank/whitespace name, address, card; email
  without `@`, without a domain dot, with empty local/domain parts —
  each fails naming the field; empty cart fails. Nothing written (orders
  file absent, catalog file byte-identical).
- **Stock revalidation + atomicity (AC4):** cart with one valid and one
  over-stock line → failure names the over-stock duck and the catalog
  file is byte-identical (the valid line was not decremented). Also:
  duck deleted from catalog after being carted.
- **Success path (AC1, AC5, AC6):** decrement persisted — fresh
  `loadCatalog(path)` shows reduced stock; order appended — fresh
  `loadOrders(path)` returns it with all FR4 fields; UUID/ISO shape
  checks; total equals the cent-safe sum (use a price like 0.10 to catch
  float drift); returned cart is `EMPTY_CART`.
- **Card never persisted (AC6):** after success, raw text of both files
  does not contain the card string.
- **Race (AC7):** two sequential checkouts of the same last-in-stock
  duck against one sandbox — first succeeds, second fails the stock
  check.
- **Rendering (AC8):** `renderOrderConfirmation` contains ID, names,
  quantities, formatted prices, subtotals, total; unit tests directly on
  a fixture `Order`.
- **Modules in isolation:** `writeJsonAtomic` (writes, leaves no `.tmp`,
  round-trips), `loadOrders` (missing → `[]`, corrupt → throws),
  `saveCatalog` (round-trips extra fields), multi-order append order
  preserved.
- Message assertions check essentials via substring, never full strings.

## Risks

- **Add-to-cart not implemented:** `src/cart.ts` is still only specified.
  Mitigation: explicit sequencing gate above; checkout tasks reference
  the add-to-cart task numbers they need.
- **Seed mutation in real runs:** a manual checkout permanently edits
  `data/ducks.json` (git-recoverable). Documented spec trade-off; tests
  are sandboxed so CI never hits it.
- **Order file growth:** append is read-modify-write of the whole array —
  O(n) per order. Fine at workshop scale; flagged for story 9 if volume
  ever matters.
- **Lost order on crash between writes:** accepted spec trade-off
  (stock-then-order); `writeJsonAtomic` still guarantees each individual
  file is never half-written.
- **`Duck` shape drift:** `saveCatalog` writes records as loaded rather
  than reconstructing them, so fields added by later stories (e.g. story
  6 curator edits) survive checkout writes.
