'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateLine,
  calculateInvoice,
  determineTaxType,
  getFinancialYear,
  formatInvoiceNumber,
  amountInWords,
  rupeesToPaise,
  quantityToMilli
} = require('../tax');

test('intra-state exclusive pricing splits GST equally into CGST and SGST', () => {
  const line = calculateLine({
    basePricePaise: 10000,
    quantityMilli: 1000,
    gstRate: 12,
    pricesIncludeGst: false,
    taxType: 'INTRA'
  });

  assert.equal(line.taxablePaise, 10000);
  assert.equal(line.taxPaise, 1200);
  assert.equal(line.cgstPaise, 600);
  assert.equal(line.sgstPaise, 600);
  assert.equal(line.igstPaise, 0);
  assert.equal(line.lineTotalPaise, 11200);
});

test('inter-state exclusive pricing uses IGST only', () => {
  const line = calculateLine({
    basePricePaise: 10000,
    quantityMilli: 1000,
    gstRate: 12,
    pricesIncludeGst: false,
    taxType: 'INTER'
  });

  assert.equal(line.taxablePaise, 10000);
  assert.equal(line.cgstPaise, 0);
  assert.equal(line.sgstPaise, 0);
  assert.equal(line.igstPaise, 1200);
  assert.equal(line.lineTotalPaise, 11200);
});

test('intra-state inclusive pricing backs out tax from the gross price', () => {
  const line = calculateLine({
    basePricePaise: 11200,
    quantityMilli: 1000,
    gstRate: 12,
    pricesIncludeGst: true,
    taxType: 'INTRA'
  });

  assert.equal(line.grossPaise, 11200);
  assert.equal(line.taxablePaise, 10000);
  assert.equal(line.taxPaise, 1200);
  assert.equal(line.cgstPaise, 600);
  assert.equal(line.sgstPaise, 600);
  assert.equal(line.lineTotalPaise, 11200);
});

test('inter-state inclusive pricing backs out IGST from the gross price', () => {
  const line = calculateLine({
    basePricePaise: 11200,
    quantityMilli: 1000,
    gstRate: 12,
    pricesIncludeGst: true,
    taxType: 'INTER'
  });

  assert.equal(line.taxablePaise, 10000);
  assert.equal(line.igstPaise, 1200);
  assert.equal(line.cgstPaise, 0);
  assert.equal(line.sgstPaise, 0);
});

test('decimal quantities are multiplied with integer paise without drift', () => {
  const line = calculateLine({
    basePricePaise: rupeesToPaise(45.5),
    quantityMilli: quantityToMilli(2.5),
    gstRate: 5,
    pricesIncludeGst: false,
    taxType: 'INTRA'
  });

  assert.equal(line.grossPaise, 11375);
  assert.equal(line.taxablePaise, 11375);
  assert.equal(line.taxPaise, 569);
  // Odd paise must still split exactly: 285 + 284 = 569
  assert.equal(line.cgstPaise + line.sgstPaise, line.taxPaise);
  assert.equal(line.lineTotalPaise, 11944);
});

test('round off to the nearest rupee can be negative or positive', () => {
  const base = {
    lines: [{ basePricePaise: 12345, quantityMilli: 1000, gstRate: 0 }],
    pricesIncludeGst: false,
    taxType: 'INTRA',
    rounding: 'NEAREST_RUPEE'
  };

  const down = calculateInvoice(base);
  assert.equal(down.totals.totalBeforeRoundOffPaise, 12345);
  assert.equal(down.grandTotalPaise, 12300);
  assert.equal(down.roundOffPaise, -45);

  const up = calculateInvoice({
    ...base,
    lines: [{ basePricePaise: 12360, quantityMilli: 1000, gstRate: 0 }]
  });
  assert.equal(up.grandTotalPaise, 12400);
  assert.equal(up.roundOffPaise, 40);

  const none = calculateInvoice({ ...base, rounding: 'NONE' });
  assert.equal(none.grandTotalPaise, 12345);
  assert.equal(none.roundOffPaise, 0);
});

test('invoice totals aggregate multiple lines correctly', () => {
  const result = calculateInvoice({
    lines: [
      { productId: 'aata', basePricePaise: 10000, quantityMilli: 1000, gstRate: 12 },
      { productId: 'oil', basePricePaise: 5000, quantityMilli: 2000, gstRate: 12 }
    ],
    pricesIncludeGst: false,
    taxType: 'INTER',
    rounding: 'NEAREST_RUPEE'
  });

  assert.equal(result.totals.taxablePaise, 20000);
  assert.equal(result.totals.igstPaise, 2400);
  assert.equal(result.totals.totalBeforeRoundOffPaise, 22400);
  assert.equal(result.grandTotalPaise, 22400);
  assert.equal(result.roundOffPaise, 0);
});

test('financial year rolls over on 1 April', () => {
  assert.equal(getFinancialYear(new Date('2026-03-31T00:00:00'), 'YYYY-YY'), '2025-26');
  assert.equal(getFinancialYear(new Date('2026-04-01T00:00:00'), 'YYYY-YY'), '2026-27');
  assert.equal(getFinancialYear('2027-01-15', 'YYYY-YYYY'), '2026-2027');
});

test('invoice numbers are formatted with zero padding and prefix', () => {
  assert.equal(formatInvoiceNumber({ fy: '2026-27', sequence: 1 }), '2026-27/0001');
  assert.equal(
    formatInvoiceNumber({ fy: '2026-27', sequence: 42, prefix: 'BILL' }),
    'BILL/2026-27/0042'
  );
});

test('tax type honours AUTO, FORCE modes and per-invoice override', () => {
  const base = { homeStateCode: '09', placeOfSupplyCode: '09', taxMode: 'AUTO' };

  assert.equal(determineTaxType(base).taxType, 'INTRA');
  assert.equal(determineTaxType({ ...base, placeOfSupplyCode: '27' }).taxType, 'INTER');
  assert.equal(determineTaxType({ ...base, taxMode: 'FORCE_INTER' }).taxType, 'INTER');
  assert.equal(
    determineTaxType({ ...base, placeOfSupplyCode: '27', taxMode: 'FORCE_INTRA' }).taxType,
    'INTRA'
  );
  assert.equal(
    determineTaxType({ ...base, placeOfSupplyCode: '27', override: 'INTRA' }).taxType,
    'INTRA'
  );
});

test('amount in words uses Indian numbering', () => {
  assert.equal(amountInWords(120000), 'Rupees One Thousand Two Hundred Only');
  assert.equal(
    amountInWords(12340000),
    'Rupees One Lakh Twenty Three Thousand Four Hundred Only'
  );
  assert.equal(
    amountInWords(1000000000),
    'Rupees One Crore Only'
  );
  assert.equal(
    amountInWords(123450),
    'Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only'
  );
});
