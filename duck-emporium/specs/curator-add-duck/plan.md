# Plan: Add a duck via curator endpoint (`curator-add-duck`)

**Source spec:** `specs/curator-add-duck/spec.md`
**Status:** Draft — awaiting approval

## Resolved open questions

- **Id generation:** use a slugified name with a numeric suffix when needed to avoid collisions.
- **Password handling:** read `ADMIN_PASSWORD` from `process.env` at request time rather than caching it at import time.

## Data model

No new duck fields are required. The add flow uses the existing `Duck` shape and a new input type for the admin request:

```ts
// src/catalog.ts
export interface CreateDuckInput {
  name: string;
  category: string;
  price: number;
  tagline: string;
  description: string;
  traits: string[];
  stock: number;
}

export interface AddDuckResult {
  ok: true;
  duck: Duck;
}

export interface AddDuckFailure {
  ok: false;
  message: string;
}
```

The implementation will create a new `Duck` record with a generated `id` and reuse the existing validator from `src/duck.ts`.

## Module / file layout

The feature fits naturally into the existing catalog and persistence modules:

```text
src/
  catalog.ts        # addDuckToCatalog + validation + slug generation
  catalog.test.ts   # add-duck business logic tests
  persist.ts        # existing atomic JSON write helper (reused)
  orders.ts         # no change; this story stays catalog-focused
  render.ts         # no change
```

Because there is no existing HTTP server layer in the repo, the story will expose an endpoint-facing function in the same module family rather than introducing a framework. This keeps the implementation aligned with the library-first workshop structure.

## Public interfaces

```ts
// src/catalog.ts
export interface CreateDuckInput {
  name: string;
  category: string;
  price: number;
  tagline: string;
  description: string;
  traits: string[];
  stock: number;
}

export type AddDuckResult =
  | { ok: true; duck: Duck }
  | { ok: false; message: string };

/** Validates, assigns an id, appends the duck to the catalog, and writes
 *  the catalog atomically to disk. */
export function addDuckToCatalog(
  input: CreateDuckInput,
  catalog: Duck[],
  filePath?: string,
  logger?: (message: string) => void,
): AddDuckResult;
```

```ts
// src/catalog.ts
/** Returns a stable slug for a duck name. */
export function slugifyName(name: string): string;
```

The endpoint wrapper will be a small function that checks `process.env.ADMIN_PASSWORD` and invokes the core add logic:

```ts
// src/catalog.ts
export interface AdminAddDuckRequest {
  password: string | undefined;
  payload: CreateDuckInput;
}

export function handleAdminAddDuck(
  request: AdminAddDuckRequest,
  catalog: Duck[],
  filePath?: string,
  logger?: (message: string) => void,
): AddDuckResult | { ok: false; status: 401; message: string };
```

## External dependencies

None. The implementation reuses the existing TypeScript/Node runtime and the current persistence helper.

## Testing strategy

Vitest will cover the contract end to end at the library level and the auth wrapper level:

1. **Validation** — missing fields, duplicate names, negative price, negative stock, non-integer stock, and empty traits all return a failure result with a clear message.
2. **Persistence** — a successful add writes the updated catalog to disk and a fresh `loadCatalog()` sees the new duck.
3. **Authentication** — missing or incorrect password returns HTTP 401-style failure; correct password succeeds.
4. **Logging** — a successful add writes a single stdout message containing the timestamp and duck name only.
5. **Regression** — existing catalog tests remain green.

## Risks

- **Slug collisions:** a simple slugify + numeric suffix strategy avoids duplicate ids when two ducks share a name.
- **Stringly-typed validation:** the implementation should reuse the existing `assertDuck` rules and keep validation messages readable.
- **Password handling:** reading the password directly from `process.env` at call time keeps tests deterministic and avoids module-level state.
