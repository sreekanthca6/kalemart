const BASE = '/api';
const TOKEN_KEY = 'km_token';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = new Error(`API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function authRequest(path, body) {
  const res = await fetch(`${BASE}/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const auth = {
  login:    (email, password) => authRequest('/login', { email, password }),
  register: (email, password, storeName) => authRequest('/register', { email, password, storeName }),
  logout:   () => { clearToken(); window.location.href = '/login'; },
  setToken,
  getToken,
  isLoggedIn: () => !!getToken(),
};

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

  // Finance
  getActuals:      ()           => request('/finance/actuals'),
  getPnl:          (months)     => request(`/finance/pnl${months ? `?months=${months}` : ''}`),
  getTopProducts:  (limit)      => request(`/finance/top-products${limit ? `?limit=${limit}` : ''}`),

  // Order basket / restock
  getOrderBasket:  ()           => request('/order-basket'),
  approveBasket:   (items, schedule) => request('/order-basket/approve', { method: 'POST', body: JSON.stringify({ items, schedule }) }),

  // Setup
  getSetupStatus:  ()           => request('/setup/status'),
  saveConfig:      (updates)    => request('/setup/config', { method: 'POST', body: JSON.stringify(updates) }),
  importProducts:  (csv, replaceAll) => request('/setup/products/import', { method: 'POST', body: JSON.stringify({ csv, replaceAll }) }),
  getProductCount: ()           => request('/setup/products/count'),

  // Tax
  getTaxSummary:   (start, end) => request(`/tax/summary?start=${start}&end=${end}`),
  getTaxPeriods:   ()           => request('/tax/periods'),

  // Bookkeeping
  getExpenses:     ()           => request('/bookkeeping/expenses'),
  createExpense:   (data)       => request('/bookkeeping/expenses', { method: 'POST', body: JSON.stringify(data) }),
  getCategories:   ()           => request('/bookkeeping/categories'),

  // Operations
  getReadiness:    ()           => request('/ops/readiness'),
};

// Drop-in fetch() replacement that adds auth header and redirects on 401
export function authFetch(url, options = {}) {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(r => {
    if (r.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    return r;
  });
}

export const fetcher = (url) => {
  const token = getToken();
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => {
    if (r.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json();
  });
};
