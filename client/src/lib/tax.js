/**
 * Client-side PREVIEW ONLY.
 * This mirrors server/tax.js so the billing screen feels instant. The server
 * always recalculates and stores the authoritative amounts on save.
 */

export const rupeesToPaise = (value) => Math.round(Number(value) * 100);
export const quantityToMilli = (value) => Math.round(Number(value) * 1000);
export const paiseToRupees = (paise) => Number((Number(paise) / 100).toFixed(2));

export function determineTaxType({ homeStateCode, placeOfSupplyCode, taxMode = 'AUTO', override = null }) {
  const home = String(homeStateCode);
  const supply = String(placeOfSupplyCode);
  const autoType = supply === home ? 'INTRA' : 'INTER';
  let taxType = autoType;
  let reason;

  if (taxMode === 'FORCE_INTRA') {
    taxType = 'INTRA';
    reason = 'TAX_MODE is FORCE_INTRA: CGST + SGST is always applied.';
  } else if (taxMode === 'FORCE_INTER') {
    taxType = 'INTER';
    reason = 'TAX_MODE is FORCE_INTER: IGST is always applied.';
  } else if (supply === home) {
    reason = `Place of supply ${supply} is the home state ${home}: intra-state supply.`;
  } else {
    reason = `Place of supply ${supply} differs from home state ${home}: inter-state supply.`;
  }

  if (override === 'INTRA' || override === 'INTER') {
    taxType = override;
    reason = `Per-invoice override applied: ${taxType === 'INTRA' ? 'CGST + SGST' : 'IGST'}.`;
  }

  return { taxType, reason, autoType };
}

export function calculateLine({ basePricePaise, quantityMilli, gstRate, pricesIncludeGst, taxType }) {
  const rate = Number(gstRate) || 0;
  const grossPaise = Math.round((basePricePaise * quantityMilli) / 1000);

  let taxablePaise;
  let taxPaise;
  if (pricesIncludeGst) {
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

export function calculateInvoice({ lines = [], pricesIncludeGst = false, taxType = 'INTRA', rounding = 'NEAREST_RUPEE' }) {
  const totals = {
    taxablePaise: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    taxPaise: 0,
    totalBeforeRoundOffPaise: 0
  };

  const calculatedLines = lines.map((line) => {
    const result = calculateLine({ ...line, pricesIncludeGst, taxType });
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

export function numberToIndianWords(value) {
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

export function amountInWords(paise) {
  const safePaise = Math.max(0, Math.round(Number(paise) || 0));
  const rupees = Math.floor(safePaise / 100);
  const remainingPaise = safePaise % 100;
  let words = `Rupees ${numberToIndianWords(rupees)}`;
  if (remainingPaise > 0) words += ` and ${numberToIndianWords(remainingPaise)} Paise`;
  return `${words} Only`;
}

/** Build the preview from cart items, products and config. */
export function previewForCart({ cart, products, config, placeOfSupplyCode, override }) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const lines = cart.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) return null;
    return {
      productId: product.id,
      nameSnapshot: product.name,
      hsnSnapshot: product.hsn,
      unitSnapshot: product.unit,
      basePricePaise: product.basePricePaise,
      gstRate: product.gstRate,
      quantity: item.quantity,
      quantityMilli: quantityToMilli(item.quantity)
    };
  }).filter(Boolean);

  const taxDecision = determineTaxType({
    homeStateCode: config.homeStateCode,
    placeOfSupplyCode,
    taxMode: config.taxMode,
    override
  });

  const calculation = calculateInvoice({
    lines,
    pricesIncludeGst: config.pricesIncludeGst,
    taxType: taxDecision.taxType,
    rounding: config.rounding
  });

  return { ...calculation, taxDecision };
}
