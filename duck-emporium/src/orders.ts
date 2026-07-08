import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Order } from "./checkout.js";
import { writeJsonAtomic } from "./persist.js";

/** Absolute path to the default orders file, resolved relative to this
 *  module, not the process CWD. Created on the first order. */
export const DEFAULT_ORDERS_PATH = fileURLToPath(
  new URL("../data/orders.json", import.meta.url),
);

export class OrdersLoadError extends Error {
  constructor(filePath: string, problem: string, options?: ErrorOptions) {
    super(`Failed to load orders from ${filePath}: ${problem}`, options);
    this.name = "OrdersLoadError";
  }
}

/** Reads the orders file. A missing file means no orders yet and returns
 *  []; an unreadable, corrupt, or non-array file throws OrdersLoadError
 *  naming the file and the problem. */
export function loadOrders(filePath: string = DEFAULT_ORDERS_PATH): Order[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw new OrdersLoadError(filePath, "cannot read file", { cause });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new OrdersLoadError(filePath, "invalid JSON", { cause });
  }

  if (!Array.isArray(parsed)) {
    throw new OrdersLoadError(filePath, "top-level value must be an array");
  }

  return parsed as Order[];
}

/** Appends one order: load → append → atomic write. Creates the file on
 *  the first order. */
export function appendOrder(
  order: Order,
  filePath: string = DEFAULT_ORDERS_PATH,
): void {
  writeJsonAtomic(filePath, [...loadOrders(filePath), order]);
}
