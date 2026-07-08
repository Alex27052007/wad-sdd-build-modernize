# Data Model: Check out with a Mocked Payment

**Feature**: `checkout` | **Date**: 2026-07-08 | **Phase**: 1

## Overview

The checkout feature introduces four new types (all exported from `src/checkout.ts`) and one new error class (`src/orders.ts`). It extends `Duck` (stock decrement) and composes `Cart` / `CartLine` from the add-to-cart story.

---

## Type Definitions

### `CheckoutDetails`

Input from the customer. `card` is mocked and **never persisted**.

```ts
interface CheckoutDetails {
  name: string;    // non-empty after trim
  email: string;   // /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  address: string; // non-empty after trim
  card: string;    // non-empty after trim; validated only, never stored
}
```

**Validation rules**:

| Field | Rule | Failure message (contains) |
|---|---|---|
| `name` | `name.trim() !== ""` | `"name"` |
| `email` | matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `"email"` |
| `address` | `address.trim() !== ""` | `"address"` |
| `card` | `card.trim() !== ""` | `"card"` |

First failing field wins (short-circuit); exact message wording is not contractual.

---

### `OrderItem`

Snapshot of a cart line at purchase time. Prices and names are captured from the catalog at the moment of checkout — subsequent catalog changes do not retroactively alter existing orders.

```ts
interface OrderItem {
  duckId: string;   // references Duck.id
  name: string;     // Duck.name at purchase time
  quantity: number; // positive integer, same as CartLine.quantity
  price: number;    // Duck.price at purchase time (cents)
}
```

---

### `Order`

Persisted record. Card data is **never** present.

```ts
interface Order {
  id: string;        // crypto.randomUUID() — UUID v4
  items: OrderItem[];
  total: number;     // sum(item.quantity × item.price), same arithmetic as cartTotal
  createdAt: string; // new Date().toISOString() — ISO 8601 UTC
  customer: {
    name: string;
    email: string;
    address: string;
    // NOTE: card intentionally absent
  };
}
```

**Example** (`data/orders.json` entry):

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "items": [
    { "duckId": "rubber-classic", "name": "Classic Rubber Duck", "quantity": 2, "price": 599 }
  ],
  "total": 1198,
  "createdAt": "2026-07-08T10:30:00.000Z",
  "customer": {
    "name": "Quincy Quacker",
    "email": "quincy@ducks.example",
    "address": "1 Duck Pond Lane"
  }
}
```

---

### `OrderConfirmation`

Returned as part of the success result. `text` is the pre-rendered confirmation string, so callers do not need to import `render.ts`.

```ts
interface OrderConfirmation {
  order: Order;
  text: string; // renderOrderConfirmation(order)
}
```

---

### `CheckoutResult`

Discriminated union in the style of `CartResult`.

```ts
type CheckoutResult =
  | { ok: true;  confirmation: OrderConfirmation; cart: Cart } // cart === EMPTY_CART
  | { ok: false; message: string };
```

On `ok: false`: nothing is decremented, nothing is persisted, the input `cart` is unchanged.

---

### `CheckoutOptions`

Dependency-injection bag for tests. Both fields default to the real data-file paths.

```ts
interface CheckoutOptions {
  catalogPath?: string; // default: DEFAULT_SEED_PATH from catalog.ts
  ordersPath?: string;  // default: DEFAULT_ORDERS_PATH from orders.ts
}
```

---

### `OrdersLoadError` (`src/orders.ts`)

Mirrors `CatalogLoadError`. Thrown when the orders file exists but cannot be read or parsed.

```ts
class OrdersLoadError extends Error {
  constructor(filePath: string, problem: string, options?: ErrorOptions);
  // name: "OrdersLoadError"
  // message: `Failed to load orders from ${filePath}: ${problem}`
}
```

**Not** thrown when the file is missing (returns `[]` instead).

---

## File Storage Schema

### `data/orders.json`

Top-level JSON array of `Order`. Created on the first successful checkout; appended atomically on each subsequent checkout.

```json
[
  { /* Order */ },
  { /* Order */ }
]
```

### `data/ducks.json`

Existing format — `Duck[]`. The `stock` field is decremented and persisted after each successful checkout via `saveCatalog`. Card data never appears here.

---

## Entity Relationships

```
Cart (CartLine[])
  └─ CartLine { duckId, quantity }
        │
        │ lookup at checkout time
        ▼
Catalog (Duck[])
  └─ Duck { id, name, image, bio, price, stock }
        │
        │ snapshot (name, price) + stock decrement
        ▼
Order
  ├─ id (UUID)
  ├─ items (OrderItem[] — snapshots from Duck)
  ├─ total (cartTotal arithmetic)
  ├─ createdAt (ISO 8601)
  └─ customer { name, email, address }  ← from CheckoutDetails (no card)
```

---

## Constraints

- `Order.total` must be computed with the same arithmetic as `cartTotal` to avoid drift.
- `OrderItem.price` is a snapshot — it must be read from the catalog at checkout time, not recalculated later.
- `card` must never appear in any `Order`, `OrderItem`, `customer` object, or file write.
- `Order.id` must be a valid UUID v4 string (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`).
- `Order.createdAt` must be a valid ISO 8601 UTC timestamp parseable by `new Date()`.
