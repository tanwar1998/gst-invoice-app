'use strict';

/**
 * Pure tax helpers. All money is handled as INTEGER PAISE.
 * Quantities are handled as INTEGER MILLI-UNITS (quantity * 1000) so that
 * values such as 2.5 kg can be multiplied without floating point drift.
 */

function rupeesToPaise(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Invalid rupee value');
  return Math.round(n * 100);
}

function quantityToMilli(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Invalid quantity');
  return Math.round(n * 1000);
}

function paiseToRupees(paise) {
  return Number((Number(paise) / 100).toFixed(2));
}

function milliToQuantity(milli) {
  return Number((Number(milli) / 1000).toFixed(3));
}

function getFinancialYear(date = new Date(), format = 'YYYY-YY') {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid invoice date');
  const month = d.getMonth() + 1;
  const startYear = month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  const endYear = startYear + 1;

  switch (format) {
    case 'YYYY-YYYY':
      return `${startYear}-${endYear}`;
    case 'YY-YY':
      return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
    case 'YYYY-YY':
    default:
      return `${startYear}-${String(endYear).slice(-2)}`;
  }
}

function formatInvoiceNumber({ fy, sequence, prefix = '' }) {
  const seq = String(sequence).padStart(4, '0');
  const cleanPrefix = String(prefix || '').trim().replace(/\/+$/, '');
  return cleanPrefix ? `${cleanPrefix}/${fy}/${seq}` : `${fy}/${seq}`;
}

/**
 * Decide whether the invoice is INTRA (CGST+SGST) or INTER (IGST).
 * A per-invoice override, when explicitly allowed, wins over TAX_MODE.
 */
function determineTaxType({ homeStateCode, placeOfSupplyCode, taxMode = 'AUTO', override = null }) {
  const home = String(homeStateCode);
  const supply = String(placeOfSupplyCode);
  const isWithinHomeState = supply === home;
  const autoType = isWithinHomeState ? 'INTRA' : 'INTER';

  let taxType = autoType;
  let reason;

  if (taxMode === 'FORCE_INTRA') {
    taxType = 'INTRA';
    reason = 'TAX_MODE is FORCE_INTRA: CGST + SGST is always applied.';
  } else if (taxMode === 'FORCE_INTER') {
    taxType = 'INTER';
    reason = 'TAX_MODE is FORCE_INTER: IGST is always applied.';
  } else if (isWithinHomeState) {
    reason = `Place of supply ${supply} is the home state ${home}: intra-state supply.`;
  } else {
    reason = `Place of supply ${supply} differs from home state ${home}: inter-state supply.`;
  }

  if (override === 'INTRA' || override === 'INTER') {
    taxType = override;
    reason = `Per-invoice override applied: ${taxType === 'INTRA' ? 'CGST + SGST' : 'IGST'}.`;
  }

  return { taxType, reason, autoType, isWithinHomeState };
}

/**
 * Compute one line. `basePricePaise` and `quantityMilli` must be integers.
 */
function calculateLine({ basePricePaise, quantityMilli, gstRate, pricesIncludeGst, taxType }) {
  const rate = Number(gstRate) || 0;
  const grossPaise = Math.round((basePricePaise * quantityMilli) / 1000);

  let taxablePaise;
  let taxPaise;

  if (pricesIncludeGst) {
    // Back out the tax from a tax-inclusive price.
    taxablePaise = Math.round((grossPaise * 100) / (100 + rate));
    taxPaise = grossPaise - taxablePaise;
  } else {
    taxablePaise = grossPaise;
    taxPaise = Math.round((taxablePaise * rate) / 100);
  }

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (taxType === 'INTER') {
    igstPaise = taxPaise;
  } else {
    cgstPaise = Math.round(taxPaise / 2);
    // Keep the split exact even when total tax paise is odd.
    sgstPaise = taxPaise - cgstPaise;
  }

  return {
    grossPaise,
    taxablePaise,
    taxPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    lineTotalPaise: taxablePaise + taxPaise
  };
}

function calculateInvoice({ lines = [], pricesIncludeGst = false, taxType = 'INTRA', rounding = 'NEAREST_RUPEE' }) {
  const totals = {
    taxablePaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    taxPaise: 0,
    totalBeforeRoundOffPaise: 0
  };

  const calculatedLines = lines.map((line) => {
    const result = calculateLine({
      basePricePaise: line.basePricePaise,
      quantityMilli: line.quantityMilli,
      gstRate: line.gstRate,
      pricesIncludeGst,
      taxType
    });

    totals.taxablePaise += result.taxablePaise;
    totals.cgstPaise += result.cgstPaise;
    totals.sgstPaise += result.sgstPaise;
    totals.igstPaise += result.igstPaise;
    totals.taxPaise += result.taxPaise;

    return { ...line, ...result };
  });

  totals.totalBeforeRoundOffPaise =
    totals.taxablePaise + totals.cgstPaise + totals.sgstPaise + totals.igstPaise;

  let grandTotalPaise = totals.totalBeforeRoundOffPaise;
  let roundOffPaise = 0;
  if (rounding === 'NEAREST_RUPEE') {
    grandTotalPaise = Math.round(totals.totalBeforeRoundOffPaise / 100) * 100;
    roundOffPaise = grandTotalPaise - totals.totalBeforeRoundOffPaise;
  }

  return { lines: calculatedLines, totals, grandTotalPaise, roundOffPaise };
}

/* ---------------------------- Amount in words ---------------------------- */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n) {
  const words = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) words.push(`${ONES[hundreds]} Hundred`);
  if (remainder > 0) {
    if (remainder < 20) {
      words.push(ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      words.push(ones > 0 ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens]);
    }
  }
  return words.join(' ');
}

function numberToIndianWords(value) {
  let n = Math.floor(Math.abs(Number(value)));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'Zero';

  const words = [];
  const crores = Math.floor(n / 10000000);
  n %= 10000000;
  const lakhs = Math.floor(n / 100000);
  n %= 100000;
  const thousands = Math.floor(n / 1000);
  n %= 1000;

  if (crores > 0) words.push(`${numberToIndianWords(crores)} Crore`);
  if (lakhs > 0) words.push(`${numberToIndianWords(lakhs)} Lakh`);
  if (thousands > 0) words.push(`${numberToIndianWords(thousands)} Thousand`);
  if (n > 0) words.push(belowThousand(n));

  return words.join(' ');
}

function amountInWords(paise) {
  const safePaise = Math.max(0, Math.round(Number(paise) || 0));
  const rupees = Math.floor(safePaise / 100);
  const remainingPaise = safePaise % 100;

  let words = `Rupees ${numberToIndianWords(rupees)}`;
  if (remainingPaise > 0) words += ` and ${numberToIndianWords(remainingPaise)} Paise`;
  return `${words} Only`;
}

module.exports = {
  rupeesToPaise,
  quantityToMilli,
  paiseToRupees,
  milliToQuantity,
  getFinancialYear,
  formatInvoiceNumber,
  determineTaxType,
  calculateLine,
  calculateInvoice,
  numberToIndianWords,
  amountInWords
};
