import { randomUUID } from "node:crypto";
import { EMPTY_CART, cartTotal, type Cart } from "./cart.js";
import { getDuckById, loadCatalog, saveCatalog } from "./catalog.js";
import { appendOrder } from "./orders.js";
import { renderOrderConfirmation } from "./render.js";

/** Customer details for a checkout. The card is mocked — any non-empty
 *  string is accepted and it is never persisted. */
export interface CheckoutDetails {
  name: string; // non-empty after trim
  email: string; // conservative name@domain.tld pattern
  address: string; // non-empty after trim
  card: string; // non-empty after trim; mocked, never persisted
}

export interface OrderItem {
  duckId: string;
  name: string; // duck name at purchase time
  quantity: number;
  price: number; // unit price at purchase time
}

export interface Order {
  id: string; // crypto.randomUUID()
  items: OrderItem[];
  total: number; // cent-safe, same arithmetic as cartTotal
  createdAt: string; // new Date().toISOString()
  customer: { name: string; email: string; address: string }; // no card
}

export interface OrderConfirmation {
  order: Order;
  text: string; // renderOrderConfirmation(order)
}

/** Discriminated result in the style of CartResult. On failure nothing
 *  is decremented, nothing is persisted, and the input cart is unchanged;
 *  on success `cart` is the cleared (empty) cart. */
export type CheckoutResult =
  | { ok: true; confirmation: OrderConfirmation; cart: Cart }
  | { ok: false; message: string };

export interface CheckoutOptions {
  catalogPath?: string; // default DEFAULT_SEED_PATH
  ordersPath?: string; // default DEFAULT_ORDERS_PATH
}

/** At least one non-space/@ char before the @, and a domain containing a
 *  dot with characters on both sides (spec FR1). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns the failure message for the first invalid field, or undefined
 *  when every field is valid. */
function validateDetails(details: CheckoutDetails): string | undefined {
  if (details.name.trim() === "") {
    return `Customer "name" must not be empty.`;
  }
  if (!EMAIL_PATTERN.test(details.email)) {
    return `Customer "email" must look like name@domain.tld.`;
  }
  if (details.address.trim() === "") {
    return `Customer "address" must not be empty.`;
  }
  if (details.card.trim() === "") {
    return `Customer "card" must not be empty.`;
  }
  return undefined;
}

/** Submits a cart as an order: validates details, rejects an empty cart,
 *  revalidates every line against current stock, mocks the payment,
 *  atomically decrements and persists stock, appends the order record,
 *  and returns the confirmation with the cleared cart. All-or-nothing:
 *  any failure happens before anything is written. */
export function checkout(
  cart: Cart,
  details: CheckoutDetails,
  options: CheckoutOptions = {},
): CheckoutResult {
  const invalid = validateDetails(details);
  if (invalid !== undefined) {
    return { ok: false, message: invalid };
  }
  if (cart.length === 0) {
    return { ok: false, message: "The cart is empty — there is nothing to order." };
  }

  const catalog = loadCatalog(options.catalogPath);
  const items: OrderItem[] = [];
  const problems: string[] = [];
  for (const line of cart) {
    const duck = getDuckById(line.duckId, catalog);
    if (duck === undefined) {
      problems.push(`no duck with id "${line.duckId}"`);
      continue;
    }
    if (line.quantity > duck.stock) {
      problems.push(`only ${duck.stock} of "${duck.name}" in stock`);
      continue;
    }
    items.push({
      duckId: duck.id,
      name: duck.name,
      quantity: line.quantity,
      price: duck.price,
    });
  }
  if (problems.length > 0) {
    return { ok: false, message: `Checkout failed: ${problems.join("; ")}.` };
  }

  // Mocked payment — always succeeds (card validated above, never stored).

  const quantities = new Map(cart.map((line) => [line.duckId, line.quantity]));
  const decremented = catalog.map((duck) => {
    const quantity = quantities.get(duck.id);
    return quantity === undefined
      ? duck
      : { ...duck, stock: duck.stock - quantity };
  });
  saveCatalog(decremented, options.catalogPath);

  const order: Order = {
    id: randomUUID(),
    items,
    total: cartTotal(cart, catalog),
    createdAt: new Date().toISOString(),
    customer: {
      name: details.name,
      email: details.email,
      address: details.address,
    },
  };
  appendOrder(order, options.ordersPath);

  return {
    ok: true,
    confirmation: { order, text: renderOrderConfirmation(order) },
    cart: EMPTY_CART,
  };
}
