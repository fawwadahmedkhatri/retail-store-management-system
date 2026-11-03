"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ShoppingCart } from "lucide-react";
import { BarChart } from "@/components/BarChart";
import { Badge, Button, Card, Stat } from "@/components/ui";
import { buckets, lastNDays, netBetween, topProducts, totals } from "@/lib/analytics";
import { TZ, dayKey, dayLabel, fmtTime, money, monthKey, msSinceSydneyMidnight } from "@/lib/format";
import { useDb } from "@/lib/store";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function Dashboard() {
  const { db, user } = useDb();
  const now = useMemo(() => new Date(), []);
  const today = dayKey(now);
  const month = monthKey(now);

  const data = useMemo(() => {
    const byDay = new Map(buckets(db, "day").map((d) => [d.key, d]));
    const last30 = lastNDays(30, now).map((k) => byDay.get(k) ?? { key: k, net: 0, profit: 0, orders: 0 });
    const months = buckets(db, "month");
    // Like-for-like: today so far vs the same hours last week; month to date vs the same days last month.
    const [y, m, d] = today.split("-").map(Number);
    const dayStart = new Date(now.getTime() - msSinceSydneyMidnight(now));
    const monthStart = new Date(dayStart.getTime() - (d - 1) * 864e5);
    const prevMonthDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const prevMonthStart = new Date(monthStart.getTime() - prevMonthDays * 864e5);
    const week = 7 * 864e5;
    return {
      last30,
      t: byDay.get(today),
      lwSoFar: netBetween(db, new Date(dayStart.getTime() - week), new Date(now.getTime() - week)),
      m: totals(months.filter((x) => x.key === month)),
      pmSoFar: netBetween(db, prevMonthStart, new Date(prevMonthStart.getTime() + (now.getTime() - monthStart.getTime()))),
    };
  }, [db, now, today, month]);

  const top = useMemo(() => topProducts(db, `${month}-01`, undefined, 6), [db, month]);
  const lowStock = useMemo(() => db.products.filter((p) => p.qty <= p.reorderLevel).sort((a, b) => a.qty - b.qty), [db.products]);
  const recent = db.sales.slice(-6).reverse();

  const todaySales = data.t?.net ?? 0;
  const vsLw = data.lwSoFar ? (todaySales - data.lwSoFar) / data.lwSoFar : 0;
  const vsPm = data.pmSoFar ? (data.m.net - data.pmSoFar) / data.pmSoFar : 0;
  const hour = Number(new Intl.DateTimeFormat("en-AU", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  const greet = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const weekday = now.toLocaleDateString("en-AU", { timeZone: TZ, weekday: "long" });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greet}, {user!.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {now.toLocaleDateString("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" })} · here&apos;s how the shop
            is tracking.
          </p>
        </div>
        <Link href="/pos">
          <Button variant="primary">
            <ShoppingCart size={16} /> New sale
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Today's sales"
          value={money(todaySales)}
          sub={
            data.lwSoFar ? (
              <span className="inline-flex items-center gap-1">
                {vsLw >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {pct(Math.abs(vsLw))} vs this time last {weekday}
              </span>
            ) : (
              `No sales by this time last ${weekday}`
            )
          }
          tone={vsLw >= 0 ? "ok" : "danger"}
        />
        <Stat label="Today's profit" value={money(data.t?.profit ?? 0)} sub={`${data.t?.orders ?? 0} sales · ex GST`} />
        <Stat
          label={`${now.toLocaleDateString("en-AU", { timeZone: TZ, month: "long" })} sales`}
          value={money(data.m.net)}
          sub={
            <span className="inline-flex items-center gap-1">
              {vsPm >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {pct(Math.abs(vsPm))} vs same days last month
            </span>
          }
          tone={vsPm >= 0 ? "ok" : "danger"}
        />
        <Stat label="Month profit" value={money(data.m.profit)} sub={`${pct(data.m.margin)} margin · GST collected ${money(data.m.gst)}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Last 30 days</h2>
            <Link href="/reports" className="text-sm text-brand hover:underline">
              Full reports
            </Link>
          </div>
          <BarChart data={data.last30.map((d) => ({ label: dayLabel(d.key).split(" ")[0], sub: dayLabel(d.key), value: d.net, inner: d.profit }))} />
        </Card>

        <Card>
          <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Top sellers this month</h2>
            <span className="text-xs text-muted">units · profit</span>
          </div>
          <ol className="divide-y divide-line">
            {top.map((p, i) => (
              <li key={p.productId} className="flex items-center gap-3 px-5 py-3">
                <span className="num w-5 text-sm text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="num text-xs text-muted">
                    {p.qty} sold · {money(p.revenue)}
                  </div>
                </div>
                <span className="num text-sm text-ok">{money(p.profit)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={16} className="text-warn" /> Reorder soon
            </h2>
            <Link href="/inventory" className="text-sm text-brand hover:underline">
              {lowStock.length} items
            </Link>
          </div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {lowStock.slice(0, 12).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm">{p.name}</div>
                  <div className="text-xs text-muted">{p.sku}</div>
                </div>
                {p.qty <= 0 ? <Badge tone="danger">Out of stock</Badge> : <Badge tone="warn">{p.qty} left</Badge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Latest sales</h2>
            <Link href="/sales" className="text-sm text-brand hover:underline">
              All invoices
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {recent.map((s) => (
              <li key={s.id}>
                <Link href={`/sales/view?id=${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/60">
                  <div>
                    <div className="text-sm font-medium">{s.invoiceNo}</div>
                    <div className="text-xs text-muted">
                      {dayKey(s.date) === today ? `Today ${fmtTime(s.date)}` : dayLabel(dayKey(s.date))} · {s.lines.length} item
                      {s.lines.length > 1 ? "s" : ""} · {s.payment === "Card" ? "EFTPOS" : s.payment}
                    </div>
                  </div>
                  <span className="num font-medium">{money(s.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
