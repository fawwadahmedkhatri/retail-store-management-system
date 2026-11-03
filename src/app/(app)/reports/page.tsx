"use client";

import { useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { BarChart } from "@/components/BarChart";
import { Button, Card, Input, PageHeader, Select, Stat, Td, Th, cx } from "@/components/ui";
import { buckets, topProducts, totals } from "@/lib/analytics";
import { dayKey, dayLabel, exGst, fmtDateTime, money, monthLabel } from "@/lib/format";
import { exportWorkbook } from "@/lib/excel";
import { saleProfit, useDb } from "@/lib/store";

type Preset = "today" | "7d" | "30d" | "month" | "lastMonth" | "bas" | "lastBas" | "fy" | "custom";

/** Australian date ranges: financial year starts 1 July; BAS quarters are Jul–Sep, Oct–Dec, Jan–Mar, Apr–Jun. */
function range(p: Preset, now = new Date()): [string, string] {
  const today = dayKey(now);
  const [y, m] = today.split("-").map(Number);
  const iso = (yy: number, mm: number, dd: number) => `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const back = (n: number) => dayKey(new Date(now.getTime() - n * 864e5));
  const qStart = Math.floor((m - 1) / 3) * 3 + 1;
  switch (p) {
    case "today":
      return [today, today];
    case "7d":
      return [back(6), today];
    case "30d":
      return [back(29), today];
    case "month":
      return [iso(y, m, 1), today];
    case "lastMonth": {
      const [ly, lm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      return [iso(ly, lm, 1), iso(ly, lm, lastDay(ly, lm))];
    }
    case "bas":
      return [iso(y, qStart, 1), today];
    case "lastBas": {
      const [qy, qm] = qStart === 1 ? [y - 1, 10] : [y, qStart - 3];
      return [iso(qy, qm, 1), iso(qy, qm + 2, lastDay(qy, qm + 2))];
    }
    case "fy":
      return [iso(m >= 7 ? y : y - 1, 7, 1), today];
    default:
      return [back(29), today];
  }
}

const PRESETS: [Preset, string][] = [
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["month", "This month"],
  ["lastMonth", "Last month"],
  ["bas", "This BAS quarter"],
  ["lastBas", "Last BAS quarter"],
  ["fy", "This financial year"],
  ["custom", "Custom range"],
];

export default function ReportsPage() {
  const { db } = useDb();
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState<[string, string]>(() => range("30d"));
  const [from, to] = preset === "custom" ? custom : range(preset);
  const [group, setGroup] = useState<"day" | "month">("day");

  const rows = useMemo(() => buckets(db, group, from, to), [db, group, from, to]);
  const sum = useMemo(() => totals(rows), [rows]);
  const top = useMemo(() => topProducts(db, from, to, 15), [db, from, to]);
  const sales = useMemo(() => db.sales.filter((s) => dayKey(s.date) >= from && dayKey(s.date) <= to), [db.sales, from, to]);
  const byPayment = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) m.set(s.payment, (m.get(s.payment) ?? 0) + s.total);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sales]);
  const byCategory = useMemo(() => {
    const cat = new Map(db.products.map((p) => [p.id, p.category]));
    const m = new Map<string, { revenue: number; profit: number }>();
    for (const s of sales) {
      const ratio = s.subtotal ? s.total / s.subtotal : 1;
      for (const l of s.lines) {
        const k = cat.get(l.productId) ?? "Deleted products";
        const e = m.get(k) ?? { revenue: 0, profit: 0 };
        const rev = (l.unitPrice * l.qty - l.discount) * ratio;
        e.revenue += rev;
        e.profit += exGst(rev) - l.unitCost * l.qty;
        m.set(k, e);
      }
    }
    return [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [sales, db.products]);
  const label = (k: string) => (group === "day" ? dayLabel(k) : monthLabel(k));

  async function exportXlsx() {
    const users = new Map(db.users.map((u) => [u.id, u.name]));
    const customers = new Map(db.customers.map((c) => [c.id, c.name]));
    await exportWorkbook(`sales-report_${from}_to_${to}.xlsx`, [
      {
        name: "Summary",
        rows: [
          { Metric: "Period", Value: `${from} to ${to}` },
          { Metric: "Gross sales (inc GST)", Value: sum.sales },
          { Metric: "Refunds", Value: sum.returns },
          { Metric: "Net sales (inc GST)", Value: sum.net },
          { Metric: "GST collected (1A)", Value: sum.gst },
          { Metric: "Net sales ex GST", Value: exGst(sum.net) },
          { Metric: "Cost of goods", Value: sum.cost },
          { Metric: "Gross profit (ex GST)", Value: sum.profit },
          { Metric: "Margin", Value: `${(sum.margin * 100).toFixed(1)}%` },
          { Metric: "Transactions", Value: sum.orders },
          { Metric: "Average sale", Value: sum.orders ? Math.round((sum.sales / sum.orders) * 100) / 100 : 0 },
        ],
      },
      {
        name: group === "day" ? "By day" : "By month",
        rows: rows.map((r) => ({
          [group === "day" ? "Date" : "Month"]: r.key,
          Transactions: r.orders,
          "Items sold": r.items,
          "Gross sales": r.sales,
          Refunds: r.returns,
          "Net sales": r.net,
          GST: r.gst,
          "Cost of goods": r.cost,
          "Profit (ex GST)": r.profit,
        })),
      },
      {
        name: "Invoices",
        rows: sales.map((s) => ({
          Invoice: s.invoiceNo,
          Date: fmtDateTime(s.date),
          Customer: s.customerId ? customers.get(s.customerId) ?? "" : "Walk-in",
          "Served by": users.get(s.userId) ?? "",
          Payment: s.payment,
          Items: s.lines.reduce((a, l) => a + l.qty, 0),
          Discounts: Math.round((s.lines.reduce((a, l) => a + l.discount, 0) + s.cartDiscount) * 100) / 100,
          Total: s.total,
          GST: s.gst,
          Profit: saleProfit(s),
        })),
      },
      {
        name: "Top products",
        rows: top.map((p) => ({ SKU: p.sku, Product: p.name, "Units sold": p.qty, Revenue: p.revenue, Profit: p.profit })),
      },
    ]);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        sub={`${dayLabel(from)} ${from.slice(0, 4)} – ${dayLabel(to)} ${to.slice(0, 4)} · Sydney time`}
        actions={
          <Button variant="primary" onClick={exportXlsx}>
            <Download size={16} /> Export to Excel
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-2 p-3">
        <Select className="w-auto" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Date range">
          {PRESETS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        {preset === "custom" && (
          <>
            <Input type="date" className="w-auto" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} aria-label="From" />
            <Input type="date" className="w-auto" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} aria-label="To" />
          </>
        )}
        <div className="ml-auto flex rounded-lg border border-line p-0.5">
          {(["day", "month"] as const).map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={cx("rounded-md px-3 py-1.5 text-sm", group === g ? "bg-ink text-white" : "text-muted")}>
              {g === "day" ? "Daily" : "Monthly"}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Net sales" value={money(sum.net)} sub={`${sum.orders} sales · ${money(sum.returns)} refunded`} />
        <Stat label="Gross profit" value={money(sum.profit)} sub={`${(sum.margin * 100).toFixed(1)}% margin · ex GST`} tone="ok" />
        <Stat label="GST collected" value={money(sum.gst)} sub="BAS label 1A, net of refunds" />
        <Stat label="Average sale" value={money(sum.orders ? sum.sales / sum.orders : 0)} sub={`${sum.items} items sold`} />
      </div>

      {(preset === "bas" || preset === "lastBas") && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            For your BAS: total sales (G1) <b>{money(sum.net)}</b>, GST on sales (1A) <b>{money(sum.gst)}</b>. Check figures with your accountant before lodging.
          </span>
        </div>
      )}

      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-semibold">{group === "day" ? "Daily" : "Monthly"} sales and profit</h2>
        {rows.length ? (
          <BarChart
            data={rows.map((r) => ({
              label: group === "day" ? dayLabel(r.key).split(" ")[0] : monthLabel(r.key).split(" ")[0],
              sub: label(r.key),
              value: r.net,
              inner: r.profit,
            }))}
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted">No sales in this period.</p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card>
          <div className="border-b border-line px-5 py-4 font-semibold">Breakdown</div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-line bg-surface">
                <tr>
                  <Th>{group === "day" ? "Date" : "Month"}</Th>
                  <Th right>Sales</Th>
                  <Th right className="hidden sm:table-cell">Refunds</Th>
                  <Th right>Net</Th>
                  <Th right className="hidden md:table-cell">GST</Th>
                  <Th right>Profit</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...rows].reverse().map((r) => (
                  <tr key={r.key}>
                    <Td className="whitespace-nowrap">{label(r.key)}</Td>
                    <Td right>{r.orders}</Td>
                    <Td right className="hidden text-muted sm:table-cell">
                      {r.returns ? `-${money(r.returns)}` : "–"}
                    </Td>
                    <Td right className="font-medium">
                      {money(r.net)}
                    </Td>
                    <Td right className="hidden text-muted md:table-cell">
                      {money(r.gst)}
                    </Td>
                    <Td right className="text-ok">
                      {money(r.profit)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="border-b border-line px-5 py-4 font-semibold">Top-selling products</div>
            <ol className="max-h-[300px] divide-y divide-line overflow-y-auto">
              {top.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="num w-5 text-sm text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{p.name}</div>
                    <div className="num text-xs text-muted">
                      {p.qty} sold · {money(p.revenue)}
                    </div>
                  </div>
                  <span className="num text-sm text-ok">{money(p.profit)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5">
            <div className="mb-3 font-semibold">By payment method</div>
            <Bars items={byPayment.map(([k, v]) => [k === "Card" ? "EFTPOS / Card" : k, v])} />
          </Card>
          <Card className="p-5">
            <div className="mb-3 font-semibold">By category</div>
            <Bars items={byCategory.map(([k, v]) => [k, v.revenue])} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Bars({ items }: { items: [string, number][] }) {
  const max = Math.max(1, ...items.map((i) => i[1]));
  const total = items.reduce((a, i) => a + i[1], 0);
  return (
    <ul className="space-y-2.5">
      {items.map(([k, v]) => (
        <li key={k}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{k}</span>
            <span className="num text-muted">
              {money(v)} · {total ? ((v / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
