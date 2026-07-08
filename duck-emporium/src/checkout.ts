/** Customer details for a checkout. The card is mocked — any non-empty
 *  string is accepted and it is never persisted. */
export interface CheckoutDetails {
  name: string; // non-empty after trim
  email: string; // conservative name@domain.tld pattern
  address: string; // non-empty after trim
  card: string; // non-empty after trim; mocked, never persisted
}

export interface OrderItem {
  duckId: string;
  name: string; // duck name at purchase time
  quantity: number;
  price: number; // unit price at purchase time
}

export interface Order {
  id: string; // crypto.randomUUID()
  items: OrderItem[];
  total: number; // cent-safe, same arithmetic as cartTotal
  createdAt: string; // new Date().toISOString()
  customer: { name: string; email: string; address: string }; // no card
}

export interface OrderConfirmation {
  order: Order;
  text: string; // renderOrderConfirmation(order)
}

// CheckoutResult is deferred to the checkout() task: it references the
// Cart type from add-to-cart, and src/cart.ts has not landed yet.

export interface CheckoutOptions {
  catalogPath?: string; // default DEFAULT_SEED_PATH
  ordersPath?: string; // default DEFAULT_ORDERS_PATH
}
