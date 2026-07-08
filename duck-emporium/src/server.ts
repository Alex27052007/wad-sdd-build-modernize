import { readFileSync } from "node:fs";
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { addToCart, cartTotal, removeFromCart, setQuantity, type Cart } from "./cart.js";
import { checkout } from "./checkout.js";
import { filterDucks, getDuckById, listDucks, selectDuckOfTheDay } from "./catalog.js";

const DEFAULT_STATIC_DIR = fileURLToPath(new URL("..", import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

export type ApiHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => boolean | Promise<boolean>;

export interface ServerOptions {
  port?: number;
  host?: string;
  staticDir?: string;
  apiHandler?: ApiHandler;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return null;
  }
  return JSON.parse(raw) as unknown;
}

function statusForCartMessage(message: string): number {
  if (message.startsWith("No duck")) {
    return 404;
  }
  if (message.includes("in stock")) {
    return 409;
  }
  return 400;
}

function materializeCart(cart: Cart) {
  const catalog = listDucks();
  const items = cart.map((line) => {
    const duck = getDuckById(line.duckId, catalog);
    const price = duck?.price ?? 0;
    return {
      duckId: line.duckId,
      quantity: line.quantity,
      name: duck?.name ?? line.duckId,
      price,
      lineTotal: Math.round(price * 100 * line.quantity) / 100,
    };
  });

  return {
    items,
    total: cartTotal(cart, catalog),
  };
}

function statusForCheckoutMessage(message: string): number {
  if (message.includes("in stock") || message.includes("Checkout failed")) {
    return 409;
  }
  return 400;
}

function resolveStaticPath(staticDir: string, pathname: string): string | undefined {
  const cleaned = pathname.replace(/^\/+/, "");
  const normalized = normalize(cleaned);
  const absolute = resolve(staticDir, normalized);

  const staticRoot = staticDir.endsWith(sep) ? staticDir : `${staticDir}${sep}`;
  if (!absolute.startsWith(staticRoot) && absolute !== staticDir) {
    return undefined;
  }

  return absolute;
}

function serveStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string,
  pathname: string,
): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("allow", "GET, HEAD");
    res.end();
    return true;
  }

  const absolutePath = resolveStaticPath(staticDir, pathname);
  if (absolutePath === undefined) {
    sendJson(res, 404, { message: "Not found" });
    return true;
  }

  let data: string;
  try {
    data = readFileSync(absolutePath, "utf8");
  } catch {
    sendJson(res, 404, { message: "Not found" });
    return true;
  }

  const extension = extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("content-type", contentType);

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  res.end(data);
  return true;
}

export function createServer(options: ServerOptions = {}): Server {
  const staticDir = options.staticDir ?? DEFAULT_STATIC_DIR;
  let cartState: Cart = [];

  const defaultApiHandler: ApiHandler = async (req, res, url) => {
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (path === "/api/ducks" && method === "GET") {
      const query = url.searchParams.get("query") ?? undefined;
      const category = url.searchParams.get("category") ?? undefined;
      const minPriceRaw = url.searchParams.get("minPrice");
      const maxPriceRaw = url.searchParams.get("maxPrice");
      const minPrice = minPriceRaw === null || minPriceRaw === "" ? undefined : Number(minPriceRaw);
      const maxPrice = maxPriceRaw === null || maxPriceRaw === "" ? undefined : Number(maxPriceRaw);
      const ducks = filterDucks(listDucks(), {
        query,
        categories: category ? [category] : undefined,
        minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
      });
      sendJson(res, 200, { ducks });
      return true;
    }

    if (path.startsWith("/api/ducks/") && method === "GET") {
      const duckId = decodeURIComponent(path.replace("/api/ducks/", ""));
      const duck = getDuckById(duckId, listDucks());
      if (duck === undefined) {
        sendJson(res, 404, { message: `Duck ${duckId} not found` });
        return true;
      }
      sendJson(res, 200, { duck });
      return true;
    }

    if (path === "/api/duck-of-the-day" && method === "GET") {
      const dayKey = new Date().toISOString().slice(0, 10);
      const selected = selectDuckOfTheDay(listDucks(), dayKey);
      if (!selected.ok) {
        sendJson(res, 404, { message: selected.message });
        return true;
      }
      sendJson(res, 200, { duck: selected.duck });
      return true;
    }

    if (path === "/api/cart" && method === "GET") {
      sendJson(res, 200, materializeCart(cartState));
      return true;
    }

    if (path.startsWith("/api/cart/items/") && method === "PUT") {
      const duckId = decodeURIComponent(path.replace("/api/cart/items/", ""));
      const payload = await readJsonBody(req);
      const quantity =
        payload !== null && typeof payload === "object" && "quantity" in payload
          ? Number((payload as { quantity: unknown }).quantity)
          : NaN;

      if (!Number.isInteger(quantity) || quantity < 0) {
        sendJson(res, 400, { message: "quantity must be a non-negative integer" });
        return true;
      }

      if (quantity === 0) {
        cartState = removeFromCart(cartState, duckId);
        sendJson(res, 200, materializeCart(cartState));
        return true;
      }

      const exists = cartState.some((line) => line.duckId === duckId);
      const result = exists
        ? setQuantity(cartState, duckId, quantity, listDucks())
        : addToCart(cartState, duckId, quantity, listDucks());

      if (!result.ok) {
        sendJson(res, statusForCartMessage(result.message), { message: result.message });
        return true;
      }

      cartState = result.cart;
      sendJson(res, 200, materializeCart(cartState));
      return true;
    }

    if (path.startsWith("/api/cart/items/") && method === "DELETE") {
      const duckId = decodeURIComponent(path.replace("/api/cart/items/", ""));
      cartState = removeFromCart(cartState, duckId);
      sendJson(res, 200, materializeCart(cartState));
      return true;
    }

    if (path === "/api/checkout" && method === "POST") {
      const payload = await readJsonBody(req);
      const details = payload !== null && typeof payload === "object"
        ? {
            name: String((payload as Record<string, unknown>).name ?? ""),
            email: String((payload as Record<string, unknown>).email ?? ""),
            address: String((payload as Record<string, unknown>).address ?? ""),
            card: String((payload as Record<string, unknown>).card ?? ""),
          }
        : { name: "", email: "", address: "", card: "" };

      const result = checkout(cartState, details);
      if (!result.ok) {
        sendJson(res, statusForCheckoutMessage(result.message), { message: result.message });
        return true;
      }

      cartState = result.cart;
      sendJson(res, 200, {
        confirmation: result.confirmation,
        cart: materializeCart(cartState),
      });
      return true;
    }

    if (path === "/api/quiz" && method === "POST") {
      const payload = await readJsonBody(req);
      const answers =
        payload !== null && typeof payload === "object" && "answers" in payload
          ? (payload as { answers: Record<string, string> }).answers
          : {};

      const mood = String(answers.mood ?? "").toLowerCase();
      const pace = String(answers.pace ?? "").toLowerCase();
      const ducks = listDucks();
      const preferred = ducks.find((duck) => {
        const traits = duck.traits.map((trait) => trait.toLowerCase());
        if (mood === "bold") {
          return traits.includes("brave") || duck.category.toLowerCase() === "pirate";
        }
        if (mood === "calm") {
          return traits.includes("calm") || traits.includes("gentle");
        }
        return false;
      }) ?? ducks[0];

      if (preferred === undefined) {
        sendJson(res, 404, { message: "No ducks available for quiz recommendation" });
        return true;
      }

      const speedWord = pace === "fast" ? "high-energy" : "easygoing";
      sendJson(res, 200, {
        result: {
          duckId: preferred.id,
          duckName: preferred.name,
          message: `Based on your ${mood || "playful"} mood and ${speedWord} pace, this duck is a great match.`,
        },
      });
      return true;
    }

    return false;
  };

  return createHttpServer((req, res) => {
    if (req.url === undefined) {
      sendJson(res, 400, { message: "Missing request URL" });
      return;
    }

    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/" || pathname === "/app") {
      serveStaticFile(req, res, staticDir, "index.html");
      return;
    }

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const apiHandler = options.apiHandler ?? defaultApiHandler;
      void Promise.resolve(apiHandler(req, res, url))
        .then((handled) => {
          if (!handled && !res.writableEnded) {
            sendJson(res, 404, { message: "Not found" });
          }
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Unexpected API error";
          if (!res.writableEnded) {
            sendJson(res, 500, { message });
          }
        });
      return;
    }

    const relativePath = pathname.replace(/^\/+/, "");
    serveStaticFile(req, res, staticDir, relativePath);
  });
}

export function startServer(
  options: ServerOptions = {},
): Promise<{ server: Server; port: number }> {
  const server = createServer(options);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3000;

  return new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, host, () => {
      server.off("error", rejectPromise);
      const address = server.address();
      if (address === null || typeof address === "string") {
        rejectPromise(new Error("Server did not expose a numeric port"));
        return;
      }
      resolvePromise({ server, port: address.port });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer();
  console.log(`Duck Emporium dev server listening on http://127.0.0.1:${port}`);
}
