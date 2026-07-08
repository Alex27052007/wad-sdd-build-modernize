import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_CART, type Cart } from "./cart.js";
import { loadCatalog } from "./catalog.js";
import { checkout, type CheckoutDetails } from "./checkout.js";
import type { Duck } from "./duck.js";
import { loadOrders } from "./orders.js";

function fixtureDuck(overrides: Partial<Duck> = {}): Duck {
  return {
    id: "test-duck",
    name: "Test Duck",
    category: "classic",
    price: 4.99,
    tagline: "A duck for testing.",
    stock: 5,
    description: "A perfectly ordinary duck that exists only in tests.",
    traits: ["reliable"],
    powers: [],
    ...overrides,
  };
}

const seedDucks: Duck[] = [
  fixtureDuck({ id: "sir-quacksalot", name: "Sir Quacksalot", stock: 5, price: 4.99 }),
  fixtureDuck({ id: "dime-duck", name: "Dime Duck", stock: 10, price: 0.1 }),
  fixtureDuck({ id: "last-duck", name: "Last Duck", stock: 1, price: 9.99 }),
];

/** Temp-dir sandbox: catalog fixture copy + orders path, never data/. */
function sandbox(ducks: Duck[] = seedDucks) {
  const dir = mkdtempSync(join(tmpdir(), "checkout-"));
  const catalogPath = join(dir, "ducks.json");
  const ordersPath = join(dir, "orders.json");
  writeFileSync(catalogPath, `${JSON.stringify(ducks, null, 2)}\n`);
  return { catalogPath, ordersPath, options: { catalogPath, ordersPath } };
}

const CARD = "4242 4242 4242 4242";

function validDetails(overrides: Partial<CheckoutDetails> = {}): CheckoutDetails {
  return {
    name: "Quincy Quacker",
    email: "quincy@pond.example",
    address: "1 Lily Pad Lane",
    card: CARD,
    ...overrides,
  };
}

function frozenCart(...lines: { duckId: string; quantity: number }[]): Cart {
  return Object.freeze(lines.map((line) => Object.freeze({ ...line })));
}

const cartOfTwo = frozenCart(
  { duckId: "sir-quacksalot", quantity: 2 },
  { duckId: "dime-duck", quantity: 3 },
);

describe("checkout validation failures", () => {
  it.each([
    ["name", validDetails({ name: "   " })],
    ["address", validDetails({ address: "" })],
    ["card", validDetails({ card: " \t" })],
    ["email", validDetails({ email: "no-at-sign.example" })],
    ["email", validDetails({ email: "user@nodomaindot" })],
    ["email", validDetails({ email: "@domain.tld" })],
    ["email", validDetails({ email: "user@" })],
  ])("fails naming %s and writes nothing", (field, details) => {
    const { catalogPath, ordersPath, options } = sandbox();
    const before = readFileSync(catalogPath, "utf8");
    const result = checkout(cartOfTwo, details, options);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(field);
    }
    expect(readFileSync(catalogPath, "utf8")).toBe(before);
    expect(existsSync(ordersPath)).toBe(false);
  });

  it("fails on an empty cart with a clear message, writing nothing", () => {
    const { catalogPath, ordersPath, options } = sandbox();
    const before = readFileSync(catalogPath, "utf8");
    const result = checkout(EMPTY_CART, validDetails(), options);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("empty");
    }
    expect(readFileSync(catalogPath, "utf8")).toBe(before);
    expect(existsSync(ordersPath)).toBe(false);
  });
});

describe("checkout stock revalidation", () => {
  it("fails naming the over-stock duck; no duck's stock changes", () => {
    const { catalogPath, ordersPath, options } = sandbox();
    const before = readFileSync(catalogPath, "utf8");
    const cart = frozenCart(
      { duckId: "sir-quacksalot", quantity: 2 }, // valid line
      { duckId: "last-duck", quantity: 3 }, // over stock (1)
    );
    const result = checkout(cart, validDetails(), options);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Last Duck");
      expect(result.message).toContain("1");
    }
    expect(readFileSync(catalogPath, "utf8")).toBe(before); // byte-identical
    expect(existsSync(ordersPath)).toBe(false);
  });

  it("fails when a carted duck no longer exists in the catalog", () => {
    const { catalogPath, options } = sandbox(
      seedDucks.filter((duck) => duck.id !== "dime-duck"),
    );
    const before = readFileSync(catalogPath, "utf8");
    const result = checkout(cartOfTwo, validDetails(), options);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("dime-duck");
    }
    expect(readFileSync(catalogPath, "utf8")).toBe(before);
  });
});

describe("checkout success", () => {
  it("returns a confirmation with UUID id, ISO timestamp, items, cent-safe total, and the empty cart", () => {
    const { options } = sandbox();
    const result = checkout(cartOfTwo, validDetails(), options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { order, text } = result.confirmation;
    expect(order.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    expect(order.items).toEqual([
      { duckId: "sir-quacksalot", name: "Sir Quacksalot", quantity: 2, price: 4.99 },
      { duckId: "dime-duck", name: "Dime Duck", quantity: 3, price: 0.1 },
    ]);
    expect(order.total).toBe(10.28); // 2×4.99 + 3×0.10, exactly — no float drift
    expect(order.customer).toEqual({
      name: "Quincy Quacker",
      email: "quincy@pond.example",
      address: "1 Lily Pad Lane",
    });
    expect(text).toContain(order.id);
    expect(result.cart).toBe(EMPTY_CART);
  });

  it("persists the decremented stock: a fresh loadCatalog sees it", () => {
    const { catalogPath, options } = sandbox();
    expect(checkout(cartOfTwo, validDetails(), options).ok).toBe(true);
    const reloaded = loadCatalog(catalogPath);
    expect(reloaded.find((d) => d.id === "sir-quacksalot")?.stock).toBe(3);
    expect(reloaded.find((d) => d.id === "dime-duck")?.stock).toBe(7);
    expect(reloaded.find((d) => d.id === "last-duck")?.stock).toBe(1); // untouched
  });

  it("appends the order: a fresh loadOrders returns it with all fields", () => {
    const { ordersPath, options } = sandbox();
    const result = checkout(cartOfTwo, validDetails(), options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(loadOrders(ordersPath)).toEqual([result.confirmation.order]);
  });

  it("never writes the card to either file", () => {
    const { catalogPath, ordersPath, options } = sandbox();
    expect(checkout(cartOfTwo, validDetails(), options).ok).toBe(true);
    expect(readFileSync(catalogPath, "utf8")).not.toContain(CARD);
    expect(readFileSync(ordersPath, "utf8")).not.toContain(CARD);
  });

  it("last-in-stock duck: first checkout wins, second fails the stock check", () => {
    const { ordersPath, options } = sandbox();
    const cart = frozenCart({ duckId: "last-duck", quantity: 1 });
    expect(checkout(cart, validDetails(), options).ok).toBe(true);
    const second = checkout(cart, validDetails(), options);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.message).toContain("Last Duck");
      expect(second.message).toContain("0");
    }
    expect(loadOrders(ordersPath)).toHaveLength(1);
  });
});
