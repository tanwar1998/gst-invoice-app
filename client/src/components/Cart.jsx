import React from 'react';
import { money, formatQuantity } from '../lib/format.js';

export default function Cart({ cart, products, calculatedLines, taxType, symbol, onQuantityChange, onRemove, onClear }) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const lineMap = new Map(calculatedLines.map((line) => [line.productId, line]));

  return (
    <section className="card flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">
          Cart <span className="text-slate-400">({cart.length})</span>
        </h2>
        <button
          type="button"
          onClick={onClear}
          disabled={!cart.length}
          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
        >
          Clear cart
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
          <p className="text-sm text-slate-400">Tap a product to start billing.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {cart.map((item) => {
            const product = productMap.get(item.productId);
            const calc = lineMap.get(item.productId);
            if (!product || !calc) return null;

            const step = product.unit === 'pack' ? 1 : 0.5;
            const taxLabel = taxType === 'INTER' ? 'IGST' : 'CGST+SGST';

            return (
              <div key={item.productId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{product.name}</div>
                    <div className="text-xs text-slate-500">
                      {money(calc.basePricePaise, symbol)} / {product.unit} · GST {product.gstRate}%
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.productId)}
                    aria-label={`Remove ${product.name}`}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.productId, (Number(item.quantity) || 0) - step)}
                    className="h-8 w-8 rounded-lg border border-slate-300 bg-white text-lg font-bold leading-none text-slate-700 hover:bg-slate-50"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.quantity}
                    onChange={(event) => onQuantityChange(item.productId, event.target.value)}
                    className="field h-8 w-20 text-center text-sm font-semibold"
                    aria-label={`Quantity of ${product.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.productId, (Number(item.quantity) || 0) + step)}
                    className="h-8 w-8 rounded-lg border border-slate-300 bg-white text-lg font-bold leading-none text-slate-700 hover:bg-slate-50"
                  >
                    +
                  </button>
                  <span className="ml-auto text-xs text-slate-500">{product.unit}</span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-2 py-2 text-[11px]">
                  <div>
                    <div className="text-slate-500">Taxable</div>
                    <div className="font-semibold text-slate-800">{money(calc.taxablePaise, symbol)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{taxLabel}</div>
                    <div className="font-semibold text-slate-800">{money(calc.taxPaise, symbol)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500">Line total</div>
                    <div className="font-bold text-brand-700">{money(calc.lineTotalPaise, symbol)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
