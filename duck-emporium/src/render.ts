import type { Order } from "./checkout.js";
import type { Duck } from "./duck.js";

/** "4,99 €" — toFixed(2) with the dot swapped for a comma, no locale
 *  machinery. Throws on negative or non-finite input. */
export function formatPrice(price: number): string {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new TypeError("price must be a finite number");
  }
  if (price < 0) {
    throw new TypeError("price must not be negative");
  }
  return `${price.toFixed(2).replace(".", ",")} €`;
}

/** 0 → "Sold out" | 1 → "Last duck!" | 2..3 → "Only N left"
 *  | ≥4 → "In stock". Throws on negative or non-integer input. */
export function stockLabel(stock: number): string {
  if (!Number.isInteger(stock) || stock < 0) {
    throw new TypeError("stock must be a non-negative integer");
  }
  if (stock === 0) {
    return "Sold out";
  }
  if (stock === 1) {
    return "Last duck!";
  }
  if (stock <= 3) {
    return `Only ${stock} left`;
  }
  return "In stock";
}

/** One line per duck, starting with the id (the key for detail lookups):
 *  "captain-quackbeard — Captain Quackbeard (pirate) — 14,99 € — tagline".
 *  For an empty list returns the explicit empty-state message. */
export function renderCatalog(ducks: Duck[]): string {
  if (ducks.length === 0) {
    return "The pond is empty — no ducks in the catalog yet.";
  }
  return ducks
    .map(
      (duck) =>
        `${duck.id} — ${duck.name} (${duck.category}) — ` +
        `${formatPrice(duck.price)} — ${duck.tagline}`,
    )
    .join("\n");
}

/** Plain-text order confirmation: order ID line, one line per item
 *  ("name × quantity @ unit price = line subtotal", cent-safe), then the
 *  formatted total. */
export function renderOrderConfirmation(order: Order): string {
  const lines = order.items.map((item) => {
    const subtotal = (Math.round(item.price * 100) * item.quantity) / 100;
    return (
      `${item.name} × ${item.quantity} @ ${formatPrice(item.price)}` +
      ` = ${formatPrice(subtotal)}`
    );
  });
  return [
    `Order confirmed — ${order.id}`,
    ...lines,
    `Total: ${formatPrice(order.total)}`,
  ].join("\n");
}

/** Multi-line detail view: name, category, formatted price, tagline,
 *  description, traits, powers ("Powers: none" when empty), stock label.
 *  undefined → friendly not-found message, never an empty string. */
export function renderDuckDetail(duck: Duck | undefined): string {
  if (duck === undefined) {
    return "This duck has waddled off — no duck with that id.";
  }
  const powers = duck.powers.length === 0 ? "none" : duck.powers.join(", ");
  return [
    `${duck.name} (${duck.category}) — ${formatPrice(duck.price)}`,
    duck.tagline,
    "",
    duck.description,
    "",
    `Traits: ${duck.traits.join(", ")}`,
    `Powers: ${powers}`,
    stockLabel(duck.stock),
  ].join("\n");
}
