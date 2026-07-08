# Plan: Browse the duck catalog (`browse-catalog`)

**Source spec:** `specs/browse-catalog/spec.md`
**Status:** Draft — awaiting approval

## Resolved open questions

Decisions taken since the spec was approved (spec left unmodified per
workflow):

- **Currency:** prices render EUR-style with comma decimal separator and
  trailing symbol: `4,99 €`.
- **Price representation (review feedback):** stored as a decimal euro
  amount (`price: 14.99`), not integer cents. Reads naturally in the seed
  file; the cost is that later money arithmetic (cart/checkout) must round —
  see Risks.
- **Categories:** stay free-form `string`; no fixed vocabulary. Story 5 can
  derive the category list from the data.
- **Seed file location:** `data/ducks.json` at the repository root (decided
  below).

## Data model

```ts
// src/duck.ts
export interface Duck {
  id: string;        // unique slug, e.g. "captain-quackbeard"
  name: string;
  category: string;  // free-form label
  price: number;     // euros, non-negative, at most two decimal places
  tagline: string;
  inStock: boolean;
}
```

Alongside the interface, a runtime validator (hand-rolled type guard — no
runtime dependencies allowed) checks each seed record:

```ts
export function assertDuck(value: unknown, context: string): asserts value is Duck;
```

`context` (e.g. `ducks.json entry 3`) feeds the descriptive error required by
FR5. Validation rules: all six fields present with correct primitive types,
`price` a non-negative finite number with at most two decimal places
(checked via `Math.round(price * 100)` round-trip), non-empty `id`/`name`.

## Module / file layout

```
data/
  ducks.json          # seed catalog: array of Duck records (FR2)
src/
  duck.ts             # Duck interface + assertDuck validator (FR1)
  catalog.ts          # loadCatalog, listDucks (FR3, FR5)
  catalog.test.ts
  render.ts           # renderCatalog, formatPrice (FR4)
  render.test.ts
```

- `data/ducks.json`: 12 ducks across 4 categories (e.g. `classic`, `pirate`,
  `seasonal`, `professional`), unique ids, at least one duck with
  `inStock: false` — comfortably above the FR2 minimums so edits don't dip
  below them.
- Tests live next to source as `*.test.ts` per project convention.
- `package.json` gains a real script: `"test": "vitest run"`.

## Public interfaces

```ts
// src/catalog.ts
/** Absolute path to the default seed, resolved relative to this module,
 *  not the process CWD: new URL('../data/ducks.json', import.meta.url) */
export const DEFAULT_SEED_PATH: string;

/** Reads and validates a seed file. Throws CatalogLoadError naming the file
 *  and the specific problem (missing file, invalid JSON, not an array,
 *  bad record, duplicate id). An empty array is valid. */
export function loadCatalog(filePath?: string): Duck[];

/** All ducks in catalog order, including out-of-stock ones (flagged).
 *  With no argument, loads from DEFAULT_SEED_PATH. Returns a copy so
 *  callers can't mutate the catalog. */
export function listDucks(catalog?: Duck[]): Duck[];

export class CatalogLoadError extends Error {}
```

```ts
// src/render.ts
/** "4,99 €" — toFixed(2) with the dot swapped for a comma, no locale
 *  machinery. Throws on negative or non-finite input. */
export function formatPrice(price: number): string;

/** One line per duck: name, category, formatted price, tagline.
 *  For an empty list returns the explicit empty-state message:
 *  "The pond is empty — no ducks in the catalog yet." */
export function renderCatalog(ducks: Duck[]): string;
```

Design notes:

- The optional-argument shape of `listDucks` reconciles FR3 ("`listDucks()`
  returns all ducks") with NFR3 (listing is pure over injected data): the
  zero-arg call is a convenience wrapper over `loadCatalog()`, and every test
  except the seed-integrity ones injects fixtures.
- Only `loadCatalog` touches I/O (`node:fs` `readFileSync` — the catalog is
  small and callers are synchronous); `listDucks` with an argument,
  `renderCatalog`, and `formatPrice` are pure (NFR3).

## External dependencies

**None added.** Runtime uses only `node:fs` / `node:path` / `node:url`
(NFR1). Dev dependencies already present (`typescript`, `vitest`, `tsx`,
`@types/node`) suffice.

## Testing strategy

All tests in Vitest, mapping to the spec's acceptance criteria:

1. **Seed integrity (AC1–AC3, FR2)** — load the real `data/ducks.json`:
   ≥ 10 ducks, ≥ 3 distinct categories, unique ids, every record passes
   `assertDuck`, at least one `inStock: false`, order matches file order.
2. **Listing (AC1–AC3, FR3)** — with injected fixtures: returns all ducks
   including out-of-stock, preserves order, empty catalog → empty array,
   returned array is a copy (mutating it doesn't affect a second call).
3. **Rendering (AC4–AC5, FR4)** — fixture ducks: each line contains name,
   category, `formatPrice` output, tagline; `renderCatalog([])` returns the
   empty-state message and never an empty string. `formatPrice` cases:
   `0 → "0,00 €"`, `0.05 → "0,05 €"`, `4.99 → "4,99 €"`, `14.9 → "14,90 €"`,
   `1234.56 → "1234,56 €"`; negative or non-finite input throws.
4. **Load errors (AC6, FR5)** — temp files created via `node:fs` +
   `node:os` `mkdtemp`: missing file, invalid JSON, top-level non-array,
   record failing validation, duplicate id — each throws `CatalogLoadError`
   whose message names the file and the problem.
5. **AC7** — `npm test` runs `vitest run` and passes.

## Risks

- **Seed-path resolution:** resolving `data/ducks.json` from CWD breaks when
  tests or consumers run from another directory. Mitigated by resolving via
  `import.meta.url` (see `DEFAULT_SEED_PATH`).
- **Spec-text drift on `listDucks()`:** the spec's zero-arg signature and the
  purity NFR pull in opposite directions; the optional-argument design above
  is the reconciliation. Flagging so reviewers confirm it's acceptable.
- **Hand-rolled validation:** a type guard can drift from the interface if
  fields are added later (e.g. story 6). Kept in the same file as the
  interface (`src/duck.ts`) so changes are adjacent; seed-integrity test
  exercises it against real data.
- **Float money (accepted trade-off, review decision):** `price` is a binary
  float, so sums like `14.99 + 4.99 + 4.99` drift by fractions of a cent.
  Harmless in this story (display only, `toFixed(2)` rounds), but the
  cart/checkout stories must round every aggregate to two decimals — their
  plans should carry this constraint forward.
- **Currency formatting:** manual `4,99 €` formatting assumes non-negative
  finite input; enforced by validation, and `formatPrice` throws otherwise
  rather than silently misformatting.
