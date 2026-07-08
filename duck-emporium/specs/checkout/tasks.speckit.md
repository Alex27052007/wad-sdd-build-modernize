---
description: "Task list for checkout feature implementation"
---

# Tasks: Check out with a Mocked Payment

**Input**: [spec.speckit.md](spec.speckit.md), [plan.speckit.md](plan.speckit.md)

**Prerequisites**: `src/cart.ts` (`Cart`, `CartLine`, `EMPTY_CART`, `cartTotal`) from add-to-cart story must exist before T005.

**Tests**: Included — every task requires passing tests as its acceptance gate.

**Organization**: Tasks are grouped by user story / phase to enable independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase (different files, no shared dependencies)
- **[Story]**: Which user story this task delivers (US1–US5)

---

## Phase 1: Shared Infrastructure

**Purpose**: Atomic-write helper and orders persistence — required by all user stories.

- [ ] T001 [US1] Create `src/persist.ts` with `writeJsonAtomic(filePath, value)`: serialize as 2-space JSON with trailing newline, write to `<filePath>.tmp`, then `renameSync` over the target
- [ ] T001-test [US1] Create `src/persist.test.ts`: write new file, overwrite existing file, content deep-equal after parse, output ends with `\n`, no `.tmp` file remains

- [ ] T002 [US1] Create `src/orders.ts` with `DEFAULT_ORDERS_PATH` (module-relative `data/orders.json`), `OrdersLoadError`, `loadOrders(filePath?)` (missing file → `[]`; corrupt/non-array → throws), `appendOrder(order, filePath?)` (load → push → `writeJsonAtomic`)
- [ ] T002-test [US1] Create `src/orders.test.ts` (sandboxed): missing path → `[]`; corrupt JSON throws `OrdersLoadError`; non-array top-level throws; `appendOrder` creates file on first order; multiple appends preserve order; append-then-load round-trips all `Order` fields

**Checkpoint**: Atomic write + orders persistence ready.

---

## Phase 2: Foundational Types and Catalog Extension

**Purpose**: Types consumed by all remaining tasks; `saveCatalog` enabling atomic stock writes.

- [ ] T003 [P] [US1] Export all types from `src/checkout.ts` (no functions yet): `CheckoutDetails`, `OrderItem`, `Order`, `OrderConfirmation`, `CheckoutResult`, `CheckoutOptions`; import `Cart` from `src/cart.ts` (defer `CheckoutResult` type to T005 if `cart.ts` does not yet exist)
- [ ] T004 [P] [US1] Extend `src/catalog.ts` with `saveCatalog(catalog: Duck[], filePath?)` using `writeJsonAtomic`; extend `src/catalog.test.ts` (sandboxed): save-then-loadCatalog round-trips exactly; extra field on a record survives round-trip; pre-existing catalog tests still pass

**Checkpoint**: Types exported; `saveCatalog` available.

---

## Phase 3: User Story 5 — Order Confirmation Rendering (Priority: P3)

**Goal**: `renderOrderConfirmation` — independent of checkout logic, can be implemented and tested in isolation.

- [ ] T005 [US5] Extend `src/render.ts` with `renderOrderConfirmation(order: Order): string` — order ID line, one line per item (duck name, quantity, `formatPrice` unit price, line subtotal), formatted total; same style as `renderCart`
- [ ] T005-test [US5] Extend `src/render.test.ts` with a fixture `Order`: output contains order ID; each duck name, quantity, formatted unit price, line subtotal; formatted total; multi-item order renders one line per item; pre-existing render tests still pass

**Acceptance gate**: `npm test -- src/render.test.ts` green.

---

## Phase 4: User Stories 1–4 — checkout() (Priority: P1 / P2)

**Purpose**: Core checkout function covering all user stories.

**⚠️ Prerequisite**: T001–T005 and `src/cart.ts` (`Cart`, `EMPTY_CART`, `cartTotal`) must exist.

- [ ] T006 [US1,US2,US3,US4] Implement `checkout(cart, details, options?)` in `src/checkout.ts` following the exact 7-step control flow from the plan:
  1. `validateDetails` — first invalid field → `{ ok: false, message }` naming the field; email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  2. Empty cart → `{ ok: false, message }`
  3. `loadCatalog(catalogPath)`; revalidate each line (duck exists, `quantity ≤ stock`) → `{ ok: false, message }` naming the duck; nothing written on any failure
  4. Mock payment: no-op
  5. Build updated catalog immutably, call `saveCatalog(updated, catalogPath)`
  6. Build `Order` (UUID via `node:crypto`, ISO timestamp, snapshot items/total, customer without card), call `appendOrder(order, ordersPath)`
  7. Return `{ ok: true, confirmation: { order, text: renderOrderConfirmation(order) }, cart: EMPTY_CART }`

- [ ] T006-test-US2 [US2] `src/checkout.test.ts` — validation rejections (sandboxed): blank/whitespace name, address, card each fail naming the field; emails without `@`, without domain dot, empty local part, empty domain each fail naming "email"; nothing written (no orders file created, catalog byte-identical)

- [ ] T006-test-US3 [US3] `src/checkout.test.ts` — empty cart: `checkout([], validDetails, opts)` returns `{ ok: false, message }`

- [ ] T006-test-US4 [US4] `src/checkout.test.ts` — stock revalidation (sandboxed): one valid + one over-stock line fails naming the over-stock duck; catalog file byte-identical (no partial decrement); duck removed from catalog after carting fails; two sequential checkouts of last-in-stock duck — first succeeds, second fails

- [ ] T006-test-US1 [US1] `src/checkout.test.ts` — success path (sandboxed): returned `ok: true`; `confirmation.order` has UUID-shaped `id`, ISO 8601 `createdAt`, correct `items` (snapshot name/price), cent-safe `total`, `customer` with name/email/address; fresh `loadCatalog` shows decremented stock; fresh `loadOrders` contains the order with all fields; returned `cart` is `EMPTY_CART`; `confirmation.text` contains order ID and formatted total; raw text of both files contains no card string

**Acceptance gate**: `npm test` fully green — all `checkout.test.ts` cases plus entire pre-existing suite.

---

## Phase 5: Final Verification

- [ ] T007 Run `npx tsc --noEmit` — zero TypeScript errors across all new and modified files
- [ ] T008 Run `npm test` — full suite green; no tests skipped; `data/ducks.json` and `data/orders.json` in the repo are unmodified (only sandboxed temp dirs were written)
