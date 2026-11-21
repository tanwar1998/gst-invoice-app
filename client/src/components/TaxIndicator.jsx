import React from 'react';

export default function TaxIndicator({ taxDecision, override, onOverrideChange, allowOverride }) {
  const intra = taxDecision.taxType === 'INTRA';

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Tax type</h2>
          <p className="mt-0.5 text-xs text-slate-500">{taxDecision.reason}</p>
        </div>
        <span
          className={`badge px-3 py-1 text-sm ${
            intra ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {intra ? 'CGST + SGST' : 'IGST'}
        </span>
      </div>

      {allowOverride && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={Boolean(override)}
              onChange={(event) =>
                onOverrideChange(event.target.checked ? taxDecision.autoType : null)
              }
            />
            Override for this invoice
          </label>

          {override && (
            <select
              className="field w-auto py-1 text-xs"
              value={override}
              onChange={(event) => onOverrideChange(event.target.value)}
              aria-label="Override tax type"
            >
              <option value="INTRA">Intra-state (CGST + SGST)</option>
              <option value="INTER">Inter-state (IGST)</option>
            </select>
          )}
        </div>
      )}
    </section>
  );
}
