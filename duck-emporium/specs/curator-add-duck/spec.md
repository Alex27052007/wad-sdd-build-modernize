# Spec: Add a duck via curator endpoint (`curator-add-duck`)

**Source story:** `../user-stories/06-curator-add-duck.md`
**Status:** Draft — awaiting approval

## Problem

The catalog can be browsed and filtered, but only the seed file can change what ducks are available. That makes it difficult for the curator to add a new duck during a workshop or demo without editing JSON by hand. This story introduces a library-level add-duck operation and an admin endpoint that accepts a new duck payload, validates it, persists it, and makes the duck visible immediately.

## Users

- **Dr. Mallard (curator/admin):** wants to add a new duck without editing seed files directly.
- **Customers (indirect):** should see the new duck immediately in the catalog after a successful add.

## Scope

### In scope

- A library-level function to add a duck to the catalog.
- Server-side validation for required fields and basic business rules.
- Password-protected admin access via an environment variable.
- Persistent catalog updates that survive restarts.
- Logging of successful add operations to stdout with timestamp and duck name only.
- Unit tests for validation, persistence, and endpoint behavior.

### Out of scope

- A full admin UI.
- Editing or deleting existing ducks.
- Per-user admin accounts or role-based access control.
- Real payment or external storage systems.

## Functional requirements

### FR1 — Duck payload

The admin endpoint accepts a new duck payload with the following fields:

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Required, non-empty after trimming. |
| `category` | `string` | Required, non-empty after trimming. |
| `price` | `number` | Required, finite, non-negative, at most two decimal places. |
| `tagline` | `string` | Required, non-empty after trimming. |
| `description` | `string` | Required, non-empty after trimming. |
| `traits` | `string[]` | Required, non-empty array of non-empty strings. |
| `stock` | `number` | Required, non-negative integer. |

The payload is converted into a duck record with an `id` assigned automatically from the name (slugified, unique, stable for the same name).

### FR2 — Validation and duplicate rules

The add operation rejects invalid input with a clear message. Validation failures include:

- missing or blank required fields
- duplicate duck name
- negative price
- negative stock
- non-integer stock
- malformed trait values
- malformed price values

The duplicate-name rule is case-insensitive and is based on the normalized name.

### FR3 — Admin authentication

The endpoint requires a shared admin password supplied via the environment variable `ADMIN_PASSWORD`.

- Requests without the password are rejected with HTTP 401.
- Requests with the wrong password are rejected with HTTP 401.
- Requests with the correct password proceed to validation and persistence.

### FR4 — Persistence

A successful add writes the updated catalog back to disk using the same atomic write pattern as the existing persistence helpers.

- The catalog is updated in place and becomes visible to subsequent catalog listings.
- The persistence path is injectable for tests.
- The data file remains a JSON array of duck records.

### FR5 — Logging

Successful add operations are logged to stdout with:

- a timestamp
- the duck name

No customer PII or secrets are logged. The password is never logged.

### FR6 — Endpoint contract

The endpoint returns a clear success or failure result:

- success: a success status and the created duck record
- failure: an error status plus a human-readable message

The contract is explicit enough for a future web frontend to map it to HTTP responses.

## Non-functional requirements

- **NFR1 — Stack:** TypeScript, ES modules, Node 20+, `node:`-prefixed built-ins only.
- **NFR2 — Tests:** Vitest tests live next to source as `*.test.ts` and cover validation, persistence, and endpoint behavior.
- **NFR3 — Purity boundaries:** validation and id generation are pure; disk I/O is isolated to persistence and endpoint wiring.
- **NFR4 — Security:** the password is read from the environment only; it is not hard-coded in source.

## Acceptance criteria

1. A valid add request creates a duck with an automatically generated slug id and makes it appear in the catalog listing.
2. Requests without or with the wrong admin password are rejected with HTTP 401.
3. Validation rejects duplicate names, negative prices, negative stock, missing required fields, and malformed traits.
4. A successful add persists the updated catalog and is visible after a fresh catalog load.
5. Successful adds are logged to stdout with timestamp and duck name only.
6. The full suite (`npm test`) passes.

## Open questions

- **Id generation strategy:** should ids be derived from the name using a simple slugifier, or should the system assign a UUID-like id? Default assumption: slugified name with a numeric suffix if necessary to avoid collisions.
- **Password handling:** the endpoint should read `ADMIN_PASSWORD` from the environment at request time, rather than caching it at module load time.
