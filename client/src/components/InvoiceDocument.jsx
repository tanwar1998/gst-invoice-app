import React, { useEffect } from 'react';
import { money, formatQuantity, formatDate, moneyFromRupees } from '../lib/format.js';

function Cell({ children, className = '' }) {
  return <td className={`border border-slate-400 px-1.5 py-1 align-top ${className}`}>{children}</td>;
}

export default function InvoiceDocument({ invoice, config, autoPrint = false, onClose }) {
  useEffect(() => {
    if (!autoPrint) return undefined;
    const timer = setTimeout(() => window.print(), 350);
    return () => clearTimeout(timer);
  }, [autoPrint, invoice?.id]);

  if (!invoice) return null;

  const symbol = config?.currencySymbol || '₹';
  const dateFormat = config?.dateFormat || 'DD/MM/YYYY';
  const intra = invoice.taxType === 'INTRA';
  const seller = invoice.seller || {};
  const bank = invoice.bank || {};
  const rates = [...new Set(invoice.lines.map((line) => Number(line.gstRate) || 0))];
  const singleRate = rates.length === 1 ? rates[0] : null;
  const halfRate = singleRate === null ? null : singleRate / 2;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-600/60 p-4 no-print-overlay">
      <div className="mx-auto max-w-[210mm]">
        <div className="mb-3 flex items-center justify-between no-print">
          <div className="text-sm font-semibold text-white">
            Invoice {invoice.invoiceNumber}
            {invoice.cancelled && ' · CANCELLED'}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
            {onClose && (
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>

        <div className="print-area bg-white p-8 text-[10px] leading-tight text-slate-900 shadow-2xl">
          {invoice.cancelled && (
            <div className="float-right -rotate-12 border-4 border-red-600 px-4 py-2 text-2xl font-extrabold text-red-600">
              CANCELLED
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
            <div>
              <div className="text-lg font-extrabold uppercase tracking-wide">{seller.name}</div>
              <div className="mt-1 whitespace-pre-line text-slate-700">{seller.address}</div>
              <div className="mt-1">
                <span className="font-semibold">GSTIN:</span> {seller.gstin || '-'}
                <span className="ml-4 font-semibold">Phone:</span> {seller.phone || '-'}
              </div>
              <div>
                <span className="font-semibold">State:</span> {seller.stateName} ({seller.stateCode})
                {seller.email ? <span className="ml-4">Email: {seller.email}</span> : null}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-extrabold tracking-widest">TAX INVOICE</div>
              <div className="mt-2">Invoice No: <span className="font-bold">{invoice.invoiceNumber}</span></div>
              <div>Date: <span className="font-bold">{formatDate(invoice.invoiceDate, dateFormat)}</span></div>
              <div className="mt-1">Channel: {invoice.saleChannel}</div>
            </div>
          </div>

          {/* Buyer and place of supply */}
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="border border-slate-400 p-2">
              <div className="mb-1 font-bold uppercase tracking-wide text-slate-600">Bill to / Ship to</div>
              <div className="text-xs font-bold">{invoice.customer.name}</div>
              <div className="whitespace-pre-line">{invoice.customer.address || '-'}</div>
              <div>Phone: {invoice.customer.phone || '-'}</div>
              <div>GSTIN: {invoice.customer.gstin || '-'}</div>
            </div>
            <div className="border border-slate-400 p-2">
              <div className="mb-1 font-bold uppercase tracking-wide text-slate-600">Supply details</div>
              <div>
                <span className="font-semibold">Place of supply:</span>{' '}
                {invoice.placeOfSupply.name} ({invoice.placeOfSupply.code})
              </div>
              <div>
                <span className="font-semibold">Tax applied:</span>{' '}
                {intra ? 'CGST + SGST (Intra-state)' : 'IGST (Inter-state)'}
              </div>
              <div className="mt-1 text-slate-600">{invoice.taxTypeReason}</div>
              <div className="mt-1">
                Pricing: {invoice.pricesIncludeGst ? 'Tax inclusive' : 'Tax exclusive'}
              </div>
            </div>
          </div>

          {/* Line items */}
          <table className="mt-4 w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-slate-100 text-[9px] uppercase">
                <th className="w-[4%] border border-slate-400 px-1 py-1">#</th>
                <th className={`${intra ? 'w-[20%]' : 'w-[21%]'} border border-slate-400 px-1 py-1 text-left`}>Description</th>
                <th className="w-[9%] border border-slate-400 px-1 py-1">HSN</th>
                <th className="w-[9%] border border-slate-400 px-1 py-1">Qty</th>
                <th className="w-[6%] border border-slate-400 px-1 py-1">Unit</th>
                <th className="w-[9%] border border-slate-400 px-1 py-1 text-right">Rate</th>
                <th className="w-[11%] border border-slate-400 px-1 py-1 text-right">Taxable value</th>
                {intra ? (
                  <>
                    <th className="w-[10%] border border-slate-400 px-1 py-1 text-right">CGST % / Amt</th>
                    <th className="w-[10%] border border-slate-400 px-1 py-1 text-right">SGST % / Amt</th>
                  </>
                ) : (
                  <th className="w-[19%] border border-slate-400 px-1 py-1 text-right">IGST % / Amt</th>
                )}
                <th className="w-[11%] border border-slate-400 px-1 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, index) => (
                <tr key={line.id} className="avoid-break">
                  <Cell className="text-center">{index + 1}</Cell>
                  <Cell className="font-semibold">{line.name}</Cell>
                  <Cell className="text-center">{line.hsn || '-'}</Cell>
                  <Cell className="text-center">{formatQuantity(line.quantity)}</Cell>
                  <Cell className="text-center">{line.unit}</Cell>
                  <Cell className="text-right">{moneyFromRupees(line.basePrice, symbol)}</Cell>
                  <Cell className="text-right">{money(line.taxablePaise, symbol)}</Cell>
                  {intra ? (
                    <>
                      <Cell className="text-right">
                        {line.gstRate / 2}%<br />{money(line.cgstPaise, symbol)}
                      </Cell>
                      <Cell className="text-right">
                        {line.gstRate / 2}%<br />{money(line.sgstPaise, symbol)}
                      </Cell>
                    </>
                  ) : (
                    <Cell className="text-right">
                      {line.gstRate}%<br />{money(line.igstPaise, symbol)}
                    </Cell>
                  )}
                  <Cell className="text-right font-semibold">{money(line.lineTotalPaise, symbol)}</Cell>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary + declarations */}
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="border border-slate-400 p-2">
                <div className="mb-1 font-bold uppercase tracking-wide text-slate-600">Tax summary</div>
                <div className="flex justify-between"><span>Taxable value</span><span>{money(invoice.totals.taxablePaise, symbol)}</span></div>
                {intra ? (
                  <>
                    <div className="flex justify-between"><span>CGST{halfRate === null ? '' : ` (${halfRate}%)`}</span><span>{money(invoice.totals.cgstPaise, symbol)}</span></div>
                    <div className="flex justify-between"><span>SGST{halfRate === null ? '' : ` (${halfRate}%)`}</span><span>{money(invoice.totals.sgstPaise, symbol)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>IGST{singleRate === null ? '' : ` (${singleRate}%)`}</span>
                    <span>{money(invoice.totals.igstPaise, symbol)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>Round off</span><span>{money(invoice.totals.roundOffPaise, symbol)}</span></div>
                <div className="mt-1 flex justify-between border-t border-slate-400 pt-1 text-xs font-extrabold">
                  <span>Grand total</span><span>{money(invoice.totals.grandTotalPaise, symbol)}</span>
                </div>
              </div>

              <div className="mt-2 border border-slate-400 p-2">
                <div className="font-bold uppercase tracking-wide text-slate-600">Amount in words</div>
                <div className="mt-1 text-xs font-semibold">{invoice.amountInWords}</div>
              </div>
            </div>

            <div>
              {bank.name || bank.accountNumber ? (
                <div className="border border-slate-400 p-2">
                  <div className="mb-1 font-bold uppercase tracking-wide text-slate-600">Bank details</div>
                  <div>Bank: {bank.name || '-'}</div>
                  <div>A/C No: {bank.accountNumber || '-'}</div>
                  <div>IFSC: {bank.ifsc || '-'}</div>
                  <div>Branch: {bank.branch || '-'}</div>
                </div>
              ) : null}

              <div className="mt-2 border border-slate-400 p-2">
                <div className="font-bold uppercase tracking-wide text-slate-600">Terms</div>
                <div className="mt-1">{invoice.terms || '-'}</div>
              </div>

              <div className="mt-8 text-right">
                <div className="border-t border-slate-800 pt-1 text-xs font-bold">For {seller.name}</div>
                <div className="mt-6 text-slate-600">Authorised Signatory</div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-300 pt-2 text-center text-[9px] text-slate-500">
            This is a computer-generated tax invoice. Subject to {seller.stateName} jurisdiction.
          </div>
        </div>
      </div>
    </div>
  );
}
