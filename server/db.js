'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');
const { rupeesToPaise } = require('./tax');

const dbFile = path.isAbsolute(config.databaseFile)
  ? config.databaseFile
  : path.join(__dirname, config.databaseFile);

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    hsn             TEXT NOT NULL DEFAULT '',
    unit            TEXT NOT NULL DEFAULT 'kg',
    base_price_paise INTEGER NOT NULL,
    gst_rate        REAL NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sequences (
    fy         TEXT PRIMARY KEY,
    next_value INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number         TEXT NOT NULL UNIQUE,
    invoice_date           TEXT NOT NULL,
    customer_name          TEXT NOT NULL,
    customer_phone         TEXT NOT NULL DEFAULT '',
    customer_address       TEXT NOT NULL DEFAULT '',
    customer_gstin         TEXT NOT NULL DEFAULT '',
    sale_channel           TEXT NOT NULL,
    place_of_supply_code   TEXT NOT NULL,
    place_of_supply_name   TEXT NOT NULL,
    tax_type               TEXT NOT NULL,
    tax_type_reason        TEXT NOT NULL DEFAULT '',
    tax_mode_used          TEXT NOT NULL DEFAULT 'AUTO',
    prices_include_gst     INTEGER NOT NULL DEFAULT 0,
    taxable_paise          INTEGER NOT NULL DEFAULT 0,
    cgst_paise             INTEGER NOT NULL DEFAULT 0,
    sgst_paise             INTEGER NOT NULL DEFAULT 0,
    igst_paise             INTEGER NOT NULL DEFAULT 0,
    round_off_paise        INTEGER NOT NULL DEFAULT 0,
    grand_total_paise      INTEGER NOT NULL DEFAULT 0,
    amount_in_words        TEXT NOT NULL DEFAULT '',
    seller_snapshot        TEXT NOT NULL DEFAULT '{}',
    bank_snapshot          TEXT NOT NULL DEFAULT '{}',
    terms_snapshot         TEXT NOT NULL DEFAULT '',
    cancelled              INTEGER NOT NULL DEFAULT 0,
    cancelled_at           TEXT,
    created_at             TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_lines (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id        INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id        TEXT NOT NULL DEFAULT '',
    name_snapshot     TEXT NOT NULL,
    hsn_snapshot      TEXT NOT NULL DEFAULT '',
    unit_snapshot     TEXT NOT NULL DEFAULT 'kg',
    base_price_paise  INTEGER NOT NULL,
    gst_rate          REAL NOT NULL,
    quantity_milli    INTEGER NOT NULL,
    taxable_paise     INTEGER NOT NULL,
    cgst_paise        INTEGER NOT NULL,
    sgst_paise        INTEGER NOT NULL,
    igst_paise        INTEGER NOT NULL,
    line_total_paise  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
  CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
  CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_name);
  CREATE INDEX IF NOT EXISTS idx_lines_invoice ON invoice_lines(invoice_id);
`);

/** Load products.json into the database on every start (edit JSON, restart server). */
function syncProducts() {
  const productFile = path.join(__dirname, 'products.json');
  const products = JSON.parse(fs.readFileSync(productFile, 'utf8'));
  const upsert = db.prepare(`
    INSERT INTO products (id, name, hsn, unit, base_price_paise, gst_rate, active)
    VALUES (@id, @name, @hsn, @unit, @basePricePaise, @gstRate, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      hsn = excluded.hsn,
      unit = excluded.unit,
      base_price_paise = excluded.base_price_paise,
      gst_rate = excluded.gst_rate,
      active = 1
  `);

  const run = db.transaction((rows) => {
    for (const p of rows) {
      upsert.run({
        id: String(p.id),
        name: String(p.name),
        hsn: String(p.hsn || ''),
        unit: String(p.unit || 'kg'),
        basePricePaise: rupeesToPaise(p.basePrice),
        gstRate: Number(p.gstRate) || 0
      });
    }
  });

  run(products);
  return products.length;
}

syncProducts();

function listProducts() {
  return db
    .prepare('SELECT * FROM products WHERE active = 1 ORDER BY name')
    .all()
    .map((p) => ({
      id: p.id,
      name: p.name,
      hsn: p.hsn,
      unit: p.unit,
      basePricePaise: p.base_price_paise,
      basePrice: Number((p.base_price_paise / 100).toFixed(2)),
      gstRate: p.gst_rate
    }));
}

/** Reserve the next sequence number for a financial year. Call inside a transaction. */
function nextSequence(fy) {
  db.prepare('INSERT OR IGNORE INTO sequences (fy, next_value) VALUES (?, 1)').run(fy);
  const row = db.prepare('SELECT next_value FROM sequences WHERE fy = ?').get(fy);
  db.prepare('UPDATE sequences SET next_value = next_value + 1 WHERE fy = ?').run(fy);
  return row.next_value;
}

module.exports = db;
module.exports.listProducts = listProducts;
module.exports.nextSequence = nextSequence;
