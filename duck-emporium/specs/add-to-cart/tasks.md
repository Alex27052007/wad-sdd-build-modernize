# Tasks: Add ducks to a cart (`add-to-cart`)

**Source plan:** `specs/add-to-cart/plan.md`
**Status:** Draft — awaiting approval

Cross-story prerequisite: per the plan, `data/ducks.json`, `src/catalog.ts`,
`src/render.ts`, and the vitest-wired `test` script are delivered by
**duck-detail tasks 2–4** and do not exist yet. No task below may start
before those land; nothing here re-plans them.

## Task 1 — Cart model and addToCart

**Files:** `src/cart.ts`, `src/cart.test.ts`
**Depends on:** duck-detail tasks 1–3 (`Duck` type, seed, `catalog.ts`)

Create `src/cart.ts` with the plan's data model: `CartLine`, `Cart`
(readonly array), `EMPTY_CART`, `CartResult`, and `addToCart(cart, duckId,
quantity?, catalog?)`. Semantics per plan: quantity defaults to 1 and must
be a positive integer; unknown id, bad quantity, or merged total exceeding
the duck's `stock` return `{ ok: false, message }` (message includes the
duck's name and available stock for the over-stock case); duplicate adds
merge into the existing line, keeping its position; omitted catalog loads
the seed via `listDucks()` per call. Validation order: quantity shape, then
duck id, then stock.

Tests (frozen fixture catalogs — every input `Object.freeze`d so mutation
throws): default and explicit quantity (spec AC1); merge behavior and line
order (AC2); over-stock on first add and on merge, asserting the message
*contains* the duck name and available count — no exact-string assertions
(AC3); unknown id, zero/negative/fractional/`NaN` quantity, `stock: 0`
duck never addable (AC4); one zero-arg smoke case against the real seed.

**Acceptance check:** `npx tsc --noEmit` passes; `npm test` green
including all new `cart.test.ts` cases (spec AC1–AC4 for add).

## Task 2 — setQuantity and removeFromCart

**Files:** `src/cart.ts`, `src/cart.test.ts`
**Depends on:** Task 1

Add `setQuantity(cart, duckId, quantity, catalog?)` — quantity `0` removes
the line (ok); a positive integer replaces the line's quantity under the
same stock check as `addToCart`; absent line or negative/non-integer
quantity fails with a message — and `removeFromCart(cart, duckId)`, which
returns a `Cart` directly (idempotent; absent id yields an equivalent
cart).

Tests (frozen fixtures): replace without reordering, set-to-0 removal,
over-stock rejection with name+count in the message, absent-line failure,
bad-quantity failures, `removeFromCart` on present and absent ids, input
cart unchanged after every failure (spec AC3–AC5).

**Acceptance check:** `npm test` green (spec AC5 plus the AC3/AC4 paths
for `setQuantity`).

## Task 3 — cartTotal, cent-safe

**Files:** `src/cart.ts`, `src/cart.test.ts`
**Depends on:** Task 1 (Cart type; independent of Task 2)

Add `cartTotal(cart, catalog?)`: sum of `quantity × price` in integer
cents (`Math.round(price * 100)` per unit, divide once at the end), `0`
for `EMPTY_CART`, `TypeError` when a line's `duckId` is missing from the
catalog. Include the plan's doc comment distinguishing this throw
(post-construction integrity) from `addToCart`'s result-value handling of
unknown ids.

Tests: empty cart → exactly `0`; multi-line sum; the float trap asserted
with `toBe` (e.g. 3 × €0.10 → `0.3` exactly); single line with quantity
> 1; unknown line id throws `TypeError` (spec AC6).

**Acceptance check:** `npm test` green (spec AC6).

## Task 4 — renderCart

**Files:** `src/render.ts`, `src/render.test.ts`
**Depends on:** Task 3 (`cartTotal`); duck-detail task 4 (`render.ts`,
`formatPrice`)

Add `renderCart(cart, catalog?)` to `src/render.ts`: one line per item
with duck name, quantity, `formatPrice` unit price, and `formatPrice` line
subtotal, followed by the `formatPrice` running total; `EMPTY_CART` → the
friendly empty message (e.g. "Your cart is empty — the ducks await."),
never an empty string; unknown line id throws, as in `cartTotal`. Import
direction: `render.ts` → `cart.ts` only (no cycle).

Tests: output contains each duck's name, quantity, formatted unit price,
line subtotal, and formatted total; empty-cart message present and
non-empty; unknown id throws (spec AC7).

**Acceptance check:** `npm test` green (spec AC7).

## Task 5 — Purity audit and acceptance sweep

**Files:** `src/cart.test.ts` (additions only; fixes elsewhere only if a
gap is found)
**Depends on:** Tasks 1–4

Add an explicit purity test: run a sequence of add / setQuantity / remove /
total / render operations over a frozen fixture catalog and assert no
duck's `stock` changed and every intermediate cart value deep-equals its
pre-operation snapshot (spec AC8). Then walk spec AC1–AC9 confirming each
maps to a green test; fix any gap found.

**Acceptance check:** `npm test` passes with the purity test included;
every acceptance criterion in `specs/add-to-cart/spec.md` maps to at least
one green test (AC9).

## Suggested commit order

1 → 2 → 3 → 4 → 5, one commit per task. Task 3 may be worked in parallel
with Task 2 (both depend only on Task 1), but commits land in numbered
order. All of it waits on duck-detail tasks 2–4 landing first.
