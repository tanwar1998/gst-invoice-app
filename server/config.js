'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

function str(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function bool(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const sellerStateCode = str('SELLER_STATE_CODE', '09');

const config = {
  port: int('PORT', 4000),

  seller: {
    name: str('SELLER_NAME', '[Fill in: Business Name]'),
    address: str('SELLER_ADDRESS', '[Fill in: Full postal address]'),
    gstin: str('SELLER_GSTIN', ''),
    phone: str('SELLER_PHONE', ''),
    email: str('SELLER_EMAIL', ''),
    stateName: str('SELLER_STATE_NAME', '[Fill in: State Name]'),
    stateCode: sellerStateCode
  },

  homeStateCode: str('HOME_STATE_CODE', sellerStateCode),
  taxMode: str('TAX_MODE', 'AUTO').toUpperCase(),
  allowPerInvoiceOverride: bool('ALLOW_PER_INVOICE_OVERRIDE', true),
  defaultSaleChannel: str('DEFAULT_SALE_CHANNEL', 'OFFLINE').toUpperCase(),
  defaultPlaceOfSupply: str('DEFAULT_PLACE_OF_SUPPLY', '') || str('HOME_STATE_CODE', sellerStateCode),
  pricesIncludeGst: bool('PRICES_INCLUDE_GST', false),

  invoicePrefix: str('INVOICE_PREFIX', 'BILL'),
  financialYearFormat: str('FY_FORMAT', 'YYYY-YY'),
  rounding: str('ROUNDING', 'NEAREST_RUPEE').toUpperCase(),

  currency: str('CURRENCY', 'INR'),
  currencySymbol: str('CURRENCY_SYMBOL', '₹'),
  dateFormat: str('DATE_FORMAT', 'DD/MM/YYYY'),

  bank: {
    name: str('BANK_NAME', ''),
    accountNumber: str('BANK_ACCOUNT_NUMBER', ''),
    ifsc: str('BANK_IFSC', ''),
    branch: str('BANK_BRANCH', '')
  },

  terms: str('TERMS', 'Goods once sold will not be taken back. Subject to local jurisdiction.'),

  databaseFile: str('DATABASE_FILE', path.join(__dirname, 'data', 'invoice.db'))
};

const VALID_TAX_MODES = new Set(['AUTO', 'FORCE_INTRA', 'FORCE_INTER']);
if (!VALID_TAX_MODES.has(config.taxMode)) {
  throw new Error(`Invalid TAX_MODE "${config.taxMode}". Use AUTO, FORCE_INTRA or FORCE_INTER.`);
}
if (!['OFFLINE', 'ONLINE'].includes(config.defaultSaleChannel)) {
  throw new Error('DEFAULT_SALE_CHANNEL must be OFFLINE or ONLINE.');
}
if (!['NEAREST_RUPEE', 'NONE'].includes(config.rounding)) {
  throw new Error('ROUNDING must be NEAREST_RUPEE or NONE.');
}

// Everything the browser needs for labels, defaults and live preview.
// Never put secrets in here.
function publicConfig() {
  const { STATES } = require('./states');
  return {
    seller: config.seller,
    homeStateCode: config.homeStateCode,
    taxMode: config.taxMode,
    allowPerInvoiceOverride: config.allowPerInvoiceOverride,
    defaultSaleChannel: config.defaultSaleChannel,
    defaultPlaceOfSupply: config.defaultPlaceOfSupply,
    pricesIncludeGst: config.pricesIncludeGst,
    invoicePrefix: config.invoicePrefix,
    financialYearFormat: config.financialYearFormat,
    rounding: config.rounding,
    currency: config.currency,
    currencySymbol: config.currencySymbol,
    dateFormat: config.dateFormat,
    bank: config.bank,
    terms: config.terms,
    states: STATES
  };
}

module.exports = config;
module.exports.publicConfig = publicConfig;
