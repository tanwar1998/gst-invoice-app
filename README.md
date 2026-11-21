# GST Tax Invoice App

A fast, mobile-friendly GST billing tool for a small flour mill / grocery business with a fixed product list, walk-in (offline) customers and online customers who may be in other states.

- **Frontend:** React (Vite) + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite via `better-sqlite3`

---

## Quick start

Requirements: Node.js 20+ (Node 24 works).

```bash
cd gst-invoice-app
npm install          # also installs server/ and client/ dependencies (root postinstall)
npm run dev          # starts API on :4000 and Vite on :5173 together
```

Open **http://localhost:5173**.

Other scripts:

```bash
npm test             # tax calculation unit tests
npm run build        # production build of the React app into client/dist
npm start            # build + serve the built app and API from Express on :4000
```

Before real use, copy `.env.example` to `.env` and fill in seller details, GSTIN, bank details and terms.

```bash
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
```

Restart the server after changing `.env`, `server/products.json` or `server/config.js`.

---

## Folder structure

```
gst-invoice-app/
├── package.json                 # root scripts (starts client + server together)
├── .env.example                 # sample configuration
├── README.md
├── server/
│   ├── config.js                # all global configuration; reads .env
│   ├── products.json            # editable fixed product catalogue
│   ├── states.js                # Indian states + GST state codes
│   ├── tax.js                   # PURE tax logic (integer paise), words, FY helpers
│   ├── db.js                    # SQLite schema, product sync, invoice numbering
│   ├── validation.js            # server-side input validation
│   ├── routes/api.js            # all /api endpoints + CSV export
│   ├── app.js                   # Express app (also serves client/dist in prod)
│   ├── index.js                 # server entry point
│   ├── tests/tax.test.js        # unit tests
│   └── data/invoice.db          # created at runtime (gitignored)
└── client/
    ├── vite.config.js           # /api proxy -> http://localhost:4000
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css            # Tailwind + A4 print styles
        ├── api.js
        ├── lib/
        │   ├── tax.js           # preview-only mirror of server/tax.js
        │   ├── format.js
        │   └── validation.js
        └── components/
            ├── BillingScreen.jsx
            ├── ProductGrid.jsx
            ├── Cart.jsx
            ├── CustomerSection.jsx
            ├── TaxIndicator.jsx
            ├── TotalsPanel.jsx
            ├── InvoiceHistory.jsx
            └── InvoiceDocument.jsx
```

---

## Configuration

Everything lives in `server/config.js` and can be overridden from `.env`:

| Setting | Default | Meaning |
| --- | --- | --- |
| `SELLER_NAME`, `SELLER_ADDRESS`, `SELLER_GSTIN`, `SELLER_PHONE`, `SELLER_EMAIL`, `SELLER_STATE_NAME`, `SELLER_STATE_CODE` | placeholders | Printed on the invoice. **Fill these in.** |
| `HOME_STATE_CODE` | `09` | Compared with place of supply in `AUTO` mode |
| `TAX_MODE` | `AUTO` | `AUTO` = compare states; `FORCE_INTRA` = always CGST+SGST; `FORCE_INTER` = always IGST |
| `ALLOW_PER_INVOICE_OVERRIDE` | `true` | Shows the per-invoice tax override switch |
| `DEFAULT_SALE_CHANNEL` | `OFFLINE` | `OFFLINE` or `ONLINE` |
| `DEFAULT_PLACE_OF_SUPPLY` | home state | Defaults to home state; online users pick the delivery state |
| `PRICES_INCLUDE_GST` | `false` | `true` = catalogue prices are tax-inclusive; `false` = tax-exclusive |
| `INVOICE_PREFIX` | `BILL` | Numbers like `BILL/2026-27/0001` |
| `FY_FORMAT` | `YYYY-YY` | `YYYY-YY`, `YY-YY` or `YYYY-YYYY` |
| `ROUNDING` | `NEAREST_RUPEE` | Round the grand total to the nearest rupee and print the round-off line; use `NONE` to disable |
| `CURRENCY`, `CURRENCY_SYMBOL`, `DATE_FORMAT` | `INR`, `₹`, `DD/MM/YYYY` | Display only |
| `BANK_*`, `TERMS` | empty | Printed on the invoice |

The same values are returned by `GET /api/config` so the browser can label and preview correctly.

### Products

Edit `server/products.json` and restart the server. Each entry:

```json
{
  "id": "aata",
  "name": "Aata",
  "hsn": "110100",
  "unit": "kg",
  "basePrice": 42.00,
  "gstRate": 5
}
```

HSN codes and GST rates are **placeholders** — correct them for your business. Tax rates are never hardcoded in logic; they always come from the product snapshot. On start, products are upserted into SQLite.

---

## How tax is calculated

- All money is stored and calculated as **integer paise**; quantities are stored as integer milli-units so decimal weights such as `2.5 kg` stay exact and no floating-point drift reaches the database.
- **Intra-state** (`CGST + SGST`): total GST is split into two halves. If the paise amount is odd, one side gets the extra paisa so the split is always exact.
- **Inter-state** (`IGST`): the full GST rate is applied as IGST.
- **Tax-exclusive prices:** `taxable = price × qty`, `tax = round(taxable × rate / 100)`.
- **Tax-inclusive prices:** `taxable = round(gross × 100 / (100 + rate))`, `tax = gross - taxable`.
- **Round off:** grand total is rounded to the nearest rupee; the difference is stored as the round-off line (shown with a sign).
- The browser shows a **preview only**. The server recalculates everything from saved prices/rates on `POST /api/invoices`, inside a transaction.

### Invoice numbering and immutability

- Numbers are generated server-side from a per-financial-year sequence table inside a DB transaction, so they are unique, sequential, never reused, and reset each 1 April.
- Each invoice line stores a **snapshot** of name, HSN, unit, price and GST rate. Seller, bank and terms are snapshotted on the invoice too. Changing config or products later never changes an old invoice.
- Saved invoices cannot be edited. Corrections are done by **Cancel** (sets a cancelled flag and timestamp) + a new invoice.

---

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/config` | Public config + state list |
| `GET` | `/api/products` | Active products |
| `POST` | `/api/invoices` | Validate, calculate and save an invoice; returns the saved invoice |
| `GET` | `/api/invoices` | Search/filter: `q`, `from`, `to`, `channel`, `includeCancelled`, `limit` |
| `GET` | `/api/invoices/:id` | Full invoice with lines |
| `POST` | `/api/invoices/:id/cancel` | Cancel an invoice |
| `GET` | `/api/invoices/export.csv` | Line-level CSV for filing (same filters as list) |
| `GET` | `/api/states` | State code list |

Example create payload:

```json
{
  "customer": { "name": "Ramesh Kumar", "phone": "9876543210", "address": "Lucknow", "gstin": "" },
  "saleChannel": "OFFLINE",
  "placeOfSupplyCode": "09",
  "invoiceDate": "2026-11-21",
  "taxTypeOverride": null,
  "items": [
    { "productId": "aata", "quantity": 2.5 },
    { "productId": "oil", "quantity": 1 }
  ]
}
```

---

## Printing / PDF

`Save & Print / PDF` saves the invoice and opens an A4 print view. Use your browser's print dialog and choose **Save as PDF** to download a PDF. History → **Reprint** does the same for an existing invoice. The print stylesheet hides the app UI and prints only the invoice: seller, GSTIN, "TAX INVOICE", number/date, buyer, place of supply, item table with HSN/qty/rate/taxable/CGST-SGST-or-IGST/total, tax summary, amount in words, bank details, terms and a signature block.

---

## Tests

```bash
npm test
```

Covers intra-state, inter-state, tax-inclusive vs tax-exclusive pricing, decimal quantities, odd-paise tax splits, round off (positive and negative), multi-line aggregation, financial-year rollover, invoice number formatting, tax-mode/override decisions and Indian amount-in-words.

---

## Notes / not included

- No authentication or multi-user roles — this is a single-shop tool; put it behind your own network/auth if exposed publicly.
- No e-invoicing IRN or e-way bill generation.
- GST state codes 25 (old Daman & Diu) and 28 (old undivided Andhra Pradesh) are legacy and intentionally omitted; active codes 26 and 37 are used instead.
- The client tax preview mirrors server logic. If you change the formulas in `server/tax.js`, make the same change in `client/src/lib/tax.js`; saved invoices always use the server version.
