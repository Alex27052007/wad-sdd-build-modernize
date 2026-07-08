import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Order } from "./checkout.js";
import {
  DEFAULT_ORDERS_PATH,
  OrdersLoadError,
  appendOrder,
  loadOrders,
} from "./orders.js";

function ordersFile(): string {
  return join(mkdtempSync(join(tmpdir(), "orders-")), "orders.json");
}

function fixtureOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "e9a2b3c4-0000-4000-8000-000000000001",
    items: [
      { duckId: "captain-quackbeard", name: "Captain Quackbeard", quantity: 2, price: 14.99 },
    ],
    total: 29.98,
    createdAt: "2026-07-08T10:00:00.000Z",
    customer: {
      name: "Quincy Quacker",
      email: "quincy@pond.example",
      address: "1 Lily Pad Lane",
    },
    ...overrides,
  };
}

describe("DEFAULT_ORDERS_PATH", () => {
  it("is an absolute path ending in data/orders.json", () => {
    expect(isAbsolute(DEFAULT_ORDERS_PATH)).toBe(true);
    expect(DEFAULT_ORDERS_PATH).toMatch(/data[/\\]orders\.json$/);
  });
});

describe("loadOrders", () => {
  it("returns [] for a missing file", () => {
    expect(loadOrders(ordersFile())).toEqual([]);
  });

  it("throws OrdersLoadError naming file and problem for corrupt JSON", () => {
    const file = ordersFile();
    writeFileSync(file, "{ not json");
    expect(() => loadOrders(file)).toThrow(OrdersLoadError);
    expect(() => loadOrders(file)).toThrow(file);
    expect(() => loadOrders(file)).toThrow(/invalid JSON/);
  });

  it("throws OrdersLoadError for a non-array top level", () => {
    const file = ordersFile();
    writeFileSync(file, JSON.stringify({ orders: [] }));
    expect(() => loadOrders(file)).toThrow(OrdersLoadError);
    expect(() => loadOrders(file)).toThrow(/must be an array/);
  });
});

describe("appendOrder", () => {
  it("creates the file on the first order", () => {
    const file = ordersFile();
    const order = fixtureOrder();
    appendOrder(order, file);
    expect(loadOrders(file)).toEqual([order]);
  });

  it("preserves append order across multiple orders", () => {
    const file = ordersFile();
    const first = fixtureOrder({ id: "e9a2b3c4-0000-4000-8000-000000000001" });
    const second = fixtureOrder({ id: "e9a2b3c4-0000-4000-8000-000000000002" });
    const third = fixtureOrder({ id: "e9a2b3c4-0000-4000-8000-000000000003" });
    appendOrder(first, file);
    appendOrder(second, file);
    appendOrder(third, file);
    expect(loadOrders(file).map((o) => o.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
  });

  it("round-trips every Order field through append-then-load", () => {
    const file = ordersFile();
    const order = fixtureOrder({
      items: [
        { duckId: "a", name: "Duck A", quantity: 1, price: 0.1 },
        { duckId: "b", name: "Duck B", quantity: 3, price: 3.5 },
      ],
      total: 10.6,
    });
    appendOrder(order, file);
    expect(loadOrders(file)).toEqual([order]);
  });
});
