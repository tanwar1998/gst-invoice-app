import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { previewForCart } from '../lib/tax.js';
import { todayIso } from '../lib/format.js';
import { GSTIN_VALIDATOR, validateBillingForm } from '../lib/validation.js';
import ProductGrid from './ProductGrid.jsx';
import Cart from './Cart.jsx';
import CustomerSection from './CustomerSection.jsx';
import TaxIndicator from './TaxIndicator.jsx';
import TotalsPanel from './TotalsPanel.jsx';

function blankCustomer(config) {
  return {
    name: '',
    phone: '',
    address: '',
    gstin: '',
    saleChannel: config.defaultSaleChannel,
    placeOfSupplyCode: config.defaultPlaceOfSupply
  };
}

export default function BillingScreen({ config, products, onShowInvoice }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(() => blankCustomer(config));
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [override, setOverride] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  const preview = useMemo(
    () => previewForCart({
      cart,
      products,
      config,
      placeOfSupplyCode: customer.placeOfSupplyCode,
      override
    }),
    [cart, products, config, customer.placeOfSupplyCode, override]
  );

  const gstinInvalid =
    customer.gstin.trim().length > 0 && !GSTIN_VALIDATOR.test(customer.gstin.trim().toUpperCase());

  const addProduct = (product) => {
    setMessage('');
    setErrors({});
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: Number((Number(item.quantity || 0) + 1).toFixed(3)) }
            : item
        );
      }
      return [...prev, { productId: product.id, quantity: 1 }];
    });
  };

  const changeQuantity = (productId, rawValue) => {
    setMessage('');
    let quantity = rawValue;
    if (rawValue !== '' && Number.isFinite(Number(rawValue))) {
      quantity = Number(Number(rawValue).toFixed(3));
    }
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, quantity } : item)));
  };

  const removeProduct = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setOverride(null);
    setMessage('');
    setErrors({});
    setSubmitError('');
  };

  const save = async (alsoPrint) => {
    const foundErrors = validateBillingForm({ cart, customer, gstinInvalid });
    setErrors(foundErrors);
    setSubmitError('');
    setMessage('');
    if (Object.keys(foundErrors).length) return;

    setSaving(true);
    try {
      const invoice = await api.createInvoice({
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: customer.address.trim(),
          gstin: customer.gstin.trim().toUpperCase()
        },
        saleChannel: customer.saleChannel,
        placeOfSupplyCode: customer.placeOfSupplyCode,
        taxTypeOverride: override,
        invoiceDate,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity)
        }))
      });

      setMessage(`Invoice ${invoice.invoiceNumber} saved. Grand total: ${config.currencySymbol}${(invoice.totals.grandTotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      setCart([]);
      setOverride(null);
      if (alsoPrint) onShowInvoice(invoice, true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
      {submitError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}
      {errors.cart && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors.cart}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="card p-4 lg:col-span-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Products</h2>
          <ProductGrid products={products} onAdd={addProduct} symbol={config.currencySymbol} />
        </section>

        <div className="lg:col-span-3">
          <Cart
            cart={cart}
            products={products}
            calculatedLines={preview.lines}
            taxType={preview.taxDecision.taxType}
            symbol={config.currencySymbol}
            onQuantityChange={changeQuantity}
            onRemove={removeProduct}
            onClear={clearCart}
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <CustomerSection
            customer={customer}
            invoiceDate={invoiceDate}
            onChange={(next) => {
              setCustomer(next);
              setErrors({});
            }}
            onDateChange={setInvoiceDate}
            config={config}
            errors={errors}
          />
          <TaxIndicator
            taxDecision={preview.taxDecision}
            override={override}
            onOverrideChange={setOverride}
            allowOverride={config.allowPerInvoiceOverride}
          />
          <TotalsPanel
            calculation={preview}
            taxType={preview.taxDecision.taxType}
            config={config}
            symbol={config.currencySymbol}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => save(false)}>
              Save Invoice
            </button>
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => save(true)}>
              Save &amp; Print / PDF
            </button>
          </div>
          <button type="button" className="btn-danger w-full" disabled={saving || !cart.length} onClick={clearCart}>
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  );
}
