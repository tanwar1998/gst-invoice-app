'use strict';

const { isValidStateCode, stateName } = require('./states');
const { quantityToMilli } = require('./tax');

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateInvoicePayload(payload, { products, config }) {
  const errors = [];
  const body = payload && typeof payload === 'object' ? payload : {};
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};

  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const address = String(customer.address || '').trim();
  const gstin = String(customer.gstin || '').trim().toUpperCase();
  const saleChannel = String(body.saleChannel || config.defaultSaleChannel).toUpperCase();
  const placeOfSupplyCode = String(body.placeOfSupplyCode || config.defaultPlaceOfSupply);
  const override = body.taxTypeOverride === 'INTRA' || body.taxTypeOverride === 'INTER'
    ? body.taxTypeOverride
    : null;

  if (!name || name.length < 2) errors.push('Customer name is required (at least 2 characters).');
  if (name.length > 120) errors.push('Customer name is too long.');
  if (phone && !PHONE_RE.test(phone)) errors.push('Phone number looks invalid.');
  if (address.length > 500) errors.push('Address is too long.');
  if (gstin && !GSTIN_RE.test(gstin)) errors.push('GSTIN must be a valid 15-character number.');
  if (!['ONLINE', 'OFFLINE'].includes(saleChannel)) errors.push('Sale channel must be ONLINE or OFFLINE.');
  if (!isValidStateCode(placeOfSupplyCode)) errors.push('Select a valid place-of-supply state.');
  if (override && !config.allowPerInvoiceOverride) {
    errors.push('Per-invoice tax override is disabled in configuration.');
  }

  let invoiceDate = String(body.invoiceDate || new Date().toISOString().slice(0, 10));
  if (!DATE_RE.test(invoiceDate) || Number.isNaN(new Date(`${invoiceDate}T00:00:00`).getTime())) {
    errors.push('Invoice date must be in YYYY-MM-DD format.');
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) errors.push('Add at least one product to the invoice.');
  if (rawItems.length > 200) errors.push('Too many line items (maximum 200).');

  const productMap = new Map(products.map((p) => [p.id, p]));
  const items = [];

  rawItems.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Line ${index + 1} is invalid.`);
      return;
    }
    const product = productMap.get(String(item.productId));
    if (!product) {
      errors.push(`Line ${index + 1}: unknown product.`);
      return;
    }
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) {
      errors.push(`Line ${index + 1}: quantity must be between 0 and 100000.`);
      return;
    }
    let quantityMilli;
    try {
      quantityMilli = quantityToMilli(qty);
    } catch {
      errors.push(`Line ${index + 1}: invalid quantity.`);
      return;
    }
    items.push({
      productId: product.id,
      nameSnapshot: product.name,
      hsnSnapshot: product.hsn,
      unitSnapshot: product.unit,
      basePricePaise: product.basePricePaise,
      gstRate: product.gstRate,
      quantity: qty,
      quantityMilli
    });
  });

  if (errors.length) return { errors, value: null };

  return {
    errors: [],
    value: {
      customer: { name, phone, address, gstin },
      saleChannel,
      placeOfSupplyCode,
      placeOfSupplyName: stateName(placeOfSupplyCode),
      taxTypeOverride: override,
      invoiceDate,
      items
    }
  };
}

module.exports = { validateInvoicePayload, GSTIN_RE };
