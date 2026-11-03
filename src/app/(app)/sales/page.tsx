"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReceiptText, Search } from "lucide-react";
import { Badge, Card, Empty, Input, PageHeader, Pager, Select, Td, Th } from "@/components/ui";
import { dayKey, fmtDateTime, money } from "@/lib/format";
import { useDb } from "@/lib/store";

const PAGE = 50;

export default function SalesPage() {
  const { db } = useDb();
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const customers = useMemo(() => new Map(db.customers.map((c) => [c.id, c])), [db.customers]);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u.name])), [db.users]);
  const returned = useMemo(() => new Set(db.returns.map((r) => r.saleId)), [db.returns]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...db.sales].reverse().filter((x) => {
      if (payment && x.payment !== payment) return false;
      const k = dayKey(x.date);
      if ((from && k < from) || (to && k > to)) return false;
      if (!s) return true;
      const c = x.customerId ? customers.get(x.customerId) : null;
      return (
        x.invoiceNo.toLowerCase().includes(s) ||
        c?.name.toLowerCase().includes(s) ||
        c?.phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")) ||
        x.lines.some((l) => l.name.toLowerCase().includes(s) || l.sku.toLowerCase().includes(s))
      );
    });
  }, [db.sales, q, payment, from, to, customers]);

  const shown = list.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <>
      <PageHeader title="Invoices" sub={`${list.length.toLocaleString("en-AU")} invoices · search by invoice number, customer, phone or product`} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="INV-001234, customer, 04xx…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
          </div>
          <Select className="w-auto" value={payment} onChange={(e) => (setPayment(e.target.value), setPage(0))} aria-label="Payment method">
            <option value="">All payments</option>
            <option value="Card">EFTPOS / Card</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank transfer</option>
          </Select>
          <Input type="date" className="w-auto" value={from} onChange={(e) => (setFrom(e.target.value), setPage(0))} aria-label="From date" />
          <Input type="date" className="w-auto" value={to} onChange={(e) => (setTo(e.target.value), setPage(0))} aria-label="To date" />
        </div>
        {shown.length === 0 ? (
          <Empty icon={<ReceiptText size={28} />} title="No invoices match">
            Try a different search or clear the date filter.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-surface-2/60">
                <tr>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th className="hidden md:table-cell">Served by</Th>
                  <Th>Payment</Th>
                  <Th right>Items</Th>
                  <Th right>Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2/60">
                    <Td className="whitespace-nowrap">
                      <Link href={`/sales/view?id=${s.id}`} className="font-medium text-brand hover:underline">
                        {s.invoiceNo}
                      </Link>
                      {returned.has(s.id) && (
                        <span className="ml-2">
                          <Badge tone="warn">Return</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDateTime(s.date)}</Td>
                    <Td>{s.customerId ? customers.get(s.customerId)?.name ?? "-" : <span className="text-muted">Walk-in</span>}</Td>
                    <Td className="hidden text-muted md:table-cell">{users.get(s.userId)}</Td>
                    <Td>
                      <Badge>{s.payment === "Card" ? "EFTPOS" : s.payment}</Badge>
                    </Td>
                    <Td right>{s.lines.reduce((a, l) => a + l.qty, 0)}</Td>
                    <Td right className="font-medium">
                      {money(s.total)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} total={list.length} size={PAGE} onPage={setPage} />
      </Card>
    </>
  );
}
