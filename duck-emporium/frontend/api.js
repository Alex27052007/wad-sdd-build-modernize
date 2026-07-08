function withQueryParams(path, params = {}) {
  const url = new URL(path, "http://localhost");

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return `${url.pathname}${url.search}`;
}

function normalizeApiError(status, payload) {
  const payloadMessage =
    payload !== null &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
      ? payload.message
      : undefined;

  return {
    status,
    message: payloadMessage ?? `Request failed (${status})`,
  };
}

async function parseResponseBody(response) {
  const raw = await response.text();
  if (raw.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw.trim() };
  }
}

async function request(path, options = {}) {
  const { method = "GET", body } = options;
  const init = { method, headers: {} };

  if (body !== undefined) {
    init.headers = {
      "content-type": "application/json",
    };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(path, init);
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw normalizeApiError(response.status, payload);
  }

  return payload;
}

export async function fetchCatalog(filters = {}) {
  return request(
    withQueryParams("/api/ducks", {
      query: filters.query,
      category: filters.category,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    }),
  );
}

export async function fetchDuckDetail(duckId) {
  return request(`/api/ducks/${encodeURIComponent(duckId)}`);
}

export async function fetchDuckOfTheDay() {
  return request("/api/duck-of-the-day");
}

export async function fetchCart() {
  return request("/api/cart");
}

export async function updateCartItem(duckId, quantity) {
  return request(`/api/cart/items/${encodeURIComponent(duckId)}`, {
    method: "PUT",
    body: { quantity },
  });
}

export async function removeCartItem(duckId) {
  return request(`/api/cart/items/${encodeURIComponent(duckId)}`, {
    method: "DELETE",
  });
}

export async function submitCheckout(payload) {
  return request("/api/checkout", {
    method: "POST",
    body: payload,
  });
}

export async function submitQuizAnswers(payload) {
  return request("/api/quiz", {
    method: "POST",
    body: payload,
  });
}
