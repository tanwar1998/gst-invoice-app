import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { money, formatDate } from '../lib/format.js';

export default function InvoiceHistory({ config, onShowInvoice }) {
  const [filters, setFilters] = useState({ q: '', from: '', to: '', channel: '', includeCancelled: true });
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getInvoices(filters);
      setInvoices(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.q, filters.from, filters.to, filters.channel, filters.includeCancelled]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const open = async (id, autoPrint = false) => {
    setActionError('');
    try {
      const invoice = await api.getInvoice(id);
      onShowInvoice(invoice, autoPrint);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const cancel = async (invoice) => {
    if (!window.confirm(`Cancel invoice ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    setActionError('');
    try {
      await api.cancelInvoice(invoice.id);
      await load();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-800">Invoice history</h2>
          <a className="btn-secondary text-xs" href={api.exportCsvUrl(filters)} download>
            Export CSV
          </a>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="field"
            placeholder="Search number / customer / phone / GSTIN"
            value={filters.q}
            onChange={(event) => set('q', event.target.value)}
          />
          <input className="field" type="date" aria-label="From date" value={filters.from} onChange={(event) => set('from', event.target.value)} />
          <input className="field" type="date" aria-label="To date" value={filters.to} onChange={(event) => set('to', event.target.value)} />
          <select className="field" value={filters.channel} onChange={(event) => set('channel', event.target.value)}>
            <option value="">All channels</option>
            <option value="OFFLINE">Offline</option>
            <option value="ONLINE">Online</option>
          </select>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={filters.includeCancelled}
              onChange={(event) => set('includeCancelled', event.target.checked)}
            />
            Include cancelled
          </label>
        </div>
      </div>

      {(error || actionError) && (
        <p className="px-4 py-2 text-xs text-red-600">{error || actionError}</p>
      )}

      {loading ? (
        <p className="p-6 text-center text-sm text-slate-500">Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">No invoices match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Place of supply</th>
                <th className="px-4 py-2">Tax</th>
                <th className="px-4 py-2 text-right">Grand total</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-semibold text-brand-700">
                    {invoice.invoiceNumber}
                    {invoice.cancelled && <span className="ml-2 badge bg-red-100 text-red-700">Cancelled</span>}
                  </td>
                  <td className="px-4 py-2">{formatDate(invoice.invoiceDate, config.dateFormat)}</td>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{invoice.customer.name}</div>
                    <div className="text-slate-500">{invoice.customer.phone}</div>
                  </td>
                  <td className="px-4 py-2">
                    {invoice.placeOfSupply.name} ({invoice.placeOfSupply.code})
                  </td>
                  <td className="px-4 py-2">
                    <span className={`badge ${invoice.taxType === 'INTRA' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {invoice.taxType === 'INTRA' ? 'CGST+SGST' : 'IGST'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-bold">
                    {money(invoice.totals.grandTotalPaise, config.currencySymbol)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => open(invoice.id)}>
                        Open
                      </button>
                      <button type="button" className="text-xs font-semibold text-slate-600 hover:underline" onClick={() => open(invoice.id, true)}>
                        Reprint
                      </button>
                      {!invoice.cancelled && (
                        <button type="button" className="text-xs font-semibold text-red-600 hover:underline" onClick={() => cancel(invoice)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
