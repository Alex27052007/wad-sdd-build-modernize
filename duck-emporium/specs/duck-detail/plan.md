# Plan: View a duck's detail page (`duck-detail`)

**Source spec:** `specs/duck-detail/spec.md`
**Depends on:** `browse-catalog` (plan + partial implementation)
**Status:** Draft — awaiting approval

## Resolved open questions

- **Stock-1 label:** `Last duck!` (special case), per review. The full
  ladder: `0 → "Sold out"`, `1 → "Last duck!"`, `2–3 → "Only N left"`,
  `≥ 4 → "In stock"`. The spec's AC3 examples for 0/2/3/4 are unchanged;
  this refines the spec's FR4 table for the 1 case (spec left unmodified
  per workflow).
- **Trait/power vocabulary:** free-form strings; story 8 owns any future
  controlled vocabulary.

## Implementation state this plan builds on

Browse-catalog is only partially implemented: `src/duck.ts` +
`src/duck.test.ts` exist (task 1); the seed file, `src/catalog.ts`, and
`src/render.ts` (tasks 2–4) do not exist yet. Rather than building them to
the old model and migrating immediately, **the remaining story-1 tasks are
built directly against the migrated model defined here** (numeric `stock`,
id in the catalog line). The browse-catalog tasks.md remains the source for
*what* those modules do; this plan supersedes it on the model details, as
recorded in the duck-detail spec.

## Data model

```ts
// src/duck.ts — after migration
export interface Duck {
  id: string;          // unique slug (unchanged)
  name: string;        // unchanged
  category: string;    // unchanged
  price: number;       // euros, ≤ 2 decimals (unchanged)
  tagline: string;     // unchanged
  stock: number;       // REPLACES inStock — non-negative integer, 0 = sold out
  description: string; // long-form backstory, non-empty
  traits: string[];    // ≥ 1 entries, each non-empty
  powers: string[];    // ≥ 0 entries, each non-empty
}
```

`assertDuck` gains rules: `stock` a non-negative integer;
`description` a non-empty string; `traits` a non-empty array of non-empty
strings; `powers` an array (possibly empty) of non-empty strings; `inStock`
is no longer a known field (no tolerance for it — a seed still carrying it
fails the "must be" checks only if we validate strictly; we do not reject
unknown extra fields, consistent with story 1).

## Module / file layout

No new modules — the story extends the three planned ones:

```
data/ducks.json       # seed: 12 ducks with full detail fields (updated FR2)
src/duck.ts           # extended interface + validator   (exists — migrate)
src/duck.test.ts      # migrated + extended tests        (exists — migrate)
src/catalog.ts        # story-1 loader/listing + getDuckById
src/catalog.test.ts
src/render.ts         # story-1 renderCatalog (now with id) + stockLabel
                      #   + renderDuckDetail + formatPrice
src/render.test.ts
```

Rationale: lookup is a catalog concern (`catalog.ts`), presentation is a
rendering concern (`render.ts`); a separate `detail.ts` would split one
cohesive rendering module for no gain at this size.

## Public interfaces

```ts
// src/catalog.ts (additions to the story-1 surface)
/** Exact, case-sensitive match on id. undefined = no such duck (expected
 *  outcome, maps to HTTP 404 in story 9). Catalog injectable like
 *  listDucks; when omitted, loads DEFAULT_SEED_PATH (no caching — the
 *  file is small; callers wanting reuse pass a loaded catalog). */
export function getDuckById(id: string, catalog?: Duck[]): Duck | undefined;
```

```ts
// src/render.ts (additions/changes)
/** 0 → "Sold out" | 1 → "Last duck!" | 2..3 → "Only N left"
 *  | ≥4 → "In stock". Throws on negative or non-integer input. */
export function stockLabel(stock: number): string;

/** Multi-line text: name, category, formatPrice(price), tagline,
 *  description, traits, powers ("Powers: none" when empty), stockLabel.
 *  renderDuckDetail(undefined) → friendly not-found message, e.g.
 *  "This duck has waddled off — no duck with that id." Never empty. */
export function renderDuckDetail(duck: Duck | undefined): string;

// renderCatalog (story 1): each line now begins with the duck's id,
// e.g. "captain-quackbeard — Captain Quackbeard (pirate) — 14,99 € — …"
```

## External dependencies

**None added.** Same footprint as story 1 (`node:fs`/`node:path`/`node:url`
at runtime, existing dev deps).

## Testing strategy

Mapping to the spec's acceptance criteria:

1. **Model migration (AC7)** — `duck.test.ts`: valid-duck fixture gains the
   new fields; new rejection cases (negative/fractional `stock`, empty
   `description`, empty `traits` array, empty string inside
   `traits`/`powers`); all `inStock` references removed.
2. **Lookup (AC1, AC2)** — `catalog.test.ts` with injected fixtures: known
   id returns the full record; unknown id, wrong case, and empty string
   return `undefined`; zero-arg form resolves against the real seed.
3. **Stock label (AC3 + resolved wording)** — table test:
   `0 → "Sold out"`, `1 → "Last duck!"`, `2 → "Only 2 left"`,
   `3 → "Only 3 left"`, `4 → "In stock"`, `100 → "In stock"`; negative and
   fractional input throw.
4. **Detail rendering (AC2, AC4)** — output contains every field including
   each trait and power; empty `powers` renders the explicit
   `Powers: none` form; `renderDuckDetail(undefined)` returns the
   not-found message and never an empty string.
5. **Catalog line ids (AC6)** — each `renderCatalog` line contains the
   duck's id.
6. **Seed integrity (AC5)** — extends the story-1 seed test: all 12 ducks
   pass the extended validator; ≥ 1 duck with `stock: 0`; ≥ 1 with
   `stock: 1` and ≥ 1 with stock 2–3 (so "Last duck!" and "Only N left"
   are both exercised by real data); no `inStock` key anywhere in the file.
7. **AC7** — `npm test` green across the merged suite.

## Risks

- **Superseded story-1 docs:** browse-catalog's spec/plan/tasks still say
  `inStock` and an id-less catalog line. Anyone implementing story-1 tasks
  from those docs verbatim builds the wrong model. Mitigated by migrating
  `src/duck.ts` first (the compiler then rejects old-model code) and by the
  supersession note in both this plan and the duck-detail spec.
- **Interleaved implementation:** story-1 tasks 2–4 and this story's tasks
  touch the same three files. The duck-detail tasks.md must sequence them
  explicitly (model migration → seed with full fields → catalog → render)
  so no task builds on a shape another task is about to change.
- **Seed content volume:** 12 ducks × (description + traits + powers) is
  the bulk of the work and easy to get rejected by the validator (e.g. an
  empty-string trait). The seed-integrity test catches this immediately.
- **Copy-coupled tests:** label and not-found wording are asserted in
  tests; future copy tweaks are (accepted) test changes.
