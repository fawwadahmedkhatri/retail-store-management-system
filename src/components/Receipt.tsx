"use client";

import { fmtDateTime, money } from "@/lib/format";
import type { DbState, Sale, SaleReturn } from "@/lib/types";

/** 80mm thermal-printer layout. Meets ATO tax-invoice requirements for sales under $1,000. */
export function Receipt({ db, sale }: { db: DbState; sale: Sale }) {
  const s = db.settings;
  const cashier = db.users.find((u) => u.id === sale.userId)?.name ?? "-";
  const customer = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) : null;
  const lineDiscounts = sale.lines.reduce((a, l) => a + l.discount, 0);
  const gross = sale.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);

  return (
    <div className="print-area mx-auto w-[302px] bg-white px-4 py-5 font-mono text-[11.5px] leading-snug text-black shadow-sm ring-1 ring-line">
      <div className="text-center">
        {s.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.logo} alt="" className="mx-auto mb-2 max-h-16 max-w-[180px] object-contain grayscale" />
        ) : null}
        <div className="text-[14px] font-bold">{s.name}</div>
        <div>{s.address}</div>
        <div>Ph {s.phone}</div>
        <div>ABN {s.abn}</div>
        <div className="mt-2 border-y border-dashed border-black py-1 text-[13px] font-bold tracking-widest">TAX INVOICE</div>
      </div>

      <div className="mt-2 space-y-0.5">
        <Row l="Invoice" r={sale.invoiceNo} />
        <Row l="Date" r={fmtDateTime(sale.date)} />
        <Row l="Served by" r={cashier} />
        {customer && <Row l="Customer" r={customer.name} />}
      </div>

      <div className="my-2 border-t border-dashed border-black" />
      {sale.lines.map((l) => (
        <div key={l.productId} className="mb-1.5">
          <div className="break-words">{l.name}</div>
          <Row l={`  ${l.qty} x ${money(l.unitPrice)}`} r={money(l.unitPrice * l.qty)} />
          {l.discount > 0 && <Row l="  Discount" r={`-${money(l.discount)}`} />}
          <div className="text-[10px] text-black/60">  {l.sku}</div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-0.5">
        <Row l="Subtotal" r={money(gross)} />
        {lineDiscounts + sale.cartDiscount > 0 && <Row l="Discounts" r={`-${money(lineDiscounts + sale.cartDiscount)}`} />}
        <Row l={<b className="text-[14px]">TOTAL (AUD)</b>} r={<b className="text-[14px]">{money(sale.total)}</b>} />
        <Row l="GST included" r={money(sale.gst)} />
      </div>

      <div className="my-2 border-t border-dashed border-black" />
      <Row l={`Paid by ${sale.payment === "Card" ? "EFTPOS/Card" : sale.payment}`} r={money(sale.tendered ?? sale.total)} />
      {sale.payment === "Cash" && sale.tendered != null && sale.tendered > sale.total && <Row l="Change" r={money(sale.tendered - sale.total)} />}

      <p className="mt-3 text-center text-[10.5px]">{s.receiptFooter}</p>
      <p className="mt-2 text-center text-[10px]">Total includes GST · {s.email}</p>
    </div>
  );
}

export function ReturnSlip({ db, ret }: { db: DbState; ret: SaleReturn }) {
  const s = db.settings;
  return (
    <div className="print-area mx-auto w-[302px] bg-white px-4 py-5 font-mono text-[11.5px] leading-snug text-black shadow-sm ring-1 ring-line">
      <div className="text-center">
        <div className="text-[14px] font-bold">{s.name}</div>
        <div>ABN {s.abn}</div>
        <div className="mt-2 border-y border-dashed border-black py-1 text-[13px] font-bold tracking-widest">ADJUSTMENT NOTE</div>
      </div>
      <div className="mt-2 space-y-0.5">
        <Row l="Return" r={ret.returnNo} />
        <Row l="Original invoice" r={ret.invoiceNo} />
        <Row l="Date" r={fmtDateTime(ret.date)} />
        <Row l="Reason" r={ret.reason} />
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      {ret.lines.map((l) => (
        <div key={l.productId} className="mb-1">
          <div>{l.name}</div>
          <Row l={`  ${l.qty} returned`} r={`-${money(l.refund)}`} />
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <Row l={<b>REFUND</b>} r={<b>{money(ret.total)}</b>} />
      <Row l="GST adjustment" r={`-${money(ret.total / 11)}`} />
      <Row l="Refunded via" r={ret.refundMethod} />
    </div>
  );
}

function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 whitespace-pre">
      <span className="truncate">{l}</span>
      <span className="shrink-0 text-right">{r}</span>
    </div>
  );
}
