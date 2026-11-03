# ShopDesk — Stock, POS & Invoicing

A custom retail management system for an independent electronics accessories shop in Sydney. It replaces the Excel stock sheet with one place for inventory, sales, GST tax invoices, returns, customers and profit reporting.

> **This is the interactive demo.** It runs entirely in the browser with 600 sample products and 90 days of sample trading, so it can be clicked through with zero setup. The production build keeps the same screens and moves the data into PostgreSQL (see `prisma/schema.prisma`).

## Demo logins

| Role | Email | Password |
|---|---|---|
| Owner (Admin) | `admin@demo.shopdesk.test` | `demo-admin` |
| Staff | `staff@demo.shopdesk.test` | `demo-staff` |

There are one-click demo buttons on the sign-in screen.

## What's in it

| Brief requirement | Where to see it |
|---|---|
| Admin full access; staff can sell but can't edit prices or see profit | Sign in as Staff: no Dashboard/Reports/Settings, price fields locked, no cost or profit anywhere. Also enforced in the data layer, not just hidden in the UI. |
| Products with SKU/barcode, buy & sell price, quantity | **Inventory** — buy price ex GST, sell price inc GST, live margin |
| Import existing products from Excel | **Inventory → Import Excel** — recognises common column names (SKU, Code, RRP, SOH, Buy ex GST…), previews new vs updated, flags bad rows before anything changes. Template download included. |
| Barcode scanner support | **New sale** — the scan box is always focused; any USB/Bluetooth scanner (keyboard-wedge) adds the item on scan. Also works in product forms and search. |
| Low-stock alerts | Sidebar badge, inventory banner and filter, dashboard "Reorder soon" list. Per-product alert level. |
| Stock updates automatically on sales, returns and new stock | Sale deducts stock, restocked returns add it back, **Receive stock** records supplier + PO and adds stock |
| Fast POS with discounts and Cash/Card/Bank | **New sale** — line or whole-sale discounts (% or $), cash change calculator, keyboard shortcuts (F2 scan, F6–F8 payment, F9 complete) |
| PDF invoice with logo for 80mm thermal printer | Receipt is laid out at 80mm with `@page` print CSS; **Print / PDF** prints straight to a thermal printer or saves PDF. Marked **TAX INVOICE** with ABN and GST — meets ATO requirements for sales under $1,000. |
| Returns linked to original invoice | Open an invoice → **Process return**. Only items/qty on that invoice can be returned, refunds respect discounts, choose to restock or write off, prints an adjustment note. |
| Customers with purchase history | **Customers** — lifetime spend, visits, every invoice. Customers can be added from the POS in two taps. |
| Daily/monthly sales, profit, top sellers (admin) | **Dashboard** and **Reports** — includes Australian presets: *This BAS quarter*, *Last BAS quarter*, *This financial year* (from 1 July), with G1/1A figures. |
| Sales report exportable to Excel | **Reports → Export to Excel** — Summary, By day/month, Invoices and Top products sheets |
| Activity log | **Activity log** — who created/updated/deleted what and when, with before → after values for every changed field. Exportable. |
| Responsive desktop & tablet | Sidebar collapses on tablet; POS stacks cart below products |

### Built for an Australian shop

- AUD, prices shown GST-inclusive, GST worked out as 1/11th; profit always reported ex GST
- Sydney time zone for trading days, DD/MM/YYYY dates, Australian English
- EFTPOS/Card, Cash and Bank transfer payment types
- Tax invoices with ABN; returns produce adjustment notes
- Australian Consumer Law note on receipts
- BAS quarter and financial-year reporting

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Or with PM2 (port 3010):

```bash
pm2 start ecosystem.config.cjs
```

## Publishing to GitHub

```bash
./scripts/publish-to-github.sh            # repo name defaults to the folder name
```

The script (needs `gh auth login`) creates a **public** repo, pushes the code, deploys the demo to **GitHub Pages** via `.github/workflows/deploy-pages.yml`, and protects `main`:

- no direct pushes, force pushes or deletion — for everyone, admins included
- changes land only through a pull request whose `build` check (type check, lint, static build) passes
- every merge to `main` redeploys the live demo at `https://<user>.github.io/<repo>/`

For Pages the app is exported as static files (`PAGES_BASE_PATH` turns this on in `next.config.ts`); local dev and PM2 are unaffected.

## Production plan

- **Database:** PostgreSQL with Prisma — schema in `prisma/schema.prisma`. Money stored as `Decimal`, prices snapshotted on each sale line so historic profit never changes when prices do.
- **Auth:** Auth.js credentials login with bcrypt-hashed passwords and role checks in every server action (not only the UI).
- **Writes:** each action in `src/lib/store.tsx` (checkout, return, stock-in, import) becomes a server action wrapped in a database transaction, so stock and invoices can't drift apart.
- **Hosting:** runs on the client's own host (any Node 20+ VPS or cPanel Node app) with PM2, or Docker. No subscriptions; the client owns the code on GitHub.
- **Backups:** nightly `pg_dump` to the client's own storage.

## Project layout

```
src/app/login              Sign-in
src/app/(app)/dashboard    Admin overview
src/app/(app)/pos          Point of sale
src/app/(app)/sales        Invoices + invoice detail/returns
src/app/(app)/returns      Returns register
src/app/(app)/inventory    Products, import/export, receive stock
src/app/(app)/customers    Customers + purchase history
src/app/(app)/reports      Reports + Excel export
src/app/(app)/activity     Audit log
src/app/(app)/settings     Shop details, logo, staff accounts
src/components/Receipt.tsx 80mm tax invoice / adjustment note
src/lib/store.tsx          Data layer (stock, sales, returns, audit log)
src/lib/seed.ts            Demo catalogue and trading history
prisma/schema.prisma       Production PostgreSQL schema
```
