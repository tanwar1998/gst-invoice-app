import React from 'react';
import { GSTIN_VALIDATOR } from '../lib/validation.js';

export default function CustomerSection({ customer, invoiceDate, onChange, onDateChange, config, errors }) {
  const set = (field, value) => onChange({ ...customer, [field]: value });
  const gstinTouched = customer.gstin.trim().length > 0;
  const gstinInvalid = gstinTouched && !GSTIN_VALIDATOR.test(customer.gstin.trim().toUpperCase());

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-bold text-slate-800">Customer details</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="customer-name">Name *</label>
          <input
            id="customer-name"
            className="field"
            placeholder="Customer or business name"
            value={customer.name}
            onChange={(event) => set('name', event.target.value)}
          />
          {errors?.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="customer-phone">Phone</label>
          <input
            id="customer-phone"
            className="field"
            placeholder="9876543210"
            value={customer.phone}
            onChange={(event) => set('phone', event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="customer-gstin">GSTIN (optional)</label>
          <input
            id="customer-gstin"
            className="field uppercase"
            maxLength={15}
            placeholder="15-character GSTIN"
            value={customer.gstin}
            onChange={(event) => set('gstin', event.target.value.toUpperCase())}
          />
          {gstinInvalid && (
            <p className="mt-1 text-xs text-red-600">GSTIN must be exactly 15 valid characters.</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="customer-address">Address</label>
          <textarea
            id="customer-address"
            className="field"
            rows={2}
            placeholder="Delivery / billing address"
            value={customer.address}
            onChange={(event) => set('address', event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="sale-channel">Sale channel</label>
          <div className="flex rounded-lg border border-slate-300 p-1">
            {['OFFLINE', 'ONLINE'].map((channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => onChange({ ...customer, saleChannel: channel })}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                  customer.saleChannel === channel
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {channel === 'OFFLINE' ? 'Walk-in / Offline' : 'Online / Delivery'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="place-of-supply">Place of supply *</label>
          <select
            id="place-of-supply"
            className="field"
            value={customer.placeOfSupplyCode}
            onChange={(event) => onChange({ ...customer, placeOfSupplyCode: event.target.value })}
          >
            {config.states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
          {errors?.placeOfSupplyCode && (
            <p className="mt-1 text-xs text-red-600">{errors.placeOfSupplyCode}</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="invoice-date">Invoice date</label>
          <input
            id="invoice-date"
            type="date"
            className="field"
            value={invoiceDate}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
