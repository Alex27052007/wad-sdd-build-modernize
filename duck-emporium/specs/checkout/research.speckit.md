# Research: Check out with a Mocked Payment

**Feature**: `checkout` | **Date**: 2026-07-08 | **Phase**: 0 (pre-design)

## Purpose

Phase 0 resolves all "NEEDS CLARIFICATION" items before the design phase begins, so plan.speckit.md and data-model.speckit.md can be written without ambiguity.

---

## Q1 — Existing codebase foundations

**Question**: Which modules and types already exist that checkout must consume?

**Resolution** (from codebase scan):

| Module | Exports consumed by checkout |
|---|---|
| `src/duck.ts` | `Duck` (id, name, image, bio, price, stock) |
| `src/catalog.ts` | `loadCatalog`, `getDuckById`, `DEFAULT_SEED_PATH`, `CatalogLoadError` |
| `src/cart.ts` | `Cart`, `CartLine`, `EMPTY_CART`, `cartTotal`, `CartResult` |
| `src/render.ts` | `formatPrice`, `renderCart` (style reference) |
| `src/persist.ts` | `writeJsonAtomic` |

All modules use ES modules (`"type": "module"`) with `node:` prefixes for built-ins.

---

## Q2 — Atomic write strategy

**Question**: How should file writes be made crash-safe?

**Resolution**: Use a write-temp-then-rename pattern already established by `src/persist.ts`:
1. Serialize to `<filePath>.tmp` with `writeFileSync`
2. `renameSync(<filePath>.tmp, filePath)` — atomic on POSIX

This is shared by both `saveCatalog` (catalog stock updates) and `appendOrder` (order persistence).

---

## Q3 — Orders file format and location

**Question**: Where are orders stored and in what format?

**Resolution**:
- Path: `data/orders.json` resolved module-relative (same convention as `DEFAULT_SEED_PATH`)
- Format: JSON array of `Order` objects; array created on first order, appended on each subsequent checkout
- Missing file = no orders yet (returns `[]`) — distinct from a corrupt file (throws `OrdersLoadError`)

---

## Q4 — Email validation regex

**Question**: What pattern satisfies "conservative `name@domain.tld`"?

**Resolution**: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- At least one non-whitespace, non-@ character before `@`
- At least one non-whitespace, non-@ character after `@` and before the last `.`
- At least one non-whitespace, non-@ character after the last `.`
- Rejects: `"notanemail"`, `"a@nodot"`, `"@domain.com"`, `"user@"`, `" @domain.com"`

---

## Q5 — Cent-safe total arithmetic

**Question**: How is `total` computed to avoid floating-point drift?

**Resolution**: Reuse `cartTotal` from `src/cart.ts`, which iterates `cart` lines and multiplies `quantity × price` (prices are integers in cents in the seed data, e.g. `1299` = $12.99). Same arithmetic as `renderCart`.

---

## Q6 — Stock decrement atomicity model

**Question**: What does "atomic" mean in this context?

**Resolution**: Single-process, in-call all-or-nothing:
- All stock checks happen **before** any write (pure validation pass)
- If any line fails, nothing is written
- Once all checks pass, the catalog is rebuilt immutably (`map` — no mutation) and saved in a single `writeJsonAtomic` call
- Cross-process races are explicitly out of scope (workshop constraint)

---

## Q7 — Card data security

**Question**: How is card data excluded from persistence?

**Resolution**: The `customer` field stored on `Order` contains only `{ name, email, address }`. The `card` field from `CheckoutDetails` is validated (non-empty trim) and then discarded — it is never assigned to any variable that reaches a file write. Tests verify by checking the raw text of both `ducks.json` and `orders.json` for the absence of the card string.

---

## Q8 — Injectable paths for testing

**Question**: How do tests avoid mutating `data/ducks.json` and `data/orders.json`?

**Resolution**: `checkout` accepts a `CheckoutOptions` object with optional `catalogPath` and `ordersPath`. Tests:
1. Create a `mkdtempSync` sandbox directory
2. Copy a catalog fixture into it
3. Pass sandbox paths via `CheckoutOptions`
4. Assert `DEFAULT_SEED_PATH` constants are never written to by the test suite

---

## Q9 — Duplicate duckId in cart

**Question**: Should checkout merge or reject duplicate `duckId` entries?

**Resolution**: Checkout does **not** merge. Each `CartLine` is processed independently. If the same `duckId` appears twice, both quantities are checked and decremented separately. Responsibility for merging lies with `addToCart` (which already prevents duplicates). This is documented but not validated at checkout time.

---

## Conclusion

All NEEDS CLARIFICATION items are resolved. No blockers for Phase 1 design.
