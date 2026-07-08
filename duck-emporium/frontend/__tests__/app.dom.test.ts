import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCatalog,
  fetchCart,
  fetchDuckDetail,
  fetchDuckOfTheDay,
  removeCartItem,
  submitCheckout,
  submitQuizAnswers,
  updateCartItem,
} from "../api.js";
import { applyCatalogFilters, createApp } from "../app.js";
import {
  renderCatalog,
  renderDuckDetail,
  renderDuckOfTheDay,
} from "../render.js";
import { createInitialState, getState, setState } from "../state.js";
import { createServer, startServer } from "../../src/server.js";

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

const activeServers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const server = activeServers.pop();
    if (server !== undefined) {
      await stopServer(server);
    }
  }
});

describe("frontend shell smoke", () => {
  it("renders all root feature regions in the SPA shell", async () => {
    const { server, port } = await startServer({ port: 0 });
    activeServers.push(server);

    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain("id=\"catalog\"");
    expect(html).toContain("id=\"duck-detail\"");
    expect(html).toContain("id=\"duck-of-the-day\"");
    expect(html).toContain("id=\"cart\"");
    expect(html).toContain("id=\"checkout\"");
    expect(html).toContain("id=\"quiz\"");
    expect(html).toContain("role=\"main\"");
  });
});

describe("frontend API client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls existing API endpoints with expected method and payload", async () => {
    await fetchCatalog({ query: "pirate", category: "classic", minPrice: 5, maxPrice: 20 });
    await fetchDuckDetail("sir-quacksalot");
    await fetchDuckOfTheDay();
    await fetchCart();
    await updateCartItem("sir-quacksalot", 3);
    await removeCartItem("sir-quacksalot");
    await submitCheckout({ name: "Quincy" });
    await submitQuizAnswers({ answers: { mood: "bold" } });

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;

    expect(calls[0]?.[0]).toContain("/api/ducks?");
    expect(calls[0]?.[0]).toContain("query=pirate");
    expect(calls[1]?.[0]).toBe("/api/ducks/sir-quacksalot");
    expect(calls[2]?.[0]).toBe("/api/duck-of-the-day");
    expect(calls[3]?.[0]).toBe("/api/cart");

    expect(calls[4]?.[0]).toBe("/api/cart/items/sir-quacksalot");
    expect(calls[4]?.[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(calls[4]?.[1]?.body as string)).toEqual({ quantity: 3 });

    expect(calls[5]?.[0]).toBe("/api/cart/items/sir-quacksalot");
    expect(calls[5]?.[1]).toMatchObject({ method: "DELETE" });

    expect(calls[6]?.[0]).toBe("/api/checkout");
    expect(calls[6]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(calls[6]?.[1]?.body as string)).toEqual({ name: "Quincy" });

    expect(calls[7]?.[0]).toBe("/api/quiz");
    expect(calls[7]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(calls[7]?.[1]?.body as string)).toEqual({ answers: { mood: "bold" } });
  });

  it("normalizes API errors into status and message", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('{"message":"stock conflict"}', {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(submitCheckout({ name: "Quincy" })).rejects.toEqual({
      status: 409,
      message: "stock conflict",
    });
  });
});

describe("frontend in-memory state", () => {
  beforeEach(() => {
    setState(createInitialState());
  });

  it("creates deterministic defaults", () => {
    const initial = createInitialState();
    expect(initial.filters).toEqual({
      query: "",
      category: "",
      minPrice: "",
      maxPrice: "",
    });
    expect(initial.quiz).toEqual({ answers: {}, result: null });
  });

  it("returns defensive snapshots that callers cannot mutate", () => {
    const snapshot = getState();
    snapshot.filters.query = "hacked";
    snapshot.quiz.answers.mood = "stormy";

    const afterMutation = getState();
    expect(afterMutation.filters.query).toBe("");
    expect(afterMutation.quiz.answers).toEqual({});
  });

  it("applies updates without leaking later caller mutations", () => {
    const patch = {
      filters: {
        query: "pond",
        category: "classic",
        minPrice: "",
        maxPrice: "",
      },
    };

    setState(patch);
    patch.filters.query = "tampered";

    expect(getState().filters.query).toBe("pond");
    expect(getState().filters.category).toBe("classic");
  });
});

describe("catalog and detail rendering flow", () => {
  const ducks = [
    {
      id: "philosopher",
      name: "Philosopher Duck",
      category: "classic",
      price: 12.5,
      tagline: "Contemplates bubbles",
      description: "A reflective duck with deep thoughts.",
      traits: ["Calm", "Curious"],
      stock: 3,
    },
    {
      id: "pirate",
      name: "Pirate Duck",
      category: "pirate",
      price: 19.99,
      tagline: "Rules the bathtub seas",
      description: "A bold duck with an eye patch.",
      traits: ["Brave"],
      stock: 7,
    },
  ];

  function createRootStub() {
    const nodes = {
      "#catalog": { innerHTML: "" },
      "#duck-detail": { innerHTML: "" },
      "#duck-of-the-day": { innerHTML: "" },
      "#cart": { innerHTML: "" },
      "#checkout": { innerHTML: "" },
      "#quiz": { innerHTML: "" },
    } as const;

    return {
      querySelector(selector: "#catalog" | "#duck-detail" | "#duck-of-the-day" | "#cart" | "#checkout" | "#quiz") {
        return nodes[selector] ?? null;
      },
      nodes,
    };
  }

  beforeEach(() => {
    setState(createInitialState());
  });

  it("renders catalog cards with name, category, price, and tagline", () => {
    const html = renderCatalog(ducks);

    expect(html).toContain("Philosopher Duck");
    expect(html).toContain("classic");
    expect(html).toContain("Contemplates bubbles");
    expect(html).toContain("12,50");
  });

  it("updates visible ducks when filter interactions change", () => {
    const filtered = applyCatalogFilters(ducks, {
      query: "pirate",
      category: "",
      minPrice: "",
      maxPrice: "",
    });
    expect(filtered.map((duck) => duck.id)).toEqual(["pirate"]);

    const categoryFiltered = applyCatalogFilters(ducks, {
      query: "",
      category: "classic",
      minPrice: "10",
      maxPrice: "15",
    });
    expect(categoryFiltered.map((duck) => duck.id)).toEqual(["philosopher"]);
  });

  it("selecting a duck renders full detail with traits, stock, and add-to-cart action", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
      },
    });

    await app.init();
    await app.selectDuck("philosopher");

    const detailHtml = root.nodes["#duck-detail"].innerHTML;
    expect(detailHtml).toContain("A reflective duck with deep thoughts.");
    expect(detailHtml).toContain("Personality traits");
    expect(detailHtml).toContain("In stock (3)");
    expect(detailHtml).toContain("Add to Cart");
  });

  it("renders duck of the day content when available", () => {
    const html = renderDuckOfTheDay(ducks[1]);
    expect(html).toContain("Pirate Duck");
    expect(html).toContain("Rules the bathtub seas");
    expect(html).toContain("pirate");

    const detailHtml = renderDuckDetail(ducks[1]);
    expect(detailHtml).toContain("A bold duck with an eye patch.");
  });

  it("add-to-cart updates cart view with quantity, line total, running total, and checkout action", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [],
        updateCartItem: async () => [
          {
            duckId: "philosopher",
            quantity: 1,
            name: "Philosopher Duck",
            price: 12.5,
          },
        ],
        removeCartItem: async () => [],
      },
    });

    await app.init();
    await app.addToCart("philosopher");

    const cartHtml = root.nodes["#cart"].innerHTML;
    expect(cartHtml).toContain("Philosopher Duck");
    expect(cartHtml).toContain("Qty: 1");
    expect(cartHtml).toContain("12,50");
    expect(cartHtml).toContain("Total:");
    expect(cartHtml).toContain("Proceed to Checkout");
  });

  it("quantity changes recompute line totals and running total", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [
          {
            duckId: "philosopher",
            quantity: 1,
            name: "Philosopher Duck",
            price: 12.5,
          },
        ],
        updateCartItem: async (_duckId, quantity) => [
          {
            duckId: "philosopher",
            quantity,
            name: "Philosopher Duck",
            price: 12.5,
          },
        ],
        removeCartItem: async () => [],
      },
    });

    await app.init();
    await app.updateCartQuantity("philosopher", 3);

    const cartHtml = root.nodes["#cart"].innerHTML;
    expect(cartHtml).toContain("Qty: 3");
    expect(cartHtml).toContain("37,50");
    expect(cartHtml).toContain("Total:");
  });

  it("item removal updates totals and empty-state behavior", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [
          {
            duckId: "philosopher",
            quantity: 2,
            name: "Philosopher Duck",
            price: 12.5,
          },
        ],
        updateCartItem: async () => [],
        removeCartItem: async () => [],
      },
    });

    await app.init();
    await app.removeFromCart("philosopher");

    const cartHtml = root.nodes["#cart"].innerHTML;
    expect(cartHtml).toContain("Your cart is empty.");
  });

  it("cart API errors render feature-local friendly messages", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [],
        updateCartItem: async () => {
          throw { status: 409, message: "stock conflict in cart" };
        },
        removeCartItem: async () => [],
      },
    });

    await app.init();
    await app.addToCart("philosopher");

    const cartHtml = root.nodes["#cart"].innerHTML;
    expect(cartHtml).toContain("feature-error");
    expect(cartHtml).toContain("stock conflict in cart");
  });

  it("proceed-to-checkout triggers cart state transition", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [
          {
            duckId: "philosopher",
            quantity: 1,
            name: "Philosopher Duck",
            price: 12.5,
          },
        ],
        updateCartItem: async () => [],
        removeCartItem: async () => [],
      },
    });

    await app.init();
    app.proceedToCheckout();

    expect(app.getSnapshot().activePanel).toBe("checkout");
    expect(root.nodes["#cart"].innerHTML).toContain("Proceeding to checkout.");
  });

  it("checkout required-field and invalid-email errors are displayed inline", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [],
        updateCartItem: async () => [],
        removeCartItem: async () => [],
        submitCheckout: async () => ({ ok: true }),
      },
    });

    await app.init();
    await app.submitCheckoutForm({
      name: "",
      email: "invalid-email",
      address: "",
      card: "",
    });

    const checkoutHtml = root.nodes["#checkout"].innerHTML;
    expect(checkoutHtml).toContain("data-field=\"name\"");
    expect(checkoutHtml).toContain("data-field=\"email\"");
    expect(checkoutHtml).toContain("data-field=\"address\"");
    expect(checkoutHtml).toContain("data-field=\"card\"");
  });

  it("checkout API failures (400/409) show recoverable form-level errors", async () => {
    const root = createRootStub();
    let callCount = 0;
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [],
        updateCartItem: async () => [],
        removeCartItem: async () => [],
        submitCheckout: async () => {
          callCount += 1;
          if (callCount === 1) {
            throw { status: 400, message: "invalid checkout payload" };
          }
          throw { status: 409, message: "stock conflict" };
        },
      },
    });

    await app.init();
    await app.submitCheckoutForm({
      name: "Quincy",
      email: "quincy@pond.example",
      address: "1 Lily Pad Lane",
      card: "4242",
    });

    expect(root.nodes["#checkout"].innerHTML).toContain("invalid checkout payload");

    await app.submitCheckoutForm({
      name: "Quincy",
      email: "quincy@pond.example",
      address: "1 Lily Pad Lane",
      card: "4242",
    });

    expect(root.nodes["#checkout"].innerHTML).toContain("stock conflict");
  });

  it("successful checkout displays confirmation with order id, items, and total", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [
          { duckId: "philosopher", quantity: 1, name: "Philosopher Duck", price: 12.5 },
        ],
        updateCartItem: async () => [],
        removeCartItem: async () => [],
        submitCheckout: async () => ({
          confirmation: {
            order: {
              id: "order-123",
              items: [
                { duckId: "philosopher", name: "Philosopher Duck", quantity: 1 },
              ],
              total: 12.5,
            },
          },
          cart: [],
        }),
      },
    });

    await app.init();
    await app.submitCheckoutForm({
      name: "Quincy",
      email: "quincy@pond.example",
      address: "1 Lily Pad Lane",
      card: "4242",
    });

    const checkoutHtml = root.nodes["#checkout"].innerHTML;
    expect(checkoutHtml).toContain("Order confirmed");
    expect(checkoutHtml).toContain("order-123");
    expect(checkoutHtml).toContain("Philosopher Duck x 1");
    expect(checkoutHtml).toContain("12,50");
  });

  it("quiz submission renders recommended duck and message", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [],
        updateCartItem: async () => [],
        removeCartItem: async () => [],
        submitCheckout: async () => ({ ok: true }),
        submitQuizAnswers: async () => ({
          result: {
            duckId: "pirate",
            duckName: "Pirate Duck",
            message: "You are bold and adventurous.",
          },
        }),
      },
    });

    await app.init();
    app.setQuizAnswers({ mood: "bold", pace: "fast" });
    await app.submitQuiz();

    const quizHtml = root.nodes["#quiz"].innerHTML;
    expect(quizHtml).toContain("Recommended duck");
    expect(quizHtml).toContain("Pirate Duck");
    expect(quizHtml).toContain("You are bold and adventurous.");
  });

  it("quiz failure renders a local error without collapsing other sections", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => ducks,
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => ducks[0],
        fetchCart: async () => [],
        updateCartItem: async () => [],
        removeCartItem: async () => [],
        submitCheckout: async () => ({ ok: true }),
        submitQuizAnswers: async () => {
          throw { status: 400, message: "quiz answers incomplete" };
        },
      },
    });

    await app.init();
    await app.submitQuiz();

    expect(root.nodes["#quiz"].innerHTML).toContain("Could not complete quiz.");
    expect(root.nodes["#quiz"].innerHTML).toContain("quiz answers incomplete");
    expect(root.nodes["#catalog"].innerHTML).toContain("Catalog");
  });

  it("renders human-friendly, feature-scoped errors for 400/404/409 paths", async () => {
    const root = createRootStub();
    const app = createApp(root as unknown as Element, {
      api: {
        fetchCatalog: async () => {
          throw { status: 400, message: "invalid filter" };
        },
        fetchDuckOfTheDay: async () => ducks[1],
        fetchDuckDetail: async () => {
          throw { status: 404, message: "duck not found" };
        },
        fetchCart: async () => [],
        updateCartItem: async () => {
          throw { status: 409, message: "stock conflict" };
        },
        removeCartItem: async () => [],
        submitCheckout: async () => {
          throw { status: 409, message: "checkout conflict" };
        },
        submitQuizAnswers: async () => {
          throw { status: 400, message: "quiz incomplete" };
        },
      },
    });

    await app.init();
    await app.selectDuck("missing");
    await app.addToCart("philosopher");
    await app.submitCheckoutForm({
      name: "Quincy",
      email: "quincy@pond.example",
      address: "1 Lily Pad Lane",
      card: "4242",
    });
    await app.submitQuiz();

    expect(root.nodes["#catalog"].innerHTML).toContain("Could not load the catalog.");
    expect(root.nodes["#catalog"].innerHTML).toContain("invalid filter");

    expect(root.nodes["#duck-detail"].innerHTML).toContain("Could not load duck details.");
    expect(root.nodes["#duck-detail"].innerHTML).toContain("duck not found");

    expect(root.nodes["#cart"].innerHTML).toContain("Could not update your cart.");
    expect(root.nodes["#cart"].innerHTML).toContain("stock conflict");

    expect(root.nodes["#checkout"].innerHTML).toContain("Checkout failed.");
    expect(root.nodes["#checkout"].innerHTML).toContain("checkout conflict");

    expect(root.nodes["#quiz"].innerHTML).toContain("Could not complete quiz.");
    expect(root.nodes["#quiz"].innerHTML).toContain("quiz incomplete");
  });
});
