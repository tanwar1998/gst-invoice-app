import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import BillingScreen from './components/BillingScreen.jsx';
import InvoiceHistory from './components/InvoiceHistory.jsx';
import InvoiceDocument from './components/InvoiceDocument.jsx';

export default function App() {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState('');
  const [view, setView] = useState('bill');
  const [printState, setPrintState] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [configResult, productResult] = await Promise.all([api.getConfig(), api.getProducts()]);
        if (!active) return;
        setConfig(configResult);
        setProducts(productResult);
      } catch (err) {
        if (active) setInitError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  if (initError || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-lg p-6">
          <h1 className="text-lg font-bold text-red-700">Could not start the app</h1>
          <p className="mt-2 text-sm text-slate-600">{initError || 'Configuration is unavailable.'}</p>
          <p className="mt-2 text-xs text-slate-500">Make sure the API server is running on port 4000.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-base font-extrabold text-slate-900">GST Billing</div>
            <div className="text-[11px] text-slate-500">
              {config.seller.name} · GSTIN {config.seller.gstin || 'not set'}
            </div>
          </div>
          <nav className="flex gap-2">
            <button
              type="button"
              onClick={() => setView('bill')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                view === 'bill' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              New Invoice
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                view === 'history' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              History
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] p-4">
        {view === 'bill' ? (
          <BillingScreen
            config={config}
            products={products}
            onShowInvoice={(invoice, autoPrint) => setPrintState({ invoice, autoPrint })}
          />
        ) : (
          <InvoiceHistory
            config={config}
            onShowInvoice={(invoice, autoPrint) => setPrintState({ invoice, autoPrint })}
          />
        )}
      </main>

      {printState && (
        <InvoiceDocument
          invoice={printState.invoice}
          config={config}
          autoPrint={printState.autoPrint}
          onClose={() => setPrintState(null)}
        />
      )}
    </div>
  );
}
