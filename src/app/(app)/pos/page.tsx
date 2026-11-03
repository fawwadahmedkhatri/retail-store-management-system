"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Building2, CreditCard, Minus, Plus, Printer, ScanBarcode, Trash2, UserPlus, X } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Select, Toast, cx } from "@/components/ui";
import { Receipt } from "@/components/Receipt";
import { money, round2 } from "@/lib/format";
import { cartTotals, useDb, type CartLine } from "@/lib/store";
import type { PaymentMethod, Sale } from "@/lib/types";

const PAYMENTS: { id: PaymentMethod; label: string; icon: typeof CreditCard; key: string }[] = [
  { id: "Card", label: "EFTPOS / Card", icon: CreditCard, key: "F6" },
  { id: "Cash", label: "Cash", icon: Banknote, key: "F7" },
  { id: "Bank Transfer", label: "Bank transfer", icon: Building2, key: "F8" },
];

export default function PosPage() {
  const store = useDb();
  const { db } = store;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState("");
  const [discountMode, setDiscountMode] = useState<"$" | "%">("%");
  const [payment, setPayment] = useState<PaymentMethod>("Card");
  const [tendered, setTendered] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [done, setDone] = useState<Sale | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ["All", ...new Set(db.products.map((p) => p.category))], [db.products]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.products
      .filter((p) => (category === "All" || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)))
      .slice(0, 60);
  }, [db.products, query, category]);

  function add(productId: string) {
    const p = db.products.find((x) => x.id === productId);
    if (!p) return;
    const inCart = cart.find((l) => l.product.id === p.id)?.qty ?? 0;
    if (inCart + 1 > p.qty) setToast(`Heads up: only ${Math.max(0, p.qty)} of ${p.name} in stock`);
    setCart((c) =>
      c.some((l) => l.product.id === p.id) ? c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { product: p, qty: 1, discount: 0 }],
    );
  }

  // Barcode scanners type the code then press Enter: exact barcode/SKU match adds straight to cart.
  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact = db.products.find((p) => p.barcode === q || p.sku.toLowerCase() === q);
    const hit = exact ?? (results.length === 1 ? results[0] : null);
    if (hit) {
      add(hit.id);
      setQuery("");
    } else setToast(`No product matches "${query}"`);
  }

  const lines = cart.map((l) => ({ ...l, unitPrice: l.product.price }));
  const pre = cartTotals(lines, 0);
  const cartDiscValue = round2(
    discountMode === "%" ? (pre.subtotal * Math.min(100, Number(cartDiscount) || 0)) / 100 : Math.min(pre.subtotal, Number(cartDiscount) || 0),
  );
  const totals = cartTotals(lines, cartDiscValue);
  const change = payment === "Cash" && Number(tendered) ? round2(Number(tendered) - totals.total) : null;
  const canPay = cart.length > 0 && (payment !== "Cash" || !tendered || Number(tendered) >= totals.total);

  function pay() {
    if (!canPay) return;
    const sale = store.checkout({
      lines: cart,
      cartDiscount: cartDiscValue,
      customerId: customerId || null,
      payment,
      tendered: payment === "Cash" ? Number(tendered) || totals.total : null,
    });
    setDone(sale);
    setCart([]);
    setCartDiscount("");
    setTendered("");
    setCustomerId("");
  }

  // Keyboard shortcuts always call the latest pay() without re-binding the listener.
  const payRef = useRef(pay);
  useEffect(() => {
    payRef.current = pay;
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        scanRef.current?.focus();
      }
      const p = PAYMENTS.find((x) => x.key === e.key);
      if (p) {
        e.preventDefault();
        setPayment(p.id);
      }
      if (e.key === "F9") {
        e.preventDefault();
        payRef.current();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const setLine = (id: string, patch: Partial<CartLine>) =>
    setCart((c) => c.map((l) => (l.product.id === id ? { ...l, ...patch } : l)).filter((l) => l.qty > 0));

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px] xl:grid-cols-[1fr_400px]">
      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">New sale</h1>
          <span className="hidden text-xs text-muted xl:inline">F2 scan · F6–F8 payment · F9 complete sale</span>
        </div>
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand" size={20} />
          <Input
            ref={scanRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onScan}
            placeholder="Scan a barcode or search by name / SKU…"
            className="h-12 pl-11 text-base"
            aria-label="Scan or search products"
          />
          {query && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cx(
                "min-h-10 whitespace-nowrap rounded-xl px-3 text-sm",
                category === c ? "keycap-brand" : "keycap text-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              className="tile flex flex-col rounded-2xl p-3 text-left"
            >
              <span className="text-[11px] uppercase tracking-wide text-muted">{p.category}</span>
              <span className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{p.name}</span>
              <span className="mt-3 flex items-end justify-between gap-2">
                <span className="num text-base font-semibold">{money(p.price)}</span>
                {p.qty <= 0 ? (
                  <Badge tone="danger">Out</Badge>
                ) : p.qty <= p.reorderLevel ? (
                  <Badge tone="warn">{p.qty} left</Badge>
                ) : (
                  <span className="text-xs text-muted">{p.qty} in stock</span>
                )}
              </span>
            </button>
          ))}
        </div>
        {results.length === 0 && <p className="py-10 text-center text-sm text-muted">No products found.</p>}
      </section>

      <section className="md:sticky md:top-20 md:self-start lg:top-8">
        <div className="slab flex flex-col rounded-3xl md:max-h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-4rem)]">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Customer">
              <option value="">Walk-in customer</option>
              {db.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </Select>
            <Button onClick={() => setNewCustomer(true)} aria-label="Add customer" title="Add customer">
              <UserPlus size={16} />
            </Button>
          </div>

          <div className="min-h-[140px] flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-muted">
                <ScanBarcode size={28} className="mb-2" />
                Scan an item or tap a product to start the sale.
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {cart.map((l) => (
                  <li key={l.product.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">{l.product.name}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {l.product.sku} · {money(l.product.price)} ea
                        </div>
                      </div>
                      <div className="num text-right text-sm font-semibold">
                        {money(l.product.price * l.qty - l.discount)}
                        {l.discount > 0 && <div className="text-xs font-normal text-ok">-{money(l.discount)}</div>}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-line">
                        <button className="p-2 text-muted hover:text-ink" onClick={() => setLine(l.product.id, { qty: l.qty - 1, discount: 0 })} aria-label="Decrease quantity">
                          <Minus size={14} />
                        </button>
                        <span className="num w-8 text-center text-sm font-medium">{l.qty}</span>
                        <button className="p-2 text-muted hover:text-ink" onClick={() => setLine(l.product.id, { qty: l.qty + 1, discount: 0 })} aria-label="Increase quantity">
                          <Plus size={14} />
                        </button>
                      </div>
                      <select
                        className="h-9 rounded-lg border border-line bg-surface px-2 text-xs text-muted"
                        value={l.discount ? String(Math.round((l.discount / (l.product.price * l.qty)) * 100)) : "0"}
                        onChange={(e) => setLine(l.product.id, { discount: round2((l.product.price * l.qty * Number(e.target.value)) / 100) })}
                        aria-label="Line discount"
                      >
                        {[0, 5, 10, 15, 20, 25, 50].map((d) => (
                          <option key={d} value={d}>
                            {d ? `${d}% off` : "No discount"}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ml-auto rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
                        onClick={() => setLine(l.product.id, { qty: 0 })}
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-line p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Sale discount</span>
              <div className="ml-auto flex items-center gap-1">
                <Input
                  className="h-9 w-20 text-right"
                  inputMode="decimal"
                  value={cartDiscount}
                  onChange={(e) => setCartDiscount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  aria-label="Sale discount"
                />
                <div className="flex rounded-lg border border-line p-0.5">
                  {(["%", "$"] as const).map((m) => (
                    <button key={m} onClick={() => setDiscountMode(m)} className={cx("h-7 w-7 rounded-md text-sm", discountMode === m ? "bg-ink text-white" : "text-muted")}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <dl className="num space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <dt>Subtotal</dt>
                <dd>{money(pre.subtotal)}</dd>
              </div>
              {cartDiscValue > 0 && (
                <div className="flex justify-between text-ok">
                  <dt>Discount</dt>
                  <dd>-{money(cartDiscValue)}</dd>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <dt>GST included</dt>
                <dd>{money(totals.gst)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1 text-2xl font-semibold text-ink">
                <dt className="text-base">Total</dt>
                <dd>{money(totals.total)}</dd>
              </div>
            </dl>

            <div className="grid grid-cols-3 gap-2">
              {PAYMENTS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPayment(id)}
                  className={cx(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium",
                    payment === id ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-ink",
                  )}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>

            {payment === "Cash" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Cash received"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value.replace(/[^0-9.]/g, ""))}
                    aria-label="Cash received"
                  />
                  {[20, 50, 100].map((n) => (
                    <Button key={n} onClick={() => setTendered(String(n))} className="px-3">
                      ${n}
                    </Button>
                  ))}
                </div>
                {change != null && (
                  <div className={cx("flex justify-between rounded-lg px-3 py-2 text-sm font-medium", change >= 0 ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
                    <span>{change >= 0 ? "Change to give" : "Still owing"}</span>
                    <span className="num">{money(Math.abs(change))}</span>
                  </div>
                )}
              </div>
            )}

            <Button variant="primary" size="lg" className="w-full text-base" disabled={!canPay} onClick={pay}>
              Complete sale · {money(totals.total)}
            </Button>
          </div>
        </div>
      </section>

      <Modal
        open={!!done}
        onClose={() => setDone(null)}
        title={`Sale complete · ${done?.invoiceNo ?? ""}`}
        footer={
          <>
            <Button onClick={() => setDone(null)}>New sale</Button>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={16} /> Print receipt
            </Button>
          </>
        }
      >
        {done && (
          <div className="bg-surface-2 py-4">
            <Receipt db={db} sale={done} />
          </div>
        )}
      </Modal>

      <QuickCustomer
        open={newCustomer}
        onClose={() => setNewCustomer(false)}
        onCreate={(id) => {
          setCustomerId(id);
          setNewCustomer(false);
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function QuickCustomer({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (id: string) => void }) {
  const store = useDb();
  const [f, setF] = useState({ name: "", phone: "", email: "" });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add customer"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!f.name.trim()}
            onClick={() => {
              const c = store.saveCustomer({ ...f, suburb: "", notes: "" });
              setF({ name: "", phone: "", email: "" });
              onCreate(c.id);
            }}
          >
            Save & attach to sale
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Full name">
          <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Mobile">
          <Input inputMode="tel" placeholder="04xx xxx xxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Email" hint="For emailed receipts and warranty follow-ups.">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
