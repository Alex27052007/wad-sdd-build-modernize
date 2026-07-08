import {
  fetchCatalog,
  fetchCart,
  fetchDuckDetail,
  fetchDuckOfTheDay,
  removeCartItem,
  submitCheckout,
  submitQuizAnswers,
  updateCartItem,
} from "./api.js";
import { getState, setState } from "./state.js";
import { renderApp } from "./render.js";

function normalizeDuckList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object" && Array.isArray(payload.ducks)) {
    return payload.ducks;
  }
  return [];
}

function normalizeDuck(payload) {
  if (payload && typeof payload === "object" && payload.duck && typeof payload.duck === "object") {
    return payload.duck;
  }
  return payload;
}

function normalizeCart(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) {
      return payload.items;
    }
    if (payload.cart && typeof payload.cart === "object" && Array.isArray(payload.cart.items)) {
      return payload.cart.items;
    }
  }

  return [];
}

function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

function validateCheckoutForm(checkout) {
  const errors = {};

  if (String(checkout.name ?? "").trim().length === 0) {
    errors.name = "Name is required.";
  }

  const email = String(checkout.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (String(checkout.address ?? "").trim().length === 0) {
    errors.address = "Address is required.";
  }

  if (String(checkout.card ?? "").trim().length === 0) {
    errors.card = "Card number is required.";
  }

  return errors;
}

function normalizeCheckoutConfirmation(payload) {
  const confirmation = payload?.confirmation;
  const order = confirmation?.order ?? payload?.order;

  if (order && typeof order === "object") {
    return {
      orderId: order.id ?? confirmation?.orderId ?? "",
      items: Array.isArray(order.items) ? order.items : [],
      total: Number(order.total ?? 0),
    };
  }

  if (confirmation && typeof confirmation === "object") {
    return {
      orderId: confirmation.orderId ?? confirmation.id ?? "",
      items: Array.isArray(confirmation.items) ? confirmation.items : [],
      total: Number(confirmation.total ?? 0),
    };
  }

  return null;
}

function normalizeQuizResult(payload) {
  if (payload && typeof payload === "object") {
    if (payload.result && typeof payload.result === "object") {
      return payload.result;
    }
    if (payload.recommendation && typeof payload.recommendation === "object") {
      return payload.recommendation;
    }
  }
  return null;
}

function featureErrorMessage(error, fallback) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (message.length === 0) {
    return fallback;
  }
  return `${fallback} ${message}`;
}

function enrichCart(items, ducks) {
  const byId = new Map((ducks ?? []).map((duck) => [duck.id, duck]));

  return items.map((item) => {
    const quantity = Number(item.quantity ?? 0);
    const knownDuck = byId.get(item.duckId);
    const price = Number(item.price ?? item.unitPrice ?? knownDuck?.price ?? 0);
    return {
      ...item,
      duckId: item.duckId,
      quantity,
      price,
      name: item.name ?? knownDuck?.name ?? item.duckId,
      lineTotal: roundToCents(quantity * price),
    };
  });
}

function parsePriceInput(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

export function applyCatalogFilters(ducks, filters) {
  const query = String(filters.query ?? "").trim().toLowerCase();
  const category = String(filters.category ?? "").trim().toLowerCase();
  const minPrice = parsePriceInput(filters.minPrice);
  const maxPrice = parsePriceInput(filters.maxPrice);

  return ducks.filter((duck) => {
    if (query.length > 0) {
      const haystack = `${duck.name} ${duck.tagline} ${duck.category}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (category.length > 0 && String(duck.category).toLowerCase() !== category) {
      return false;
    }

    if (minPrice !== undefined && duck.price < minPrice) {
      return false;
    }

    if (maxPrice !== undefined && duck.price > maxPrice) {
      return false;
    }

    return true;
  });
}

export function createApp(root, deps = {}) {
  const api = deps.api ?? {
    fetchCatalog,
    fetchCart,
    fetchDuckDetail,
    fetchDuckOfTheDay,
    removeCartItem,
    submitCheckout,
    submitQuizAnswers,
    updateCartItem,
  };
  const readState = deps.getState ?? getState;
  const writeState = deps.setState ?? setState;
  const render = deps.renderApp ?? renderApp;

  function draw() {
    render(root, readState());
  }

  function readFilterFields() {
    const catalogEl = root.querySelector?.("#catalog");
    const query = catalogEl?.querySelector?.('input[name="query"]')?.value ?? "";
    const category = catalogEl?.querySelector?.('input[name="category"]')?.value ?? "";
    const minPrice = catalogEl?.querySelector?.('input[name="minPrice"]')?.value ?? "";
    const maxPrice = catalogEl?.querySelector?.('input[name="maxPrice"]')?.value ?? "";
    return { query, category, minPrice, maxPrice };
  }

  function readCheckoutFieldsFromDom() {
    const checkoutEl = root.querySelector?.("#checkout");
    return {
      name: checkoutEl?.querySelector?.('input[name="name"]')?.value ?? "",
      email: checkoutEl?.querySelector?.('input[name="email"]')?.value ?? "",
      address: checkoutEl?.querySelector?.('input[name="address"]')?.value ?? "",
      card: checkoutEl?.querySelector?.('input[name="card"]')?.value ?? "",
    };
  }

  function readQuizAnswersFromDom() {
    const quizEl = root.querySelector?.("#quiz");
    return {
      mood: quizEl?.querySelector?.('input[name="mood"]:checked')?.value ?? "",
      pace: quizEl?.querySelector?.('input[name="pace"]:checked')?.value ?? "",
    };
  }

  async function refreshCatalog() {
    const current = readState();
    try {
      const payload = await api.fetchCatalog(current.filters);
      const ducks = normalizeDuckList(payload);
      const filteredDucks = applyCatalogFilters(ducks, current.filters);
      writeState({
        ducks,
        filteredDucks,
        errors: {
          ...current.errors,
          catalog: null,
        },
      });
    } catch (error) {
      writeState({
        ducks: [],
        filteredDucks: [],
        errors: {
          ...current.errors,
          catalog: featureErrorMessage(error, "Could not load the catalog."),
        },
      });
    }
  }

  async function loadDuckOfTheDay() {
    const current = readState();
    try {
      const payload = await api.fetchDuckOfTheDay();
      writeState({
        duckOfTheDay: normalizeDuck(payload),
        errors: {
          ...current.errors,
          duckOfTheDay: null,
        },
      });
    } catch (error) {
      writeState({
        duckOfTheDay: null,
        errors: {
          ...current.errors,
          duckOfTheDay: featureErrorMessage(error, "Could not load duck of the day."),
        },
      });
    }
  }

  async function refreshCart() {
    const current = readState();
    try {
      const payload = await api.fetchCart();
      const cart = enrichCart(normalizeCart(payload), current.ducks);
      writeState({
        cart,
        errors: {
          ...current.errors,
          cart: null,
        },
      });
    } catch (error) {
      writeState({
        errors: {
          ...current.errors,
          cart: featureErrorMessage(error, "Could not load your cart."),
        },
      });
    }
  }

  async function init() {
    writeState({
      cartOpen: false,
      checkoutOpen: false,
      activeView: "shop",
    });
    await refreshCatalog();
    await loadDuckOfTheDay();
    await refreshCart();
    draw();
  }

  async function setFilters(nextFilters) {
    const current = readState();
    writeState({
      filters: {
        ...current.filters,
        ...nextFilters,
      },
    });
    await refreshCatalog();
    draw();
  }

  async function selectDuck(duckId) {
    const current = readState();
    try {
      const payload = await api.fetchDuckDetail(duckId);
      writeState({
        activeView: "detail",
        cartOpen: false,
        checkoutOpen: false,
        selectedDuckId: duckId,
        selectedDuck: normalizeDuck(payload),
        errors: {
          ...current.errors,
          detail: null,
        },
      });
    } catch (error) {
      writeState({
        activeView: "detail",
        cartOpen: false,
        checkoutOpen: false,
        selectedDuckId: duckId,
        selectedDuck: null,
        errors: {
          ...current.errors,
          detail: featureErrorMessage(error, "Could not load duck details."),
        },
      });
    }
    draw();
  }

  async function addToCart(duckId) {
    const current = readState();
    const existing = (current.cart ?? []).find((item) => item.duckId === duckId);
    const nextQuantity = Number(existing?.quantity ?? 0) + 1;

    try {
      const payload = await api.updateCartItem(duckId, nextQuantity);
      const cart = enrichCart(normalizeCart(payload), current.ducks);
      writeState({
        cart,
        errors: {
          ...current.errors,
          cart: null,
        },
      });
    } catch (error) {
      writeState({
        errors: {
          ...current.errors,
          cart: featureErrorMessage(error, "Could not update your cart."),
        },
      });
    }
    draw();
  }

  async function updateCartQuantity(duckId, quantity) {
    const current = readState();
    try {
      const payload = await api.updateCartItem(duckId, quantity);
      const cart = enrichCart(normalizeCart(payload), current.ducks);
      writeState({
        cart,
        errors: {
          ...current.errors,
          cart: null,
        },
      });
    } catch (error) {
      writeState({
        errors: {
          ...current.errors,
          cart: featureErrorMessage(error, "Could not update your cart."),
        },
      });
    }
    draw();
  }

  async function removeFromCart(duckId) {
    const current = readState();
    try {
      const payload = await api.removeCartItem(duckId);
      const cart = enrichCart(normalizeCart(payload), current.ducks);
      writeState({
        cart,
        errors: {
          ...current.errors,
          cart: null,
        },
      });
    } catch (error) {
      writeState({
        errors: {
          ...current.errors,
          cart: featureErrorMessage(error, "Could not remove this cart item."),
        },
      });
    }
    draw();
  }

  function proceedToCheckout() {
    writeState({
      activeView: "cart",
      cartOpen: true,
      checkoutOpen: true,
    });
    draw();
  }

  function toggleCart() {
    const current = readState();
    const nextOpen = !(current.activeView === "cart" && current.cartOpen);
    writeState({
      activeView: nextOpen ? "cart" : "shop",
      cartOpen: nextOpen,
      checkoutOpen: nextOpen ? current.checkoutOpen : false,
    });
    draw();
  }

  function closeCart() {
    writeState({
      activeView: "shop",
      cartOpen: false,
      checkoutOpen: false,
    });
    draw();
  }

  function showQuizView() {
    writeState({
      activeView: "quiz",
      cartOpen: false,
      checkoutOpen: false,
    });
    draw();
  }

  function showShopView() {
    writeState({
      activeView: "shop",
      cartOpen: false,
      checkoutOpen: false,
    });
    draw();
  }

  async function submitCheckoutForm(fields = {}) {
    const current = readState();
    const checkout = {
      ...current.checkout,
      ...fields,
    };
    const fieldErrors = validateCheckoutForm(checkout);

    if (Object.keys(fieldErrors).length > 0) {
      writeState({
        checkout: {
          ...checkout,
          errors: fieldErrors,
        },
        errors: {
          ...current.errors,
          checkout: null,
        },
      });
      draw();
      return { ok: false, reason: "validation" };
    }

    try {
      const payload = await api.submitCheckout({
        name: checkout.name,
        email: checkout.email,
        address: checkout.address,
        card: checkout.card,
      });

      const confirmation = normalizeCheckoutConfirmation(payload);
      const nextCart = payload?.cart !== undefined ? enrichCart(normalizeCart(payload.cart), current.ducks) : current.cart;

      writeState({
        activeView: "cart",
        cartOpen: true,
        checkoutOpen: true,
        cart: nextCart,
        checkout: {
          ...checkout,
          errors: {},
        },
        checkoutConfirmation: confirmation,
        errors: {
          ...current.errors,
          checkout: null,
        },
      });
      draw();
      return { ok: true };
    } catch (error) {
      writeState({
        activeView: "cart",
        cartOpen: true,
        checkoutOpen: true,
        checkout: {
          ...checkout,
          errors: {
            form: featureErrorMessage(error, "Checkout failed."),
          },
        },
        errors: {
          ...current.errors,
          checkout: null,
        },
      });
      draw();
      return { ok: false, reason: "api" };
    }
  }

  function setCheckoutFields(fields) {
    const current = readState();
    writeState({
      checkout: {
        ...current.checkout,
        ...fields,
      },
    });
    draw();
  }

  function setQuizAnswers(answers) {
    const current = readState();
    writeState({
      quiz: {
        ...current.quiz,
        answers: {
          ...(current.quiz?.answers ?? {}),
          ...answers,
        },
      },
    });
    draw();
  }

  async function submitQuiz() {
    const current = readState();
    try {
      const payload = await api.submitQuizAnswers({ answers: current.quiz?.answers ?? {} });
      const result = normalizeQuizResult(payload);
      writeState({
        quiz: {
          ...current.quiz,
          result,
        },
        errors: {
          ...current.errors,
          quiz: null,
        },
      });
    } catch (error) {
      writeState({
        errors: {
          ...current.errors,
          quiz: featureErrorMessage(error, "Could not complete quiz."),
        },
      });
    }
    draw();
  }

  return {
    addToCart,
    closeCart,
    init,
    proceedToCheckout,
    removeFromCart,
    selectDuck,
    setCheckoutFields,
    setFilters,
    setQuizAnswers,
    submitCheckoutForm,
    submitQuiz,
    showQuizView,
    showShopView,
    toggleCart,
    updateCartQuantity,
    getSnapshot: readState,
  };
}

export function bindAppDomEvents(root, app) {
  if (typeof root.addEventListener !== "function") {
    return;
  }

  root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const actionEl = target.closest("[data-action]");
    if (!(actionEl instanceof Element)) {
      return;
    }

    const action = actionEl.getAttribute("data-action");
    const duckId = actionEl.getAttribute("data-duck-id") ?? "";

    if (action === "apply-filters") {
      await app.setFilters(readFilterFieldsFromRoot(root));
      return;
    }
    if (action === "toggle-cart") {
      app.toggleCart();
      return;
    }
    if (action === "close-cart") {
      app.closeCart();
      return;
    }
    if (action === "show-quiz") {
      app.showQuizView();
      return;
    }
    if (action === "show-shop") {
      app.showShopView();
      return;
    }
    if (action === "select-duck" && duckId) {
      await app.selectDuck(duckId);
      return;
    }
    if (action === "add-to-cart" && duckId) {
      await app.addToCart(duckId);
      return;
    }
    if (action === "update-cart-item" && duckId) {
      const row = actionEl.closest("li[data-duck-id]");
      const quantityValue = row?.querySelector?.('input[name="quantity"]')?.value ?? "0";
      await app.updateCartQuantity(duckId, Number(quantityValue));
      return;
    }
    if (action === "remove-cart-item" && duckId) {
      await app.removeFromCart(duckId);
      return;
    }
    if (action === "proceed-to-checkout") {
      app.proceedToCheckout();
      return;
    }
    if (action === "submit-checkout") {
      await app.submitCheckoutForm(readCheckoutFieldsFromRoot(root));
      return;
    }
    if (action === "submit-quiz") {
      app.setQuizAnswers(readQuizAnswersFromRoot(root));
      await app.submitQuiz();
    }
  });
}

function readFilterFieldsFromRoot(root) {
  const catalogEl = root.querySelector?.("#catalog");
  const query = catalogEl?.querySelector?.('input[name="query"]')?.value ?? "";
  const category = catalogEl?.querySelector?.('input[name="category"]')?.value ?? "";
  const minPrice = catalogEl?.querySelector?.('input[name="minPrice"]')?.value ?? "";
  const maxPrice = catalogEl?.querySelector?.('input[name="maxPrice"]')?.value ?? "";
  return { query, category, minPrice, maxPrice };
}

function readCheckoutFieldsFromRoot(root) {
  const checkoutEl = root.querySelector?.("#checkout");
  return {
    name: checkoutEl?.querySelector?.('input[name="name"]')?.value ?? "",
    email: checkoutEl?.querySelector?.('input[name="email"]')?.value ?? "",
    address: checkoutEl?.querySelector?.('input[name="address"]')?.value ?? "",
    card: checkoutEl?.querySelector?.('input[name="card"]')?.value ?? "",
  };
}

function readQuizAnswersFromRoot(root) {
  const quizEl = root.querySelector?.("#quiz");
  return {
    mood: quizEl?.querySelector?.('input[name="mood"]:checked')?.value ?? "",
    pace: quizEl?.querySelector?.('input[name="pace"]:checked')?.value ?? "",
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const root = document;
  const app = createApp(root);
  bindAppDomEvents(root, app);
  void app.init();
}
