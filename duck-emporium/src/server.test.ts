import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, startServer, type ApiHandler } from "./server.js";

async function stopServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createStaticFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "frontend-static-"));
  writeFileSync(join(dir, "index.html"), "<html><body><h1>Duck Emporium</h1></body></html>\n");
  writeFileSync(join(dir, "app.css"), "body { color: #111; }\n");
  writeFileSync(join(dir, "app.js"), "console.log('ducks');\n");
  return dir;
}

const activeServers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const server = activeServers.pop();
    if (server !== undefined) {
      await stopServer(server);
    }
  }
});

describe("web frontend server", () => {
  it("serves SPA HTML for both / and /app", async () => {
    const staticDir = createStaticFixture();
    const { server, port } = await startServer({ port: 0, staticDir });
    activeServers.push(server);

    const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
    expect(rootResponse.status).toBe(200);
    expect(rootResponse.headers.get("content-type")).toContain("text/html");
    await expect(rootResponse.text()).resolves.toContain("Duck Emporium");

    const appResponse = await fetch(`http://127.0.0.1:${port}/app`);
    expect(appResponse.status).toBe(200);
    expect(appResponse.headers.get("content-type")).toContain("text/html");
    await expect(appResponse.text()).resolves.toContain("Duck Emporium");
  });

  it("serves static assets with expected content type and returns 404 for unknown files", async () => {
    const staticDir = createStaticFixture();
    const { server, port } = await startServer({ port: 0, staticDir });
    activeServers.push(server);

    const cssResponse = await fetch(`http://127.0.0.1:${port}/app.css`);
    expect(cssResponse.status).toBe(200);
    expect(cssResponse.headers.get("content-type")).toContain("text/css");

    const jsResponse = await fetch(`http://127.0.0.1:${port}/app.js`);
    expect(jsResponse.status).toBe(200);
    expect(jsResponse.headers.get("content-type")).toContain("text/javascript");

    const missingResponse = await fetch(`http://127.0.0.1:${port}/missing-file.txt`);
    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({ message: "Not found" });
  });

  it("serves repository public assets by default", async () => {
    const { server, port } = await startServer({ port: 0 });
    activeServers.push(server);

    const htmlResponse = await fetch(`http://127.0.0.1:${port}/`);
    expect(htmlResponse.status).toBe(200);
    await expect(htmlResponse.text()).resolves.toContain("id=\"catalog\"");

    const cssResponse = await fetch(`http://127.0.0.1:${port}/frontend/app.css`);
    expect(cssResponse.status).toBe(200);
    expect(cssResponse.headers.get("content-type")).toContain("text/css");
    await expect(cssResponse.text()).resolves.toContain(":root");
  });

  it("preserves API status semantics for 400, 404 and 409 responses", async () => {
    const staticDir = createStaticFixture();
    const apiHandler: ApiHandler = (_req, res, url) => {
      if (url.pathname === "/api/cart") {
        res.statusCode = 400;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end('{"message":"bad cart"}\n');
        return true;
      }
      if (url.pathname === "/api/ducks/unknown") {
        res.statusCode = 404;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end('{"message":"missing duck"}\n');
        return true;
      }
      if (url.pathname === "/api/checkout") {
        res.statusCode = 409;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end('{"message":"stock conflict"}\n');
        return true;
      }
      return false;
    };

    const { server, port } = await startServer({ port: 0, staticDir, apiHandler });
    activeServers.push(server);

    const cartResponse = await fetch(`http://127.0.0.1:${port}/api/cart`);
    expect(cartResponse.status).toBe(400);
    await expect(cartResponse.json()).resolves.toEqual({ message: "bad cart" });

    const duckResponse = await fetch(`http://127.0.0.1:${port}/api/ducks/unknown`);
    expect(duckResponse.status).toBe(404);
    await expect(duckResponse.json()).resolves.toEqual({ message: "missing duck" });

    const checkoutResponse = await fetch(`http://127.0.0.1:${port}/api/checkout`);
    expect(checkoutResponse.status).toBe(409);
    await expect(checkoutResponse.json()).resolves.toEqual({ message: "stock conflict" });

    const unknownApiResponse = await fetch(`http://127.0.0.1:${port}/api/not-implemented`);
    expect(unknownApiResponse.status).toBe(404);
    await expect(unknownApiResponse.json()).resolves.toEqual({ message: "Not found" });
  });

  it("exposes default API routes for ducks/cart with expected error semantics", async () => {
    const { server, port } = await startServer({ port: 0 });
    activeServers.push(server);

    const ducksResponse = await fetch(`http://127.0.0.1:${port}/api/ducks`);
    expect(ducksResponse.status).toBe(200);
    const ducksPayload = await ducksResponse.json() as { ducks: Array<{ id: string }> };
    expect(Array.isArray(ducksPayload.ducks)).toBe(true);
    expect(ducksPayload.ducks.length).toBeGreaterThan(0);

    const notFoundResponse = await fetch(`http://127.0.0.1:${port}/api/ducks/does-not-exist`);
    expect(notFoundResponse.status).toBe(404);

    const badQuantityResponse = await fetch(`http://127.0.0.1:${port}/api/cart/items/sir-quacksalot`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: -1 }),
    });
    expect(badQuantityResponse.status).toBe(400);

    const stockConflictResponse = await fetch(`http://127.0.0.1:${port}/api/cart/items/sir-quacksalot`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: 999 }),
    });
    expect(stockConflictResponse.status).toBe(409);
  });
});
