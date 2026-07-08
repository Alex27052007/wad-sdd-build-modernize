# Plan: Add ducks to a cart (`add-to-cart`)

**Source spec:** `specs/add-to-cart/spec.md`
**Depends on:** `duck-detail` (plan approved; implementation still pending
beyond `src/duck.ts`)
**Status:** Draft — awaiting approval

## Resolved open questions

All three spec open questions were resolved to the spec's assumed defaults,
per review:

- **Duplicate add:** quantities **merge** into the existing line item
  (merged total checked against stock).
- **Stock races:** the cart does **not** self-heal when stock drops after
  adding; checkout (story 4) revalidates. No `validateCart` in this story.
- **Message wording:** illustrative, not contractual — tests assert the
  essentials (duck name, available count), never exact strings.

## Implementation state this plan builds on

Only `src/duck.ts` / `src/duck.test.ts` exist (migrated `stock` model).
`data/ducks.json`, `src/catalog.ts` (`listDucks`, `getDuckById`), and
`src/render.ts` (`formatPrice`, `renderCatalog`, `stockLabel`,
`renderDuckDetail`) are defined by the duck-detail plan but **not yet
implemented** — and `package.json`'s `test` script is not yet wired to
vitest. This story's tasks must be sequenced after the duck-detail tasks
that create those modules; the cart consumes them as-is and changes nothing
about them except adding `renderCart` to `src/render.ts`.

## Data model

```ts
// src/cart.ts
export interface CartLine {
  duckId: string;   // references Duck.id; at most one line per duck id
  quantity: number; // positive integer (≥ 1); 0 is never stored
}

/** Ordered list; insertion order preserved, quantity edits don't reorder. */
export type Cart = readonly CartLine[];

export const EMPTY_CART: Cart = [];
```

A plain readonly array (rather than a wrapper object or class) keeps the
cart a pure value per the spec's FR1, and `EMPTY_CART` satisfies the
"empty constant" option. All operations return new arrays/line objects and
never mutate inputs (spec NFR3).

```ts
/** Discriminated result for expected failures (spec FR2). */
export type CartResult =
  | { ok: true; cart: Cart }
  | { ok: false; message: string };
```

## Module / file layout

```
src/cart.ts          # NEW: Cart/CartLine/CartResult, EMPTY_CART,
                     #   addToCart, setQuantity, removeFromCart, cartTotal
src/cart.test.ts     # NEW
src/render.ts        # EXTEND (duck-detail module): + renderCart
src/render.test.ts   # EXTEND: renderCart cases
```

Rationale: cart state logic is its own concern (`cart.ts`); presentation
stays in `render.ts`, following the duck-detail precedent that rendering is
one cohesive module. `render.ts` imports `cartTotal` from `cart.ts`;
`cart.ts` imports `Duck` from `duck.ts` and `getDuckById`/`listDucks` from
`catalog.ts`. No import cycles (cart never imports render).

## Public interfaces

```ts
// src/cart.ts

/** quantity defaults to 1; must be a positive integer. Unknown duckId,
 *  bad quantity, or merged total > duck.stock → { ok: false, message }
 *  with the duck's name and available stock in the message. Merges into
 *  an existing line (position kept). Catalog injectable like getDuckById;
 *  omitted → default seed. */
export function addToCart(
  cart: Cart, duckId: string, quantity?: number, catalog?: Duck[],
): CartResult;

/** quantity 0 → removes the line (ok). Positive integer → replaces the
 *  line's quantity, same stock check as addToCart. No such line, or
 *  negative/non-integer quantity → { ok: false, message }. */
export function setQuantity(
  cart: Cart, duckId: string, quantity: number, catalog?: Duck[],
): CartResult;

/** Idempotent: absent id returns an equivalent cart. Cannot fail, so it
 *  returns Cart directly rather than a CartResult. */
export function removeFromCart(cart: Cart, duckId: string): Cart;

/** Σ quantity × price over current catalog prices; 0 for empty cart.
 *  Cent-safe: sums Math.round(price * 100) per unit, divides once at the
 *  end. A line whose duckId is missing from the catalog throws TypeError
 *  (data-integrity/programmer error, consistent with assertDuck — carts
 *  are built through addToCart, which validates ids). */
export function cartTotal(cart: Cart, catalog?: Duck[]): number;
```

```ts
// src/render.ts (addition)

/** Multi-line text: one line per item — duck name, quantity, formatPrice
 *  unit price, formatPrice line subtotal — then the formatPrice running
 *  total. Empty cart → friendly message, e.g. "Your cart is empty — the
 *  ducks await." Never an empty string. Unknown duckId in a line throws,
 *  as in cartTotal. */
export function renderCart(cart: Cart, catalog?: Duck[]): string;
```

Design notes:

- **Default-catalog handling:** when `catalog` is omitted, operations load
  the seed via `listDucks()` once per call (no caching), matching the
  duck-detail decision for `getDuckById`. Tests always inject fixtures.
- **Failure leaves cart untouched (spec FR2):** trivially guaranteed —
  failures return no cart at all, and inputs are never mutated.
- **Quantity validation order:** validate the quantity shape first, then
  the duck id, then stock — so messages are specific (e.g. a non-integer
  quantity isn't misreported as an over-stock problem).

## External dependencies

**None added.** Same footprint as stories 1–2 (`node:` built-ins at
runtime via catalog seed loading; existing dev deps: typescript, tsx,
vitest, @types/node).

## Testing strategy

`src/cart.test.ts` uses small injected fixture catalogs (e.g. a duck with
`stock: 5`, one with `stock: 2`, one with `stock: 0`); no seed-file I/O
except one zero-arg smoke case. Mapping to the spec's acceptance criteria:

1. **Add defaults (AC1)** — add with no quantity → line quantity 1; with
   explicit quantity → that quantity; result `ok: true`.
2. **Merge (AC2)** — two adds of the same id → one line, summed quantity,
   original position kept; a different duck appends after it.
3. **Over-stock (AC3)** — add exceeding stock, merge pushing over stock,
   and `setQuantity` above stock all → `ok: false`; message contains the
   duck's *name* and the available *count* (substring assertions, not
   exact strings); input cart deep-equals its original value.
4. **Bad input (AC4)** — unknown id, quantity `0` on add, negative,
   fractional, `NaN` → `ok: false` with a non-empty message; `stock: 0`
   duck can never be added.
5. **Set/remove (AC5)** — `setQuantity` to valid value replaces (no
   reorder); to `0` removes with `ok: true`; `setQuantity` on absent line
   fails; `removeFromCart` removes, and on an absent id returns an
   equivalent cart.
6. **Total (AC6)** — `EMPTY_CART → 0`; multi-line sum; float-trap case
   (e.g. 3 × €0.10 = €0.30 exactly, asserted with `toBe`, not
   `toBeCloseTo`); unknown line id throws TypeError.
7. **Rendering (AC7)** — in `render.test.ts`: output contains each duck's
   name, quantity, formatted unit price, line subtotal, and formatted
   total; `renderCart(EMPTY_CART)` yields the friendly message and never
   an empty string.
8. **Purity (AC8)** — inputs passed as `Object.freeze`d carts/lines/
   catalogs: any mutation throws in strict mode, so every green test
   doubles as an immutability proof; explicit check that no duck's `stock`
   changed after a sequence of operations.
9. **Suite (AC9)** — `npm test` green across all modules.

## Risks

- **Unbuilt dependencies:** `catalog.ts`, `render.ts`, and the seed don't
  exist yet; this story's tasks are blocked until the duck-detail tasks
  (model → seed → catalog → render) land. The tasks.md must state this
  ordering explicitly rather than assume it.
- **Stale carts by design:** validate-only means a cart can silently
  exceed stock after catalog edits (story 6) and `cartTotal` reflects
  price changes immediately. Accepted per resolved question; story 4 owns
  revalidation. The risk is someone later "fixing" this in the cart —
  the spec's out-of-scope note is the guard.
- **Throw vs. result asymmetry:** `cartTotal`/`renderCart` throw on
  unknown line ids while `addToCart` returns a result for the same id.
  Deliberate (post-construction integrity vs. user input) but worth a
  doc comment so story 9 doesn't map the throw to a user-facing 500 for
  what is really a race — checkout revalidation (story 4) is the answer.
- **Message-copy coupling:** avoided up front — assertions are
  substring-based per the resolved question, so copy tweaks don't break
  tests (unlike the accepted copy-coupling in duck-detail's labels).
