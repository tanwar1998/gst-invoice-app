'use strict';

const express = require('express');
const db = require('../db');
const config = require('../config');
const { STATES } = require('../states');
const { validateInvoicePayload } = require('../validation');
const {
  getFinancialYear,
  formatInvoiceNumber,
  determineTaxType,
  calculateInvoice,
  amountInWords,
  paiseToRupees,
  milliToQuantity
} = require('../tax');

const router = express.Router();

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function serializeLine(line) {
  return {
    id: line.id,
    productId: line.product_id,
    name: line.name_snapshot,
    hsn: line.hsn_snapshot,
    unit: line.unit_snapshot,
    quantity: milliToQuantity(line.quantity_milli),
    basePricePaise: line.base_price_paise,
    basePrice: paiseToRupees(line.base_price_paise),
    gstRate: line.gst_rate,
    taxablePaise: line.taxable_paise,
    cgstPaise: line.cgst_paise,
    sgstPaise: line.sgst_paise,
    igstPaise: line.igst_paise,
    lineTotalPaise: line.line_total_paise,
    taxable: paiseToRupees(line.taxable_paise),
    cgst: paiseToRupees(line.cgst_paise),
    sgst: paiseToRupees(line.sgst_paise),
    igst: paiseToRupees(line.igst_paise),
    lineTotal: paiseToRupees(line.line_total_paise)
  };
}

function serializeInvoice(row, lines) {
  const money = {
    taxablePaise: row.taxable_paise,
    cgstPaise: row.cgst_paise,
    sgstPaise: row.sgst_paise,
    igstPaise: row.igst_paise,
    roundOffPaise: row.round_off_paise,
    grandTotalPaise: row.grand_total_paise,
    taxable: paiseToRupees(row.taxable_paise),
    cgst: paiseToRupees(row.cgst_paise),
    sgst: paiseToRupees(row.sgst_paise),
    igst: paiseToRupees(row.igst_paise),
    roundOff: paiseToRupees(row.round_off_paise),
    grandTotal: paiseToRupees(row.grand_total_paise)
  };

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_address,
      gstin: row.customer_gstin
    },
    saleChannel: row.sale_channel,
    placeOfSupply: { code: row.place_of_supply_code, name: row.place_of_supply_name },
    taxType: row.tax_type,
    taxTypeReason: row.tax_type_reason,
    taxModeUsed: row.tax_mode_used,
    pricesIncludeGst: Boolean(row.prices_include_gst),
    seller: safeJson(row.seller_snapshot, config.seller),
    bank: safeJson(row.bank_snapshot, config.bank),
    terms: row.terms_snapshot,
    lines: lines.map(serializeLine),
    totals: money,
    amountInWords: row.amount_in_words,
    cancelled: Boolean(row.cancelled),
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at
  };
}

function getInvoice(id) {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!row) return null;
  const lines = db
    .prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id')
    .all(id);
  return serializeInvoice(row, lines);
}

function listInvoices(query = {}) {
  const where = [];
  const params = {};

  if (query.q) {
    const term = `%${String(query.q).trim()}%`;
    where.push('(invoice_number LIKE @q OR customer_name LIKE @q OR customer_phone LIKE @q OR customer_gstin LIKE @q)');
    params.q = term;
  }
  if (query.from) {
    where.push('invoice_date >= @from');
    params.from = String(query.from);
  }
  if (query.to) {
    where.push('invoice_date <= @to');
    params.to = String(query.to);
  }
  if (query.channel && ['ONLINE', 'OFFLINE'].includes(String(query.channel))) {
    where.push('sale_channel = @channel');
    params.channel = String(query.channel);
  }
  if (query.includeCancelled !== 'true' && query.includeCancelled !== true) {
    where.push('cancelled = 0');
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 2000);

  return db
    .prepare(`SELECT * FROM invoices ${clause} ORDER BY invoice_date DESC, id DESC LIMIT @limit`)
    .all({ ...params, limit })
    .map((row) => {
      const invoice = serializeInvoice(row, []);
      delete invoice.lines;
      return invoice;
    });
}

/* ------------------------------- Endpoints ------------------------------- */

router.get('/config', (_req, res) => {
  res.json(config.publicConfig());
});

router.get('/products', (_req, res) => {
  res.json(db.listProducts());
});

router.post('/invoices', (req, res) => {
  const products = db.listProducts();
  const { errors, value } = validateInvoicePayload(req.body, { products, config });
  if (errors.length) return res.status(400).json({ errors });

  try {
    const created = db.transaction(() => {
      const fy = getFinancialYear(value.invoiceDate, config.financialYearFormat);
      const sequence = db.nextSequence(fy);
      const invoiceNumber = formatInvoiceNumber({
        fy,
        sequence,
        prefix: config.invoicePrefix
      });

      const taxDecision = determineTaxType({
        homeStateCode: config.homeStateCode,
        placeOfSupplyCode: value.placeOfSupplyCode,
        taxMode: config.taxMode,
        override: value.taxTypeOverride
      });

      const calculation = calculateInvoice({
        lines: value.items,
        pricesIncludeGst: config.pricesIncludeGst,
        taxType: taxDecision.taxType,
        rounding: config.rounding
      });

      const result = db.prepare(`
        INSERT INTO invoices (
          invoice_number, invoice_date, customer_name, customer_phone, customer_address,
          customer_gstin, sale_channel, place_of_supply_code, place_of_supply_name,
          tax_type, tax_type_reason, tax_mode_used, prices_include_gst,
          taxable_paise, cgst_paise, sgst_paise, igst_paise, round_off_paise,
          grand_total_paise, amount_in_words, seller_snapshot, bank_snapshot,
          terms_snapshot, cancelled, created_at
        ) VALUES (
          @invoiceNumber, @invoiceDate, @customerName, @customerPhone, @customerAddress,
          @customerGstin, @saleChannel, @placeOfSupplyCode, @placeOfSupplyName,
          @taxType, @taxTypeReason, @taxModeUsed, @pricesIncludeGst,
          @taxablePaise, @cgstPaise, @sgstPaise, @igstPaise, @roundOffPaise,
          @grandTotalPaise, @amountInWords, @sellerSnapshot, @bankSnapshot,
          @termsSnapshot, 0, @createdAt
        )
      `).run({
        invoiceNumber,
        invoiceDate: value.invoiceDate,
        customerName: value.customer.name,
        customerPhone: value.customer.phone,
        customerAddress: value.customer.address,
        customerGstin: value.customer.gstin,
        saleChannel: value.saleChannel,
        placeOfSupplyCode: value.placeOfSupplyCode,
        placeOfSupplyName: value.placeOfSupplyName,
        taxType: taxDecision.taxType,
        taxTypeReason: taxDecision.reason,
        taxModeUsed: value.taxTypeOverride ? 'OVERRIDE' : config.taxMode,
        pricesIncludeGst: config.pricesIncludeGst ? 1 : 0,
        taxablePaise: calculation.totals.taxablePaise,
        cgstPaise: calculation.totals.cgstPaise,
        sgstPaise: calculation.totals.sgstPaise,
        igstPaise: calculation.totals.igstPaise,
        roundOffPaise: calculation.roundOffPaise,
        grandTotalPaise: calculation.grandTotalPaise,
        amountInWords: amountInWords(calculation.grandTotalPaise),
        sellerSnapshot: JSON.stringify(config.seller),
        bankSnapshot: JSON.stringify(config.bank),
        termsSnapshot: config.terms,
        createdAt: new Date().toISOString()
      });

      const invoiceId = Number(result.lastInsertRowid);
      const insertLine = db.prepare(`
        INSERT INTO invoice_lines (
          invoice_id, product_id, name_snapshot, hsn_snapshot, unit_snapshot,
          base_price_paise, gst_rate, quantity_milli, taxable_paise,
          cgst_paise, sgst_paise, igst_paise, line_total_paise
        ) VALUES (
          @invoiceId, @productId, @nameSnapshot, @hsnSnapshot, @unitSnapshot,
          @basePricePaise, @gstRate, @quantityMilli, @taxablePaise,
          @cgstPaise, @sgstPaise, @igstPaise, @lineTotalPaise
        )
      `);

      calculation.lines.forEach((line) => {
        insertLine.run({
          invoiceId,
          productId: line.productId,
          nameSnapshot: line.nameSnapshot,
          hsnSnapshot: line.hsnSnapshot,
          unitSnapshot: line.unitSnapshot,
          basePricePaise: line.basePricePaise,
          gstRate: line.gstRate,
          quantityMilli: line.quantityMilli,
          taxablePaise: line.taxablePaise,
          cgstPaise: line.cgstPaise,
          sgstPaise: line.sgstPaise,
          igstPaise: line.igstPaise,
          lineTotalPaise: line.lineTotalPaise
        });
      });

      return getInvoice(invoiceId);
    })();

    res.status(201).json(created);
  } catch (error) {
    console.error('Failed to save invoice:', error);
    res.status(500).json({ error: 'Could not save the invoice. Please try again.' });
  }
});

router.get('/invoices/export.csv', (req, res) => {
  const invoices = listInvoices({ ...req.query, limit: 2000 });
  const idList = invoices.map((inv) => inv.id);
  const lineMap = new Map();

  if (idList.length) {
    const placeholders = idList.map(() => '?').join(',');
    const lines = db
      .prepare(`SELECT * FROM invoice_lines WHERE invoice_id IN (${placeholders}) ORDER BY invoice_id, id`)
      .all(...idList);
    lines.forEach((line) => {
      if (!lineMap.has(line.invoice_id)) lineMap.set(line.invoice_id, []);
      lineMap.get(line.invoice_id).push(line);
    });
  }

  const csvCell = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = [
    'Invoice Number', 'Invoice Date', 'Customer Name', 'Customer GSTIN', 'Sale Channel',
    'Place of Supply Code', 'Place of Supply', 'Tax Type', 'HSN', 'Description', 'Unit',
    'Quantity', 'Rate per Unit', 'Taxable Value', 'CGST Rate %', 'CGST Amount',
    'SGST Rate %', 'SGST Amount', 'IGST Rate %', 'IGST Amount', 'Line Total',
    'Invoice Grand Total', 'Cancelled'
  ];

  const rows = [header];
  invoices.forEach((invoice) => {
    const lines = lineMap.get(invoice.id) || [];
    lines.forEach((line) => {
      const rate = paiseToRupees(line.base_price_paise);
      const halfRate = line.gst_rate / 2;
      const intra = invoice.taxType === 'INTRA';
      rows.push([
        invoice.invoiceNumber,
        invoice.invoiceDate,
        invoice.customer.name,
        invoice.customer.gstin,
        invoice.saleChannel,
        invoice.placeOfSupply.code,
        invoice.placeOfSupply.name,
        invoice.taxType,
        line.hsn_snapshot,
        line.name_snapshot,
        line.unit_snapshot,
        milliToQuantity(line.quantity_milli),
        rate.toFixed(2),
        paiseToRupees(line.taxable_paise).toFixed(2),
        intra ? halfRate : '',
        intra ? paiseToRupees(line.cgst_paise).toFixed(2) : '',
        intra ? halfRate : '',
        intra ? paiseToRupees(line.sgst_paise).toFixed(2) : '',
        intra ? '' : line.gst_rate,
        intra ? '' : paiseToRupees(line.igst_paise).toFixed(2),
        paiseToRupees(line.line_total_paise).toFixed(2),
        invoice.totals.grandTotal.toFixed(2),
        invoice.cancelled ? 'YES' : 'NO'
      ]);
    });
  });

  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gst-invoices.csv"');
  res.send(csv);
});

router.get('/invoices', (req, res) => {
  res.json(listInvoices(req.query));
});

router.get('/invoices/:id', (req, res) => {
  const invoice = getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
  res.json(invoice);
});

router.post('/invoices/:id/cancel', (req, res) => {
  try {
    const existing = db.prepare('SELECT cancelled FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found.' });
    if (existing.cancelled) return res.status(400).json({ error: 'Invoice is already cancelled.' });

    db.prepare('UPDATE invoices SET cancelled = 1, cancelled_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      req.params.id
    );
    res.json(getInvoice(req.params.id));
  } catch (error) {
    console.error('Failed to cancel invoice:', error);
    res.status(500).json({ error: 'Could not cancel the invoice.' });
  }
});

router.get('/states', (_req, res) => {
  res.json(STATES);
});

module.exports = router;
module.exports.getInvoice = getInvoice;
