# Spec: Add ducks to a cart (`add-to-cart`)

**Source story:** `../user-stories/03-add-to-cart.md`
**Depends on:** `duck-detail`
**Status:** Draft — awaiting approval

## Problem

Customers can browse the catalog (story 1) and inspect a single duck
(story 2), but there is no way to stage a purchase: every buying decision
would be all-or-nothing, one duck at a time. This story introduces a cart —
a session-scoped collection of line items (duck + quantity) with a running
total — so an indecisive customer can assemble, tweak, and review an order
before paying. Payment itself is story 4 (checkout) and remains mocked.

## Users

- **Quincy Quacker (customer):** wants to collect several ducks, change
  quantities as second thoughts strike, and see what the damage will be.
- **Later stories (indirect):** checkout (story 4) consumes the cart and
  owns stock decrementing; the web frontend (story 9) wraps the cart value
  in real per-session state and maps result values to HTTP responses.

## Scope

### In scope

- A `Cart` value type: an ordered list of line items, each referencing a
  duck by `id` with a positive integer quantity.
- Pure cart operations — each takes a cart (plus the catalog) and returns a
  result, never mutating its inputs:
  - add a duck by id with an optional quantity (default 1),
  - set the quantity of an existing line item,
  - remove a line item.
- Validation of quantities against the duck's current `stock`, with a
  clear human-readable message on rejection.
- Computing the cart total from catalog prices.
- A plain-text cart renderer showing line items and the running total,
  including an empty-cart rendering.

### Out of scope

- User accounts or logins (per the story).
- Discounts, coupons, gift wrapping (per the story).
- Cross-session persistence (per the story) — "session" here means the
  caller holding onto the cart value; story 9 owns real session state.
- Decrementing or reserving stock. Adding to the cart never changes
  `stock`; checkout (story 4) owns that. Two carts may therefore both
  contain the last duck — first checkout wins.
- Price-change handling between add and checkout (totals are always
  computed from the current catalog; story 4 revalidates).
- HTTP endpoints — still library-only until story 9.

## Functional requirements

### FR1 — Cart model

- A `Cart` is an ordered list of line items:

  | Field | Type | Notes |
  |---|---|---|
  | `duckId` | `string` | References `Duck.id`. At most one line item per duck id. |
  | `quantity` | `number` | Positive integer (`≥ 1`). A quantity of 0 is never stored — that's removal. |

- `emptyCart()` (or an exported empty constant) provides the starting
  value. Line items preserve insertion order; adjusting a quantity does not
  reorder.

### FR2 — Result values for expected failures

Cart operations that can fail for normal user reasons (over-stock, unknown
id, bad quantity) return a discriminated result, not an exception:

- success: `{ ok: true, cart: Cart }`
- failure: `{ ok: false, message: string }` where `message` is the clear,
  human-readable rejection text the story requires, and the input cart is
  left untouched (no partial application).

Exceptions remain reserved for programmer errors (e.g. invalid catalog
data), consistent with `assertDuck`.

### FR3 — Add to cart

`addToCart(cart, duckId, quantity?, catalog?)`:

- `quantity` defaults to `1`; it must be a positive integer, otherwise the
  operation fails with a message.
- Unknown `duckId` fails with a message (same exact-match semantics as
  `getDuckById`).
- If the duck is already in the cart, the quantities **merge** into the
  existing line item (its position is kept).
- The resulting line quantity (merged total) must not exceed the duck's
  current `stock`; otherwise the operation fails with a message that names
  the duck and the available stock (e.g. `Only 2 of "Sir Quacksalot" in
  stock`). A duck with `stock: 0` therefore can never be added.
- Like `listDucks`/`getDuckById`, the catalog argument is injectable; when
  omitted, the default seed is used.

### FR4 — Change quantity / remove

- `setQuantity(cart, duckId, quantity, catalog?)`:
  - fails with a message if the duck has no line item in the cart;
  - `quantity` of `0` removes the line item (success);
  - a positive integer replaces the line's quantity, subject to the same
    stock check as FR3;
  - negative or non-integer quantities fail with a message.
- `removeFromCart(cart, duckId)` removes the line item. Removing an id
  that is not in the cart succeeds and returns an equivalent cart
  (idempotent — the desired end state already holds).

### FR5 — Cart total

`cartTotal(cart, catalog?)` returns the sum over line items of
`quantity × price`, using current catalog prices. An empty cart totals `0`.
Cent-safe arithmetic: totals are computed in integer cents and converted
back, so e.g. three items at €0.10 total €0.30 exactly.

### FR6 — Cart rendering

- `renderCart(cart, catalog?)` returns multi-line plain text with one line
  per item — duck name, quantity, per-unit formatted price, and line
  subtotal — followed by the running total, all via the existing
  `formatPrice`.
- An empty cart renders a friendly message (e.g. `Your cart is empty — the
  ducks await.`), never an empty string.

## Non-functional requirements

- **NFR1 — Stack:** unchanged — TypeScript ES modules, Node 20+, `node:`
  built-ins only, no new runtime dependencies.
- **NFR2 — Tests:** Vitest, `*.test.ts` next to source; cart logic covered
  including all rejection paths.
- **NFR3 — Purity/immutability:** all cart operations are pure functions;
  they never mutate the input cart, line items, or catalog. Only default
  seed loading touches I/O, as in stories 1–2.

## Acceptance criteria

1. Adding a known duck with no quantity yields a line item with quantity 1;
   adding with an explicit quantity uses that quantity.
2. Adding a duck already in the cart merges quantities into one line item
   (no duplicate lines per duck id).
3. An add or quantity change that would push a line above the duck's
   `stock` fails with `ok: false` and a message naming the duck and the
   available stock; the returned/original cart is unchanged.
4. Adding an unknown duck id, a zero/negative quantity, or a non-integer
   quantity fails with `ok: false` and a clear message.
5. `setQuantity` to a valid positive value updates the line; `setQuantity`
   to `0` and `removeFromCart` both remove it; `removeFromCart` on an
   absent id succeeds.
6. `cartTotal` returns the exact sum of `quantity × price` (cent-safe) and
   `0` for the empty cart.
7. `renderCart` output contains each duck's name, quantity, formatted unit
   price, line subtotal, and the formatted running total; the empty cart
   renders the friendly message.
8. Cart operations never modify any duck's `stock`, and never mutate the
   cart or catalog passed in.
9. The full suite (`npm test`) passes.

## Open questions

- **Merge vs. reject on duplicate add:** merging quantities (FR3) is the
  assumed default. If "add" should instead fail when the duck is already
  in the cart, say so before planning.
- **Stock races:** validate-only means a cart can become invalid if stock
  drops after adding (e.g. curator edits, story 6). Assumed resolution:
  checkout (story 4) revalidates; the cart does not self-heal.
- **Rejection message wording:** exact phrasing (e.g. `Only 2 of "Sir
  Quacksalot" in stock`) is illustrative, not contractual — tests should
  assert on the essentials (duck name, available count), not exact strings.
