@AGENTS.md

# ShopDesk - Retail Store Management System

Client pitch demo: inventory, POS, GST tax invoices, returns, customers, reports and activity log for a Sydney electronics accessories shop.

- Stack: Next.js 16 (App Router, Turbopack) + Tailwind v4 + TypeScript.
- Demo data lives in browser localStorage (`src/lib/store.tsx`, seeded by `src/lib/seed.ts`). Production plan: PostgreSQL via Prisma (`prisma/schema.prisma`), each store action becomes a server action + transaction.
- Money rules: sell prices are GST-inclusive, buy prices are ex-GST, profit is calculated ex-GST. GST = total / 11.
- Dates are shown in `Australia/Sydney`, DD/MM/YYYY, en-AU.

## PM2 Services

| Port | Name | Type |
|------|------|------|
| 3010 | retail-store-3010 | Next.js |

Ports 3000/3001 are used by other projects (sms-api-3000, sms-web-3001), so avoid `pm2 stop all`.

**Terminal Commands:**
```bash
pm2 start ecosystem.config.cjs   # First time
pm2 start retail-store-3010      # After first time
pm2 stop retail-store-3010 / pm2 restart retail-store-3010
pm2 logs retail-store-3010 / pm2 status / pm2 monit
pm2 save                         # Save process list
pm2 resurrect                    # Restore saved list
```
