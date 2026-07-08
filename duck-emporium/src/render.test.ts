import { describe, expect, it } from "vitest";
import { EMPTY_CART, type Cart } from "./cart.js";
import type { Order } from "./checkout.js";
import type { Duck } from "./duck.js";
import {
  formatPrice,
  renderCart,
  renderCatalog,
  renderDuckDetail,
  renderOrderConfirmation,
  stockLabel,
} from "./render.js";

const gifted: Duck = {
  id: "captain-quackbeard",
  name: "Captain Quackbeard",
  category: "pirate",
  price: 14.99,
  tagline: "Terror of the seven bathtubs.",
  stock: 2,
  description: "The fiercest rubber pirate on the high seas of Lake Foam.",
  traits: ["bold", "salty"],
  powers: ["squeaks that summon bubbles", "immune to soap"],
};

const powerless: Duck = {
  id: "plain-jane",
  name: "Plain Jane",
  category: "classic",
  price: 3.5,
  tagline: "No frills. All duck.",
  stock: 30,
  description: "Just honest vulcanized craftsmanship.",
  traits: ["honest"],
  powers: [],
};

describe("formatPrice", () => {
  it.each([
    [0, "0,00 €"],
    [0.05, "0,05 €"],
    [4.99, "4,99 €"],
    [14.9, "14,90 €"],
    [1234.56, "1234,56 €"],
  ])("formats %d as %s", (price, expected) => {
    expect(formatPrice(price)).toBe(expected);
  });

  it.each([-1, NaN, Infinity, -Infinity])("throws on %d", (price) => {
    expect(() => formatPrice(price)).toThrow();
  });
});

describe("stockLabel", () => {
  it.each([
    [0, "Sold out"],
    [1, "Last duck!"],
    [2, "Only 2 left"],
    [3, "Only 3 left"],
    [4, "In stock"],
    [100, "In stock"],
  ])("labels stock %d as %s", (stock, expected) => {
    expect(stockLabel(stock)).toBe(expected);
  });

  it.each([-1, 2.5, NaN])("throws on invalid stock %d", (stock) => {
    expect(() => stockLabel(stock)).toThrow();
  });
});

describe("renderCatalog", () => {
  it("renders one line per duck: id, name, category, price, tagline", () => {
    const lines = renderCatalog([gifted, powerless]).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^captain-quackbeard — /);
    expect(lines[0]).toContain("Captain Quackbeard");
    expect(lines[0]).toContain("(pirate)");
    expect(lines[0]).toContain("14,99 €");
    expect(lines[0]).toContain("Terror of the seven bathtubs.");
    expect(lines[1]).toMatch(/^plain-jane — /);
  });

  it("renders the empty-state message for an empty catalog", () => {
    const rendered = renderCatalog([]);
    expect(rendered).toBe("The pond is empty — no ducks in the catalog yet.");
  });

  it("renders a custom empty-state message for filtered results", () => {
    const rendered = renderCatalog([], "No duck matches your existential criteria.");
    expect(rendered).toBe("No duck matches your existential criteria.");
  });
});

describe("renderCart", () => {
  const catalog = Object.freeze([gifted, powerless]) as Duck[];
  const cart: Cart = Object.freeze([
    Object.freeze({ duckId: "captain-quackbeard", quantity: 2 }),
    Object.freeze({ duckId: "plain-jane", quantity: 3 }),
  ]);

  it("renders one line per item with name, quantity, unit price, subtotal", () => {
    const lines = renderCart(cart, catalog).split("\n");
    expect(lines).toHaveLength(3); // 2 items + total
    expect(lines[0]).toContain("Captain Quackbeard");
    expect(lines[0]).toContain("2");
    expect(lines[0]).toContain("14,99 €");
    expect(lines[0]).toContain("29,98 €");
    expect(lines[1]).toContain("Plain Jane");
    expect(lines[1]).toContain("3");
    expect(lines[1]).toContain("3,50 €");
    expect(lines[1]).toContain("10,50 €");
  });

  it("ends with the formatted running total", () => {
    expect(renderCart(cart, catalog)).toContain("40,48 €"); // 29.98 + 10.50
  });

  it("renders a friendly message for the empty cart, never an empty string", () => {
    const rendered = renderCart(EMPTY_CART, catalog);
    expect(rendered).toBe("Your cart is empty — the ducks await.");
    expect(rendered).not.toBe("");
  });

  it("throws for a line whose duck is missing from the catalog", () => {
    const stale: Cart = [{ duckId: "vanished-duck", quantity: 1 }];
    expect(() => renderCart(stale, catalog)).toThrow(TypeError);
    expect(() => renderCart(stale, catalog)).toThrow(/vanished-duck/);
  });
});

describe("renderOrderConfirmation", () => {
  const order: Order = {
    id: "e9a2b3c4-0000-4000-8000-000000000042",
    items: [
      { duckId: "captain-quackbeard", name: "Captain Quackbeard", quantity: 2, price: 14.99 },
      { duckId: "plain-jane", name: "Plain Jane", quantity: 3, price: 0.1 },
    ],
    total: 30.28,
    createdAt: "2026-07-08T10:00:00.000Z",
    customer: {
      name: "Quincy Quacker",
      email: "quincy@pond.example",
      address: "1 Lily Pad Lane",
    },
  };

  it("contains the order ID", () => {
    expect(renderOrderConfirmation(order)).toContain(order.id);
  });

  it("renders one line per item with name, quantity, unit price, subtotal", () => {
    const text = renderOrderConfirmation(order);
    const itemLines = text
      .split("\n")
      .filter((line) => line.includes("Captain") || line.includes("Jane"));
    expect(itemLines).toHaveLength(2);
    expect(itemLines[0]).toContain("Captain Quackbeard");
    expect(itemLines[0]).toContain("2");
    expect(itemLines[0]).toContain("14,99 €");
    expect(itemLines[0]).toContain("29,98 €");
    expect(itemLines[1]).toContain("Plain Jane");
    expect(itemLines[1]).toContain("3");
    expect(itemLines[1]).toContain("0,10 €");
    expect(itemLines[1]).toContain("0,30 €"); // cent-safe: not 0.30000000000000004
  });

  it("contains the formatted total", () => {
    expect(renderOrderConfirmation(order)).toContain("30,28 €");
  });
});

describe("renderDuckDetail", () => {
  it("contains every field, each trait and power, and the stock label", () => {
    const detail = renderDuckDetail(gifted);
    expect(detail).toContain("Captain Quackbeard");
    expect(detail).toContain("(pirate)");
    expect(detail).toContain("14,99 €");
    expect(detail).toContain("Terror of the seven bathtubs.");
    expect(detail).toContain(gifted.description);
    for (const trait of gifted.traits) {
      expect(detail).toContain(trait);
    }
    for (const power of gifted.powers) {
      expect(detail).toContain(power);
    }
    expect(detail).toContain("Only 2 left");
  });

  it("renders 'Powers: none' for a duck without powers", () => {
    expect(renderDuckDetail(powerless)).toContain("Powers: none");
  });

  it("renders a friendly not-found message for undefined, never empty", () => {
    const rendered = renderDuckDetail(undefined);
    expect(rendered).toBe("This duck has waddled off — no duck with that id.");
    expect(rendered).not.toBe("");
  });
});
