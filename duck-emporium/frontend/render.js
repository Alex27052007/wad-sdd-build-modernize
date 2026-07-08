function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrice(price) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

function readLineTotal(item) {
  if (typeof item.lineTotal === "number") {
    return item.lineTotal;
  }
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.price ?? item.unitPrice ?? 0);
  return quantity * unitPrice;
}

export function renderFeatureError(_targetEl, message) {
  return `<p class="feature-error" role="alert">${escapeHtml(message)}</p>`;
}

export function renderCatalog(ducks, filters = {}) {
  const query = filters.query ?? "";
  const category = filters.category ?? "";
  const minPrice = filters.minPrice ?? "";
  const maxPrice = filters.maxPrice ?? "";

  const controls = `<form class="catalog-filters" novalidate>
  <label>Search
    <input name="query" value="${escapeHtml(query)}" placeholder="Search ducks">
  </label>
  <label>Category
    <input name="category" value="${escapeHtml(category)}" placeholder="classic, pirate...">
  </label>
  <label>Min price
    <input name="minPrice" value="${escapeHtml(minPrice)}" inputmode="decimal" placeholder="0">
  </label>
  <label>Max price
    <input name="maxPrice" value="${escapeHtml(maxPrice)}" inputmode="decimal" placeholder="100">
  </label>
  <button type="button" data-action="apply-filters">Apply Filters</button>
</form>`;

  if (!Array.isArray(ducks) || ducks.length === 0) {
    return `${controls}<p>No ducks match the current criteria.</p>`;
  }

  const cards = ducks
    .map((duck) => {
      return `<article class="duck-card" data-duck-id="${escapeHtml(duck.id)}">
  <h3>${escapeHtml(duck.name)}</h3>
  <p><strong>Category:</strong> ${escapeHtml(duck.category)}</p>
  <p><strong>Price:</strong> ${escapeHtml(formatPrice(duck.price))}</p>
  <p>${escapeHtml(duck.tagline)}</p>
  <button type="button" data-action="select-duck" data-duck-id="${escapeHtml(duck.id)}">View Details</button>
  <button type="button" data-action="add-to-cart" data-duck-id="${escapeHtml(duck.id)}">Add to Cart</button>
</article>`;
    })
    .join("\n");

  return `${controls}<div class="duck-grid">${cards}</div>`;
}

export function renderDuckDetail(duck) {
  if (!duck) {
    return "<p>Select a duck to see full details.</p>";
  }

  const traits = Array.isArray(duck.traits) && duck.traits.length > 0
    ? duck.traits.map((trait) => `<li>${escapeHtml(trait)}</li>`).join("")
    : "<li>No traits listed.</li>";

  const stockStatus = duck.stock > 0 ? `In stock (${duck.stock})` : "Out of stock";

  return `<article class="duck-detail-card" data-duck-id="${escapeHtml(duck.id)}">
  <h3>${escapeHtml(duck.name)}</h3>
  <p>${escapeHtml(duck.description ?? "")}</p>
  <p><strong>Stock:</strong> ${escapeHtml(stockStatus)}</p>
  <h4>Personality traits</h4>
  <ul>${traits}</ul>
  <button type="button" data-action="add-to-cart" data-duck-id="${escapeHtml(duck.id)}">Add to Cart</button>
</article>`;
}

export function renderDuckOfTheDay(duck) {
  if (!duck) {
    return "<p>No featured duck today.</p>";
  }

  return `<article class="duck-day-card" data-duck-id="${escapeHtml(duck.id)}">
  <h3>${escapeHtml(duck.name)}</h3>
  <p>${escapeHtml(duck.tagline)}</p>
  <p><strong>Category:</strong> ${escapeHtml(duck.category)}</p>
</article>`;
}

export function renderCart(cart, activePanel = "catalog") {
  if (!Array.isArray(cart) || cart.length === 0) {
    return `<p>Your cart is empty.</p>
<button type="button" data-action="proceed-to-checkout" disabled>Proceed to Checkout</button>`;
  }

  const rows = cart
    .map((item) => {
      const name = item.name ?? item.duckName ?? item.duckId ?? "Duck";
      const quantity = Number(item.quantity ?? 0);
      const lineTotal = readLineTotal(item);
      return `<li data-duck-id="${escapeHtml(item.duckId)}">
  <span class="line-name">${escapeHtml(name)}</span>
  <span class="line-qty">Qty: ${escapeHtml(quantity)}</span>
  <span class="line-total">${escapeHtml(formatPrice(lineTotal))}</span>
  <label>
    <span class="visually-hidden">Quantity</span>
    <input name="quantity" inputmode="numeric" value="${escapeHtml(quantity)}">
  </label>
  <button type="button" data-action="update-cart-item" data-duck-id="${escapeHtml(item.duckId)}">Update</button>
  <button type="button" data-action="remove-cart-item" data-duck-id="${escapeHtml(item.duckId)}">Remove</button>
</li>`;
    })
    .join("");

  const total = cart.reduce((sum, item) => sum + readLineTotal(item), 0);
  const checkoutState = activePanel === "checkout"
    ? `<p class="checkout-state">Proceeding to checkout.</p>`
    : "";

  return `<ul class="cart-lines">${rows}</ul>
<p class="cart-total"><strong>Total:</strong> ${escapeHtml(formatPrice(total))}</p>
<button type="button" data-action="proceed-to-checkout">Proceed to Checkout</button>
${checkoutState}`;
}

export function renderCheckout(checkout = {}, confirmation = null) {
  const errors = checkout.errors ?? {};
  const name = checkout.name ?? "";
  const email = checkout.email ?? "";
  const address = checkout.address ?? "";
  const card = checkout.card ?? "";

  const confirmationBlock = confirmation
    ? `<article class="checkout-confirmation">
  <h3>Order confirmed</h3>
  <p><strong>Order ID:</strong> ${escapeHtml(confirmation.orderId ?? "")}</p>
  <ul>${(confirmation.items ?? [])
      .map((item) => `<li>${escapeHtml(item.name ?? item.duckId ?? "Duck")} x ${escapeHtml(item.quantity ?? 0)}</li>`)
      .join("")}</ul>
  <p><strong>Total:</strong> ${escapeHtml(formatPrice(Number(confirmation.total ?? 0)))}</p>
</article>`
    : "";

  return `${confirmationBlock}
<form class="checkout-form" novalidate>
  <label>Name
    <input name="name" value="${escapeHtml(name)}">
  </label>
  ${errors.name ? `<p class="checkout-field-error" data-field="name">${escapeHtml(errors.name)}</p>` : ""}

  <label>Email
    <input name="email" value="${escapeHtml(email)}">
  </label>
  ${errors.email ? `<p class="checkout-field-error" data-field="email">${escapeHtml(errors.email)}</p>` : ""}

  <label>Address
    <input name="address" value="${escapeHtml(address)}">
  </label>
  ${errors.address ? `<p class="checkout-field-error" data-field="address">${escapeHtml(errors.address)}</p>` : ""}

  <label>Card number
    <input name="card" value="${escapeHtml(card)}">
  </label>
  ${errors.card ? `<p class="checkout-field-error" data-field="card">${escapeHtml(errors.card)}</p>` : ""}

  ${errors.form ? `<p class="checkout-form-error" role="alert">${escapeHtml(errors.form)}</p>` : ""}

  <button type="button" data-action="submit-checkout">Place Order</button>
</form>`;
}

export function renderQuiz(quiz = {}) {
  const answers = quiz.answers ?? {};
  const result = quiz.result;
  const mood = answers.mood ?? "";
  const pace = answers.pace ?? "";

  const resultBlock = result
    ? `<article class="quiz-result">
  <h3>Recommended duck</h3>
  <p><strong>${escapeHtml(result.duckName ?? result.duckId ?? "Duck")}</strong></p>
  <p>${escapeHtml(result.message ?? "")}</p>
</article>`
    : "";

  return `${resultBlock}
<form class="quiz-form" novalidate>
  <fieldset>
    <legend>Quiz mood</legend>
    <label>
      <input type="radio" name="mood" value="calm" ${mood === "calm" ? "checked" : ""}>
      Calm
    </label>
    <label>
      <input type="radio" name="mood" value="bold" ${mood === "bold" ? "checked" : ""}>
      Bold
    </label>
  </fieldset>

  <fieldset>
    <legend>Quiz pace</legend>
    <label>
      <input type="radio" name="pace" value="slow" ${pace === "slow" ? "checked" : ""}>
      Slow
    </label>
    <label>
      <input type="radio" name="pace" value="fast" ${pace === "fast" ? "checked" : ""}>
      Fast
    </label>
  </fieldset>

  <button type="button" data-action="submit-quiz">Show Recommendation</button>
</form>`;
}

export function renderApp(root, state) {
  const catalog = root.querySelector("#catalog");
  const detail = root.querySelector("#duck-detail");
  const day = root.querySelector("#duck-of-the-day");
  const cart = root.querySelector("#cart");
  const checkout = root.querySelector("#checkout");
  const quiz = root.querySelector("#quiz");

  if (catalog) {
    const error = state.errors?.catalog;
    const body = error
      ? renderFeatureError(catalog, error)
      : renderCatalog(state.filteredDucks, state.filters);
    catalog.innerHTML = `<h2>Catalog</h2>${body}`;
  }

  if (detail) {
    const error = state.errors?.detail;
    const body = error ? renderFeatureError(detail, error) : renderDuckDetail(state.selectedDuck);
    detail.innerHTML = `<h2>Duck Detail</h2>${body}`;
  }

  if (day) {
    const error = state.errors?.duckOfTheDay;
    const body = error ? renderFeatureError(day, error) : renderDuckOfTheDay(state.duckOfTheDay);
    day.innerHTML = `<h2>Duck of the Day</h2>${body}`;
  }

  if (cart) {
    const error = state.errors?.cart;
    const body = error ? renderFeatureError(cart, error) : renderCart(state.cart, state.activePanel);
    cart.innerHTML = `<h2>Cart</h2>${body}`;
  }

  if (checkout) {
    const error = state.errors?.checkout;
    const body = error
      ? renderFeatureError(checkout, error)
      : renderCheckout(state.checkout, state.checkoutConfirmation);
    checkout.innerHTML = `<h2>Checkout</h2>${body}`;
  }

  if (quiz) {
    const error = state.errors?.quiz;
    const body = error ? renderFeatureError(quiz, error) : renderQuiz(state.quiz);
    quiz.innerHTML = `<h2>Personality Quiz</h2>${body}`;
  }
}
