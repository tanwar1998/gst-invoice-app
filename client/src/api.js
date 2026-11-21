async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (data && (data.error || (Array.isArray(data.errors) && data.errors.join(' ')))) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  getConfig: () => request('/api/config'),
  getProducts: () => request('/api/products'),
  createInvoice: (payload) => request('/api/invoices', { method: 'POST', body: JSON.stringify(payload) }),
  getInvoices: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
    });
    return request(`/api/invoices?${query.toString()}`);
  },
  getInvoice: (id) => request(`/api/invoices/${id}`),
  cancelInvoice: (id) => request(`/api/invoices/${id}/cancel`, { method: 'POST' }),
  exportCsvUrl: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
    });
    return `/api/invoices/export.csv?${query.toString()}`;
  }
};
