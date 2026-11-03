"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowLeft, Printer, Undo2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Select, Td, Th, Toast } from "@/components/ui";
import { Receipt, ReturnSlip } from "@/components/Receipt";
import { fmtDateTime, money } from "@/lib/format";
import { returnedQty, saleProfit, useDb } from "@/lib/store";
import type { PaymentMethod, SaleReturn } from "@/lib/types";

const REASONS = ["Faulty / not working", "Wrong model or size", "Change of mind (unopened)", "Damaged in box", "Other"];

// Invoice id is a query param (/sales/view?id=…) so the app can be exported as static files for GitHub Pages.
export default function SaleDetailPage() {
  return (
    <Suspense>
      <SaleDetail />
    </Suspense>
  );
}

function SaleDetail() {
  const id = useSearchParams().get("id") ?? "";
  const store = useDb();
  const { db, isAdmin } = store;
  const sale = db.sales.find((s) => s.id === id);
  const [returning, setReturning] = useState(false);
  const [slip, setSlip] = useState<SaleReturn | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const returns = useMemo(() => db.returns.filter((r) => r.saleId === id), [db.returns, id]);
  const already = useMemo(() => returnedQty(db, id), [db, id]);

  if (!sale) {
    return (
      <div className="py-20 text-center text-muted">
        Invoice not found.{" "}
        <Link href="/sales" className="text-brand underline">
          Back to invoices
        </Link>
      </div>
    );
  }
  const customer = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) : null;
  const returnable = sale.lines.some((l) => l.qty - (already.get(l.productId) ?? 0) > 0);

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/sales" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ArrowLeft size={14} /> Invoices
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{sale.invoiceNo}</h1>
          <p className="text-sm text-muted">
            {fmtDateTime(sale.date)} · {db.users.find((u) => u.id === sale.userId)?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setReturning(true)} disabled={!returnable}>
            <Undo2 size={16} /> Process return
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer size={16} /> Print / PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="no-print space-y-6">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-surface-2/60">
                  <tr>
                    <Th>Item</Th>
                    <Th right>Qty</Th>
                    <Th right>Unit</Th>
                    <Th right>Discount</Th>
                    <Th right>Line total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sale.lines.map((l) => (
                    <tr key={l.productId}>
                      <Td>
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted">
                          {l.sku}
                          {already.get(l.productId) ? <span className="ml-2 text-warn">{already.get(l.productId)} returned</span> : null}
                        </div>
                      </Td>
                      <Td right>{l.qty}</Td>
                      <Td right>{money(l.unitPrice)}</Td>
                      <Td right className="text-muted">
                        {l.discount ? `-${money(l.discount)}` : "–"}
                      </Td>
                      <Td right className="font-medium">
                        {money(l.unitPrice * l.qty - l.discount)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="num grid grid-cols-2 gap-y-1 border-t border-line p-4 text-sm sm:ml-auto sm:w-80">
              {sale.cartDiscount > 0 && (
                <>
                  <dt className="text-muted">Sale discount</dt>
                  <dd className="text-right">-{money(sale.cartDiscount)}</dd>
                </>
              )}
              <dt className="text-muted">GST included</dt>
              <dd className="text-right">{money(sale.gst)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">{money(sale.total)}</dd>
              {isAdmin && (
                <>
                  <dt className="text-muted">Profit (ex GST)</dt>
                  <dd className="text-right text-ok">{money(saleProfit(sale))}</dd>
                </>
              )}
            </dl>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4">
              <div className="text-sm text-muted">Customer</div>
              {customer ? (
                <Link href={`/customers?id=${customer.id}`} className="mt-1 block font-medium text-brand hover:underline">
                  {customer.name}
                </Link>
              ) : (
                <div className="mt-1 font-medium">Walk-in</div>
              )}
              {customer && <div className="text-sm text-muted">{customer.phone}</div>}
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted">Payment</div>
              <div className="mt-1 font-medium">{sale.payment === "Card" ? "EFTPOS / Card" : sale.payment}</div>
              {sale.payment === "Cash" && sale.tendered != null && (
                <div className="text-sm text-muted">
                  Tendered {money(sale.tendered)} · change {money(sale.tendered - sale.total)}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div className="border-b border-line px-4 py-3 font-medium">Returns against this invoice</div>
            {returns.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No returns.</p>
            ) : (
              <ul className="divide-y divide-line">
                {returns.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <button onClick={() => setSlip(r)} className="font-medium text-brand hover:underline">
                        {r.returnNo}
                      </button>
                      <span className="ml-2 text-muted">
                        {fmtDateTime(r.date)} · {r.reason}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={r.restocked ? "ok" : "neutral"}>{r.restocked ? "Restocked" : "Not restocked"}</Badge>
                      <span className="num font-medium">-{money(r.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <div className="no-print mb-2 text-sm font-medium text-muted">Receipt preview (80mm)</div>
          {!slip && <Receipt db={db} sale={sale} />}
        </div>
      </div>

      {returning && (
        <ReturnModal
          onClose={() => setReturning(false)}
          saleId={sale.id}
          defaultMethod={sale.payment}
          onDone={(r) => {
            setReturning(false);
            setSlip(r);
            setToast(`${r.returnNo} recorded · refund ${money(r.total)}`);
          }}
        />
      )}
      <Modal
        open={!!slip}
        onClose={() => setSlip(null)}
        title={slip?.returnNo ?? ""}
        footer={
          <Button variant="primary" onClick={() => window.print()}>
            <Printer size={16} /> Print adjustment note
          </Button>
        }
      >
        {slip && (
          <div className="bg-surface-2 py-4">
            <ReturnSlip db={db} ret={slip} />
          </div>
        )}
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function ReturnModal({
  onClose,
  saleId,
  defaultMethod,
  onDone,
}: {
  onClose: () => void;
  saleId: string;
  defaultMethod: PaymentMethod;
  onDone: (r: SaleReturn) => void;
}) {
  const store = useDb();
  const sale = store.db.sales.find((s) => s.id === saleId)!;
  const already = returnedQty(store.db, saleId);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]);
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [restock, setRestock] = useState(false);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Return against ${sale.invoiceNo}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!count}
            onClick={() =>
              onDone(
                store.createReturn({
                  saleId,
                  lines: Object.entries(qty).map(([productId, q]) => ({ productId, qty: q })),
                  reason,
                  refundMethod: method,
                  restock,
                }),
              )
            }
          >
            Confirm return
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">Choose how many of each item are coming back. You can only return what was on this invoice.</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {sale.lines.map((l) => {
          const max = l.qty - (already.get(l.productId) ?? 0);
          return (
            <li key={l.productId} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.name}</div>
                <div className="text-xs text-muted">
                  Bought {l.qty} · {max} returnable
                </div>
              </div>
              <Input
                type="number"
                min={0}
                max={max}
                disabled={max <= 0}
                className="w-20 text-right"
                value={qty[l.productId] ?? 0}
                onChange={(e) => setQty({ ...qty, [l.productId]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })}
                aria-label={`Return quantity for ${l.name}`}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Refund via">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="Card">EFTPOS / Card</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank transfer</option>
          </Select>
        </Field>
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--brand)]" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium">Put items back on the shelf</span>
          <span className="block text-xs text-muted">Tick if the item is resaleable. Leave unticked for faulty goods going back to the supplier.</span>
        </span>
      </label>
    </Modal>
  );
}
