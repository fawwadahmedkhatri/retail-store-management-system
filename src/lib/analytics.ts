import { dayKey, exGst, monthKey, round2 } from "./format";
import { returnProfitImpact, saleProfit } from "./store";
import type { DbState } from "./types";

export interface Bucket {
  key: string;
  sales: number;
  gst: number;
  returns: number;
  net: number;
  cost: number;
  profit: number;
  orders: number;
  items: number;
}

const empty = (key: string): Bucket => ({ key, sales: 0, gst: 0, returns: 0, net: 0, cost: 0, profit: 0, orders: 0, items: 0 });

/** Sales/profit grouped by Sydney trading day or month, returns netted off on the day they happen. */
export function buckets(db: DbState, by: "day" | "month", from?: string, to?: string) {
  const keyOf = by === "day" ? dayKey : monthKey;
  const map = new Map<string, Bucket>();
  const inRange = (k: string) => (!from || k >= from.slice(0, k.length)) && (!to || k <= to.slice(0, k.length));
  for (const s of db.sales) {
    const k = keyOf(s.date);
    if (!inRange(k)) continue;
    const b = map.get(k) ?? empty(k);
    b.sales += s.total;
    b.gst += s.gst;
    b.cost += s.lines.reduce((a, l) => a + l.unitCost * l.qty, 0);
    b.profit += saleProfit(s);
    b.orders += 1;
    b.items += s.lines.reduce((a, l) => a + l.qty, 0);
    map.set(k, b);
  }
  for (const r of db.returns) {
    const k = keyOf(r.date);
    if (!inRange(k)) continue;
    const b = map.get(k) ?? empty(k);
    b.returns += r.total;
    b.gst -= r.total / 11;
    b.profit += returnProfitImpact(r);
    map.set(k, b);
  }
  return [...map.values()]
    .map((b) => ({
      ...b,
      sales: round2(b.sales),
      gst: round2(b.gst),
      returns: round2(b.returns),
      net: round2(b.sales - b.returns),
      cost: round2(b.cost),
      profit: round2(b.profit),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function totals(list: Bucket[]) {
  const t = list.reduce((a, b) => {
    (Object.keys(b) as (keyof Bucket)[]).forEach((k) => k !== "key" && ((a[k] as number) += b[k] as number));
    return a;
  }, empty("total"));
  const netEx = exGst(t.net);
  return { ...t, margin: netEx > 0 ? t.profit / netEx : 0 };
}

export function topProducts(db: DbState, from?: string, to?: string, limit = 10) {
  const map = new Map<string, { productId: string; name: string; sku: string; qty: number; revenue: number; profit: number }>();
  for (const s of db.sales) {
    const k = dayKey(s.date);
    if ((from && k < from) || (to && k > to)) continue;
    const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1;
    for (const l of s.lines) {
      const e = map.get(l.productId) ?? { productId: l.productId, name: l.name, sku: l.sku, qty: 0, revenue: 0, profit: 0 };
      const rev = (l.unitPrice * l.qty - l.discount) * ratio;
      e.qty += l.qty;
      e.revenue += rev;
      e.profit += exGst(rev) - l.unitCost * l.qty;
      map.set(l.productId, e);
    }
  }
  return [...map.values()]
    .map((e) => ({ ...e, revenue: round2(e.revenue), profit: round2(e.profit) }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}

/** Net sales (sales minus refunds) between two instants - for like-for-like "so far today/this month" comparisons. */
export function netBetween(db: DbState, from: Date, to: Date) {
  const a = from.toISOString();
  const b = to.toISOString();
  const sales = db.sales.reduce((s, x) => (x.date >= a && x.date <= b ? s + x.total : s), 0);
  const refunds = db.returns.reduce((s, x) => (x.date >= a && x.date <= b ? s + x.total : s), 0);
  return round2(sales - refunds);
}

export function lastNDays(n: number, end = new Date()) {
  return Array.from({ length: n }, (_, i) => dayKey(new Date(end.getTime() - (n - 1 - i) * 864e5)));
}
