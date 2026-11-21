import React from 'react';
import { money } from '../lib/format.js';
import { amountInWords } from '../lib/tax.js';

function Row({ label, value, strong = false, muted = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${muted ? 'text-slate-500' : ''}`}>
      <span className={strong ? 'text-sm font-bold text-slate-900' : 'text-xs text-slate-600'}>{label}</span>
      <span className={strong ? 'text-xl font-extrabold text-brand-700' : 'text-sm font-semibold text-slate-800'}>
        {value}
      </span>
    </div>
  );
}

export default function TotalsPanel({ calculation, taxType, config, symbol }) {
  const intra = taxType === 'INTRA';
  const { totals, roundOffPaise, grandTotalPaise } = calculation;

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-bold text-slate-800">Totals</h2>
      <div className="divide-y divide-slate-100">
        <Row label="Taxable value" value={money(totals.taxablePaise, symbol)} />
        {intra ? (
          <>
            <Row label="CGST" value={money(totals.cgstPaise, symbol)} />
            <Row label="SGST" value={money(totals.sgstPaise, symbol)} />
          </>
        ) : (
          <Row label="IGST" value={money(totals.igstPaise, symbol)} />
        )}
        <Row label="Round off" value={money(roundOffPaise, symbol)} />
        <div className="pt-2">
          <Row label="Grand total" value={money(grandTotalPaise, symbol)} strong />
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-brand-50 p-3 text-xs font-semibold leading-relaxed text-brand-800">
        {amountInWords(grandTotalPaise)}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Preview only — final amounts are calculated and stored by the server.
      </p>
    </section>
  );
}
