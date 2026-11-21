import React from 'react';
import { moneyFromRupees } from '../lib/format.js';

export default function ProductGrid({ products, onAdd, symbol }) {
  if (!products.length) {
    return <p className="text-sm text-slate-500">No products loaded.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <button
          key={product.id}
          type="button"
          onClick={() => onAdd(product)}
          className="group flex min-h-[104px] flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-400 active:translate-y-0"
        >
          <div className="flex w-full items-start justify-between gap-2">
            <span className="text-sm font-bold leading-tight text-slate-800 group-hover:text-brand-700">
              {product.name}
            </span>
            <span className="badge bg-slate-100 text-[10px] text-slate-600">{product.gstRate}%</span>
          </div>
          <div>
            <div className="text-xs text-slate-500">per {product.unit}</div>
            <div className="text-lg font-extrabold text-brand-600">
              {moneyFromRupees(product.basePrice, symbol)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
