const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = new Error(`API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  // Inventory
  getInventory:    ()           => request('/inventory'),
  getLowStock:     ()           => request('/inventory/low-stock'),
  updateQuantity:  (id, delta, reason) =>
    request(`/inventory/${id}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ delta, reason }),
    }),

  // Products
  getProducts:     (category)   => request(`/products${category ? `?category=${category}` : ''}`),
  createProduct:   (data)       => request('/products', { method: 'POST', body: JSON.stringify(data) }),

  // Orders
  getOrders:       ()           => request('/orders'),
  createOrder:     (items)      => request('/orders', { method: 'POST', body: JSON.stringify({ items }) }),

  // AI
  askAI:           (question, context) =>
    request('/ai/ask', { method: 'POST', body: JSON.stringify({ question, context }) }),
  getReorderSuggestions: ()     => request('/ai/reorder-suggestions'),
  getCombos:       (productIds) =>
    request('/ai/combos', { method: 'POST', body: JSON.stringify({ productIds }) }),
};

// SWR fetcher
export const fetcher = (url) => fetch(url).then(r => r.json());
