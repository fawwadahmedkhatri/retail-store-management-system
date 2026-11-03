"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { exGst, gstOf, money, pad, round2, uid } from "./format";
import { DB_VERSION, buildSeed } from "./seed";
import type {
  ActivityEntry,
  Customer,
  DbState,
  PaymentMethod,
  Product,
  Sale,
  SaleLine,
  SaleReturn,
  ShopSettings,
  User,
} from "./types";

/**
 * Demo persistence: the whole database lives in the browser (localStorage) so the
 * prototype can be clicked through with zero setup. Every mutation below maps 1:1 to
 * a server action + Prisma transaction in the production build (see prisma/schema.prisma).
 */
const DB_KEY = "shopdesk:db:v1";
const SESSION_KEY = "shopdesk:session";

export interface CartLine {
  product: Product;
  qty: number;
  discount: number;
}

export interface CheckoutInput {
  lines: CartLine[];
  cartDiscount: number;
  customerId: string | null;
  payment: PaymentMethod;
  tendered: number | null;
}

type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;
type CustomerInput = Omit<Customer, "id" | "createdAt">;

interface Store {
  ready: boolean;
  db: DbState;
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => User | null;
  logout: () => void;
  saveProduct: (input: ProductInput, id?: string) => Product;
  deleteProduct: (id: string) => void;
  importProducts: (rows: ProductInput[], fileName: string) => { created: number; updated: number };
  receiveStock: (input: { productId: string; qty: number; cost: number; supplier: string; reference: string }) => void;
  saveCustomer: (input: CustomerInput, id?: string) => Customer;
  deleteCustomer: (id: string) => void;
  checkout: (input: CheckoutInput) => Sale;
  createReturn: (input: {
    saleId: string;
    lines: { productId: string; qty: number }[];
    reason: string;
    refundMethod: PaymentMethod;
    restock: boolean;
  }) => SaleReturn;
  updateSettings: (s: ShopSettings) => void;
  saveUser: (u: Omit<User, "id">, id?: string) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

const PRODUCT_FIELDS: (keyof ProductInput)[] = ["name", "sku", "barcode", "category", "brand", "cost", "price", "qty", "reorderLevel"];

function diff<T extends object>(before: T, after: T, fields: (keyof T)[]) {
  return fields
    .filter((f) => String(before[f]) !== String(after[f]))
    .map((f) => {
      const money_ = f === "cost" || f === "price";
      const show = (v: unknown) => (money_ ? money(Number(v)) : String(v ?? ""));
      return { field: String(f), from: show(before[f]), to: show(after[f]) };
    });
}

/** Quantity of each product already returned against a sale. */
export function returnedQty(db: DbState, saleId: string) {
  const m = new Map<string, number>();
  for (const r of db.returns) if (r.saleId === saleId) for (const l of r.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
  return m;
}

export function cartTotals(lines: { qty: number; unitPrice: number; discount: number }[], cartDiscount: number) {
  const subtotal = round2(lines.reduce((a, l) => a + l.unitPrice * l.qty - l.discount, 0));
  const total = round2(Math.max(0, subtotal - cartDiscount));
  return { subtotal, total, gst: gstOf(total) };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DbState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const ref = useRef<DbState | null>(null);
  const userIdRef = useRef<string | null>(null);

  const setSession = useCallback((id: string | null) => {
    userIdRef.current = id;
    setUserId(id);
    try {
      if (id) localStorage.setItem(SESSION_KEY, id);
      else localStorage.removeItem(SESSION_KEY);
    } catch {}
  }, []);

  // Hydrate from browser storage once on mount (it isn't available during server render).
  useEffect(() => {
    let loaded: DbState | null = null;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch {}
    if (!loaded || loaded.version !== DB_VERSION) loaded = buildSeed();
    ref.current = loaded;
    let session: string | null = null;
    try {
      session = localStorage.getItem(SESSION_KEY);
    } catch {}
    userIdRef.current = session;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(session);
    setDb(loaded);
  }, []);

  // Debounced persistence.
  useEffect(() => {
    if (!db) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [db]);

  const user = useMemo(() => db?.users.find((u) => u.id === userId && u.active) ?? null, [db, userId]);

  const commit = useCallback((fn: (s: DbState) => DbState) => {
    const next = fn(ref.current!);
    ref.current = next;
    setDb(next);
    return next;
  }, []);

  const log = useCallback(
    (s: DbState, e: Omit<ActivityEntry, "id" | "at" | "userId">): DbState => ({
      ...s,
      activity: [{ id: uid(), at: new Date().toISOString(), userId: userIdRef.current ?? "system", ...e }, ...s.activity].slice(0, 2000),
    }),
    [],
  );

  const store = useMemo<Store | null>(() => {
    if (!db) return null;
    const isAdmin = user?.role === "admin";

    return {
      ready: true,
      db,
      user,
      isAdmin,

      login(email, password) {
        const u = ref.current!.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password && x.active);
        if (!u) return null;
        setSession(u.id);
        commit((s) => log(s, { action: "login", entity: "User", entityId: u.id, summary: `${u.name} signed in` }));
        return u;
      },

      logout() {
        setSession(null);
      },

      saveProduct(input, id) {
        const now = new Date().toISOString();
        let saved!: Product;
        commit((s) => {
          if (id) {
            const before = s.products.find((p) => p.id === id)!;
            // Staff can never change pricing, even if the UI were bypassed.
            const safe = isAdmin ? input : { ...input, cost: before.cost, price: before.price };
            saved = { ...before, ...safe, updatedAt: now };
            const changes = diff(before, saved, PRODUCT_FIELDS);
            if (!changes.length) return s;
            return log(
              { ...s, products: s.products.map((p) => (p.id === id ? saved : p)) },
              { action: "updated", entity: "Product", entityId: id, summary: `Updated ${saved.name}`, changes },
            );
          }
          saved = { ...input, id: uid(), createdAt: now, updatedAt: now };
          return log(
            { ...s, products: [saved, ...s.products] },
            { action: "created", entity: "Product", entityId: saved.id, summary: `Added product ${saved.name} (${saved.sku})` },
          );
        });
        return saved;
      },

      deleteProduct(id) {
        commit((s) => {
          const p = s.products.find((x) => x.id === id);
          if (!p) return s;
          return log(
            { ...s, products: s.products.filter((x) => x.id !== id) },
            { action: "deleted", entity: "Product", entityId: id, summary: `Deleted product ${p.name} (${p.sku})` },
          );
        });
      },

      importProducts(rows, fileName) {
        let created = 0;
        let updated = 0;
        const now = new Date().toISOString();
        commit((s) => {
          const bySku = new Map(s.products.map((p) => [p.sku.toLowerCase(), p]));
          for (const row of rows) {
            const existing = bySku.get(row.sku.toLowerCase());
            if (existing) {
              bySku.set(row.sku.toLowerCase(), { ...existing, ...row, updatedAt: now });
              updated++;
            } else {
              bySku.set(row.sku.toLowerCase(), { ...row, id: uid(), createdAt: now, updatedAt: now });
              created++;
            }
          }
          return log(
            { ...s, products: [...bySku.values()] },
            { action: "import", entity: "Product", entityId: "-", summary: `Imported ${fileName}: ${created} new, ${updated} updated` },
          );
        });
        return { created, updated };
      },

      receiveStock({ productId, qty, cost, supplier, reference }) {
        commit((s) => {
          const p = s.products.find((x) => x.id === productId)!;
          return log(
            {
              ...s,
              products: s.products.map((x) =>
                x.id === productId ? { ...x, qty: x.qty + qty, cost: isAdmin ? cost : x.cost, updatedAt: new Date().toISOString() } : x,
              ),
              stockEntries: [
                { id: uid(), date: new Date().toISOString(), productId, qty, cost, supplier, reference, userId: userIdRef.current! },
                ...s.stockEntries,
              ],
            },
            {
              action: "stock-in",
              entity: "Stock",
              entityId: productId,
              summary: `Received ${qty} x ${p.name}${reference ? ` (${reference}${supplier ? `, ${supplier}` : ""})` : ""}`,
              changes: [{ field: "qty", from: String(p.qty), to: String(p.qty + qty) }],
            },
          );
        });
      },

      saveCustomer(input, id) {
        let saved!: Customer;
        commit((s) => {
          if (id) {
            const before = s.customers.find((c) => c.id === id)!;
            saved = { ...before, ...input };
            const changes = diff(before, saved, ["name", "phone", "email", "suburb", "notes"]);
            if (!changes.length) return s;
            return log(
              { ...s, customers: s.customers.map((c) => (c.id === id ? saved : c)) },
              { action: "updated", entity: "Customer", entityId: id, summary: `Updated customer ${saved.name}`, changes },
            );
          }
          saved = { ...input, id: uid(), createdAt: new Date().toISOString() };
          return log(
            { ...s, customers: [saved, ...s.customers] },
            { action: "created", entity: "Customer", entityId: saved.id, summary: `Added customer ${saved.name}` },
          );
        });
        return saved;
      },

      deleteCustomer(id) {
        commit((s) => {
          const c = s.customers.find((x) => x.id === id);
          if (!c) return s;
          return log(
            { ...s, customers: s.customers.filter((x) => x.id !== id) },
            { action: "deleted", entity: "Customer", entityId: id, summary: `Deleted customer ${c.name}` },
          );
        });
      },

      checkout({ lines, cartDiscount, customerId, payment, tendered }) {
        let sale!: Sale;
        commit((s) => {
          const no = s.counters.invoice + 1;
          const saleLines: SaleLine[] = lines.map((l) => ({
            productId: l.product.id,
            sku: l.product.sku,
            name: l.product.name,
            qty: l.qty,
            unitPrice: l.product.price,
            unitCost: l.product.cost,
            discount: round2(l.discount),
          }));
          const t = cartTotals(saleLines, cartDiscount);
          sale = {
            id: uid(),
            invoiceNo: `INV-${pad(no)}`,
            date: new Date().toISOString(),
            userId: userIdRef.current!,
            customerId,
            lines: saleLines,
            cartDiscount: round2(cartDiscount),
            ...t,
            payment,
            tendered,
          };
          const qtyBy = new Map(saleLines.map((l) => [l.productId, l.qty]));
          return log(
            {
              ...s,
              counters: { ...s.counters, invoice: no },
              sales: [...s.sales, sale],
              products: s.products.map((p) => (qtyBy.has(p.id) ? { ...p, qty: p.qty - qtyBy.get(p.id)! } : p)),
            },
            { action: "sale", entity: "Sale", entityId: sale.id, summary: `${sale.invoiceNo} · ${money(sale.total)} · ${payment}` },
          );
        });
        return sale;
      },

      createReturn({ saleId, lines, reason, refundMethod, restock }) {
        let rec!: SaleReturn;
        commit((s) => {
          const sale = s.sales.find((x) => x.id === saleId)!;
          const already = returnedQty(s, saleId);
          // Refund what the customer actually paid per unit: line discount and share of cart discount.
          const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
          const rLines = lines
            .filter((l) => l.qty > 0)
            .map((l) => {
              const sl = sale.lines.find((x) => x.productId === l.productId)!;
              const qty = Math.min(l.qty, sl.qty - (already.get(l.productId) ?? 0));
              const unitPaid = ((sl.unitPrice * sl.qty - sl.discount) / sl.qty) * ratio;
              return { productId: sl.productId, name: sl.name, qty, refund: round2(unitPaid * qty), unitCost: sl.unitCost };
            })
            .filter((l) => l.qty > 0);
          const no = s.counters.return + 1;
          rec = {
            id: uid(),
            returnNo: `RTN-${pad(no, 5)}`,
            saleId,
            invoiceNo: sale.invoiceNo,
            date: new Date().toISOString(),
            userId: userIdRef.current!,
            lines: rLines,
            total: round2(rLines.reduce((a, l) => a + l.refund, 0)),
            reason,
            refundMethod,
            restocked: restock,
          };
          const qtyBy = new Map(rLines.map((l) => [l.productId, l.qty]));
          return log(
            {
              ...s,
              counters: { ...s.counters, return: no },
              returns: [...s.returns, rec],
              products: restock ? s.products.map((p) => (qtyBy.has(p.id) ? { ...p, qty: p.qty + qtyBy.get(p.id)! } : p)) : s.products,
            },
            {
              action: "return",
              entity: "Return",
              entityId: rec.id,
              summary: `${rec.returnNo} against ${sale.invoiceNo} · refund ${money(rec.total)}${restock ? " · restocked" : " · not restocked"}`,
            },
          );
        });
        return rec;
      },

      updateSettings(settings) {
        commit((s) => {
          const changes = diff(s.settings, settings, ["name", "abn", "address", "phone", "email", "receiptFooter", "lowStockDefault"]);
          if (s.settings.logo !== settings.logo) changes.push({ field: "logo", from: s.settings.logo ? "set" : "none", to: settings.logo ? "updated" : "removed" });
          return log({ ...s, settings }, { action: "updated", entity: "Settings", entityId: "shop", summary: "Updated shop settings", changes });
        });
      },

      saveUser(input, id) {
        commit((s) => {
          if (id) {
            const before = s.users.find((u) => u.id === id)!;
            const after = { ...before, ...input, password: input.password || before.password };
            return log(
              { ...s, users: s.users.map((u) => (u.id === id ? after : u)) },
              { action: "updated", entity: "User", entityId: id, summary: `Updated user ${after.name}`, changes: diff(before, after, ["name", "email", "role", "active"]) },
            );
          }
          const u = { ...input, id: uid() };
          return log({ ...s, users: [...s.users, u] }, { action: "created", entity: "User", entityId: u.id, summary: `Added ${u.role} user ${u.name}` });
        });
      },

      resetDemo() {
        const fresh = buildSeed();
        ref.current = fresh;
        setDb(fresh);
      },
    };
  }, [db, user, commit, log, setSession]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}

/** For pages inside the authenticated shell, where the store is guaranteed ready. */
export function useDb() {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store not ready");
  return s;
}

/** Profit for a sale, ex GST: net revenue minus cost of goods. */
export function saleProfit(s: Sale) {
  return round2(exGst(s.total) - s.lines.reduce((a, l) => a + l.unitCost * l.qty, 0));
}

/** Profit impact of a return: lose the ex-GST refund, recover cost only if restocked. */
export function returnProfitImpact(r: SaleReturn) {
  return round2(-exGst(r.total) + (r.restocked ? r.lines.reduce((a, l) => a + l.unitCost * l.qty, 0) : 0));
}
