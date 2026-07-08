# Contract: checkout()

**Module**: `src/checkout.ts` | **Feature**: `checkout` | **Date**: 2026-07-08

This is a library contract (not an HTTP API). The function is the sole public entry point for the checkout flow.

---

## Function Signature

```ts
function checkout(
  cart: Cart,
  details: CheckoutDetails,
  options?: CheckoutOptions,
): CheckoutResult;
```

---

## Parameters

### `cart: Cart`

```ts
type Cart = readonly CartLine[];
interface CartLine { duckId: string; quantity: number; }
```

- Must be a (possibly empty) array of `CartLine`.
- Empty array → `{ ok: false, message }` (no stock is touched).
- Duplicate `duckId` entries are not merged — each line is checked independently.

### `details: CheckoutDetails`

```ts
interface CheckoutDetails {
  name: string;
  email: string;
  address: string;
  card: string;
}
```

| Field | Constraint | On violation |
|---|---|---|
| `name` | `name.trim() !== ""` | `{ ok: false, message }` containing `"name"` |
| `email` | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `{ ok: false, message }` containing `"email"` |
| `address` | `address.trim() !== ""` | `{ ok: false, message }` containing `"address"` |
| `card` | `card.trim() !== ""` | `{ ok: false, message }` containing `"card"` |

Validation is short-circuit: only the **first** failing field produces a failure message.

### `options?: CheckoutOptions`

```ts
interface CheckoutOptions {
  catalogPath?: string; // default: DEFAULT_SEED_PATH
  ordersPath?: string;  // default: DEFAULT_ORDERS_PATH
}
```

Both fields default to the real data files. Provide overrides in tests to avoid touching `data/`.

---

## Return Value: `CheckoutResult`

```ts
type CheckoutResult =
  | { ok: true;  confirmation: OrderConfirmation; cart: Cart }
  | { ok: false; message: string };
```

### Success (`ok: true`)

| Field | Type | Description |
|---|---|---|
| `confirmation.order` | `Order` | Persisted order record |
| `confirmation.order.id` | `string` | UUID v4 (`crypto.randomUUID()`) |
| `confirmation.order.items` | `OrderItem[]` | Snapshot of cart lines (name + price at purchase time) |
| `confirmation.order.total` | `number` | `cartTotal(cart, catalog)` — cent-safe |
| `confirmation.order.createdAt` | `string` | ISO 8601 UTC (`new Date().toISOString()`) |
| `confirmation.order.customer` | object | `{ name, email, address }` — **no card** |
| `confirmation.text` | `string` | `renderOrderConfirmation(order)` |
| `cart` | `Cart` | Always `EMPTY_CART` (`[]`) |

### Failure (`ok: false`)

| Field | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable reason. **Not contractual** — tests assert by substring, not exact value. |

---

## Side Effects (success path only)

1. **`data/ducks.json`** (or `options.catalogPath`) — overwritten with decremented stock via `writeJsonAtomic`.
2. **`data/orders.json`** (or `options.ordersPath`) — order appended via `writeJsonAtomic` (file created on first order).

On **any failure** (`ok: false`), **no side effects occur** — both files are left unchanged.

---

## Error Behaviour

| Condition | Behaviour |
|---|---|
| Invalid/missing details field | `{ ok: false, message }` — no throw |
| Empty cart | `{ ok: false, message }` — no throw |
| Duck out of stock or missing | `{ ok: false, message }` naming the duck — no throw |
| `data/ducks.json` unreadable or corrupt | throws `CatalogLoadError` (programmer/environment error) |
| `data/orders.json` unreadable or corrupt | throws `OrdersLoadError` (programmer/environment error) |
| File system write failure | throws native `Error` from `fs.renameSync` |

Exceptions are reserved for programmer or environment errors, consistent with `CatalogLoadError`.

---

## Related Exports (`src/orders.ts`)

```ts
const DEFAULT_ORDERS_PATH: string;

class OrdersLoadError extends Error {}

function loadOrders(filePath?: string): Order[];
// Missing file → []
// Corrupt/non-array → throws OrdersLoadError

function appendOrder(order: Order, filePath?: string): void;
// load → push → writeJsonAtomic
```

---

## Related Exports (`src/render.ts`)

```ts
function renderOrderConfirmation(order: Order): string;
// Multi-line plain text:
// "Order #<id>"
// "<name> × <quantity> @ <formatPrice(price)> = <formatPrice(subtotal)>"  (one line per item)
// "Total: <formatPrice(total)>"
```

---

## Contract Guarantees

1. `ok: false` on any validation or stock failure — no writes, no side effects.
2. `ok: true` implies: stock decremented and persisted; order appended; `cart === EMPTY_CART`.
3. `order.customer` never contains `card`.
4. `order.id` matches UUID v4 format.
5. `order.createdAt` parses as a valid `Date`.
6. `order.total === cartTotal(cart, catalog)` (same arithmetic, cent-safe).
7. File writes use write-temp-then-rename — a crash never leaves a half-written file.
