"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Lock, PackagePlus, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Pager, Select, Td, Th, Toast, cx } from "@/components/ui";
import { exGst, money } from "@/lib/format";
import { downloadTemplate, exportWorkbook, parseProductFile, type ImportResult } from "@/lib/excel";
import { useDb } from "@/lib/store";
import type { Product } from "@/lib/types";

const PAGE = 50;
type StockFilter = "all" | "low" | "out";

export default function InventoryPage() {
  const store = useDb();
  const { db, isAdmin } = store;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [receiving, setReceiving] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(db.products.map((p) => p.category))].sort(), [db.products]);
  const low = db.products.filter((p) => p.qty > 0 && p.qty <= p.reorderLevel).length;
  const out = db.products.filter((p) => p.qty <= 0).length;
  const stockValue = db.products.reduce((a, p) => a + Math.max(0, p.qty) * p.cost, 0);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.products
      .filter((p) => {
        if (cat && p.category !== cat) return false;
        if (stock === "low" && !(p.qty > 0 && p.qty <= p.reorderLevel)) return false;
        if (stock === "out" && p.qty > 0) return false;
        return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode.includes(s) || p.brand.toLowerCase().includes(s);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db.products, q, cat, stock]);
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);

  async function exportProducts() {
    await exportWorkbook(`stock-list-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        name: "Products",
        rows: list.map((p) => ({
          SKU: p.sku,
          Barcode: p.barcode,
          Name: p.name,
          Category: p.category,
          Brand: p.brand,
          ...(isAdmin ? { "Buy ex GST": p.cost } : {}),
          "Sell inc GST": p.price,
          Qty: p.qty,
          "Reorder level": p.reorderLevel,
        })),
      },
    ]);
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        sub={`${db.products.length.toLocaleString("en-AU")} products${isAdmin ? ` · stock on hand worth ${money(stockValue)} at cost` : ""}`}
        actions={
          <>
            <Button onClick={exportProducts}>
              <Download size={16} /> Export
            </Button>
            {isAdmin && (
              <>
                <Button onClick={() => setImporting(true)}>
                  <Upload size={16} /> Import Excel
                </Button>
                <Button variant="primary" onClick={() => setEditing("new")}>
                  <Plus size={16} /> Add product
                </Button>
              </>
            )}
          </>
        }
      />

      {(low > 0 || out > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          <AlertTriangle size={18} />
          <span>
            <b>{low}</b> running low and <b>{out}</b> out of stock.
          </span>
          <button className="ml-auto font-medium underline" onClick={() => (setStock("low"), setPage(0))}>
            Show what to reorder
          </button>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Search name, SKU, brand or scan barcode" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
          </div>
          <Select className="w-auto" value={cat} onChange={(e) => (setCat(e.target.value), setPage(0))} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <div className="flex rounded-lg border border-line p-0.5">
            {(
              [
                ["all", "All"],
                ["low", `Low (${low})`],
                ["out", `Out (${out})`],
              ] as [StockFilter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => (setStock(k), setPage(0))}
                className={cx("rounded-md px-3 py-1.5 text-sm", stock === k ? "bg-ink text-white" : "text-muted hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-2/60">
              <tr>
                <Th>Product</Th>
                <Th className="hidden lg:table-cell">Barcode</Th>
                <Th className="hidden md:table-cell">Category</Th>
                {isAdmin && <Th right>Buy (ex)</Th>}
                <Th right>Sell (inc)</Th>
                {isAdmin && (
                  <Th right className="hidden md:table-cell">
                    Margin
                  </Th>
                )}
                <Th right>On hand</Th>
                <Th right>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((p) => {
                const margin = exGst(p.price) > 0 ? (exGst(p.price) - p.cost) / exGst(p.price) : 0;
                return (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <Td>
                      <div className="font-medium leading-tight">{p.name}</div>
                      <div className="text-xs text-muted">{p.sku}</div>
                    </Td>
                    <Td className="hidden font-mono text-xs text-muted lg:table-cell">{p.barcode}</Td>
                    <Td className="hidden text-muted md:table-cell">{p.category}</Td>
                    {isAdmin && (
                      <Td right className="text-muted">
                        {money(p.cost)}
                      </Td>
                    )}
                    <Td right className="font-medium">
                      {money(p.price)}
                    </Td>
                    {isAdmin && (
                      <Td right className={cx("hidden md:table-cell", margin < 0.3 ? "text-warn" : "text-muted")}>
                        {(margin * 100).toFixed(0)}%
                      </Td>
                    )}
                    <Td right>
                      {p.qty <= 0 ? (
                        <Badge tone="danger">{p.qty} · Out</Badge>
                      ) : p.qty <= p.reorderLevel ? (
                        <Badge tone="warn">{p.qty} · Low</Badge>
                      ) : (
                        <span className="num">{p.qty}</span>
                      )}
                    </Td>
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <IconBtn label="Receive stock" onClick={() => setReceiving(p)}>
                          <PackagePlus size={16} />
                        </IconBtn>
                        <IconBtn label="Edit" onClick={() => setEditing(p)}>
                          <Pencil size={16} />
                        </IconBtn>
                        {isAdmin && (
                          <IconBtn label="Delete" danger onClick={() => setDeleting(p)}>
                            <Trash2 size={16} />
                          </IconBtn>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="py-12 text-center text-sm text-muted">No products match those filters.</p>}
        </div>
        <Pager page={page} total={list.length} size={PAGE} onPage={setPage} />
      </Card>

      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setEditing(null);
            setToast(`Saved ${p.name}`);
          }}
        />
      )}
      {receiving && (
        <ReceiveModal
          product={receiving}
          onClose={() => setReceiving(null)}
          onDone={(n) => {
            setReceiving(null);
            setToast(`Added ${n} to stock`);
          }}
        />
      )}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete product?"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                store.deleteProduct(deleting!.id);
                setToast(`Deleted ${deleting!.name}`);
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm">
          <b>{deleting?.name}</b> will be removed from the catalogue. Past invoices keep their copy of the item, and this is recorded in the activity log.
        </p>
      </Modal>
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={(m) => {
            setImporting(false);
            setToast(m);
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx("rounded-lg p-2 text-muted", danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-surface-2 hover:text-ink")}
    >
      {children}
    </button>
  );
}

function ProductModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: (p: Product) => void }) {
  const store = useDb();
  const { isAdmin, db } = store;
  const [f, setF] = useState(() => ({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    category: product?.category ?? "",
    brand: product?.brand ?? "",
    cost: String(product?.cost ?? ""),
    price: String(product?.price ?? ""),
    qty: String(product?.qty ?? 0),
    reorderLevel: String(product?.reorderLevel ?? db.settings.lowStockDefault),
  }));
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const categories = useMemo(() => [...new Set(db.products.map((p) => p.category))].sort(), [db.products]);
  const cost = Number(f.cost) || 0;
  const price = Number(f.price) || 0;
  const margin = exGst(price) > 0 ? (exGst(price) - cost) / exGst(price) : 0;

  function save() {
    if (!f.name.trim() || !f.sku.trim()) return setErr("Name and SKU are required.");
    if (isAdmin && price <= 0) return setErr("Enter a selling price.");
    const dupe = db.products.find(
      (p) => p.id !== product?.id && (p.sku.toLowerCase() === f.sku.trim().toLowerCase() || (f.barcode.trim() && p.barcode === f.barcode.trim())),
    );
    if (dupe) return setErr(`That SKU or barcode is already used by ${dupe.name}.`);
    const saved = store.saveProduct(
      {
        name: f.name.trim(),
        sku: f.sku.trim(),
        barcode: f.barcode.trim(),
        category: f.category.trim() || "Uncategorised",
        brand: f.brand.trim(),
        cost,
        price,
        qty: Math.round(Number(f.qty) || 0),
        reorderLevel: Math.round(Number(f.reorderLevel) || 0),
      },
      product?.id,
    );
    onSaved(saved);
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={product ? "Edit product" : "Add product"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save product
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" className="sm:col-span-2">
          <Input autoFocus value={f.name} onChange={set("name")} />
        </Field>
        <Field label="SKU">
          <Input value={f.sku} onChange={set("sku")} />
        </Field>
        <Field label="Barcode" hint="Click here and scan the item to fill it in.">
          <Input value={f.barcode} onChange={set("barcode")} className="font-mono" />
        </Field>
        <Field label="Category">
          <Input list="cats" value={f.category} onChange={set("category")} />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Brand">
          <Input value={f.brand} onChange={set("brand")} />
        </Field>
        {isAdmin ? (
          <>
            <Field label="Buying price (ex GST)">
              <Input inputMode="decimal" value={f.cost} onChange={set("cost")} />
            </Field>
            <Field label="Selling price (inc GST)" hint={price > 0 ? `Margin ${(margin * 100).toFixed(0)}% · GST ${money(price / 11)}` : undefined}>
              <Input inputMode="decimal" value={f.price} onChange={set("price")} />
            </Field>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted sm:col-span-2">
            <Lock size={14} /> Selling price {money(price)} · only the owner can change prices.
          </div>
        )}
        <Field label={product ? "On hand" : "Opening stock"} hint={product ? "Use Receive stock for deliveries so they're tracked." : undefined}>
          <Input type="number" value={f.qty} onChange={set("qty")} />
        </Field>
        <Field label="Low-stock alert at">
          <Input type="number" value={f.reorderLevel} onChange={set("reorderLevel")} />
        </Field>
      </div>
      {err && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
    </Modal>
  );
}

function ReceiveModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (n: number) => void }) {
  const store = useDb();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(product.cost));
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const n = Math.round(Number(qty) || 0);
  return (
    <Modal
      open
      onClose={onClose}
      title="Receive stock"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={n <= 0}
            onClick={() => {
              store.receiveStock({ productId: product.id, qty: n, cost: Number(cost) || product.cost, supplier, reference });
              onDone(n);
            }}
          >
            Add {n > 0 ? n : ""} to stock
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-lg bg-surface-2 p-3 text-sm">
        <div className="font-medium">{product.name}</div>
        <div className="text-muted">
          {product.sku} · currently {product.qty} on hand
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantity received">
          <Input autoFocus type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        {store.isAdmin && (
          <Field label="Unit cost (ex GST)" hint="Updates the product's buying price.">
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
        <Field label="Supplier">
          <Input placeholder="e.g. Anker AU" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field label="Invoice / PO number">
          <Input placeholder="e.g. PO-2291" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const store = useDb();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setBusy(true);
    setErr("");
    try {
      setResult(await parseProductFile(f, store.db.settings.lowStockDefault));
    } catch {
      setErr("We couldn't read that file. Save it as .xlsx or .csv and try again.");
      setResult(null);
    }
    setBusy(false);
  }

  const existing = new Set(store.db.products.map((p) => p.sku.toLowerCase()));
  const updates = result?.rows.filter((r) => existing.has(r.sku.toLowerCase())).length ?? 0;
  const missingRequired = !!result && (!result.mapped.sku || !result.mapped.name || !result.mapped.price);

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Import products from Excel"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!result?.rows.length || missingRequired}
            onClick={() => {
              const r = store.importProducts(result!.rows, file!.name);
              onDone(`Imported: ${r.created} new, ${r.updated} updated`);
            }}
          >
            Import {result?.rows.length ?? ""} products
          </Button>
        </>
      }
    >
      <div
        className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-line px-6 py-8 text-center hover:border-brand"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
      >
        <FileSpreadsheet size={32} className="text-brand" />
        <div className="mt-2 font-medium">{file ? file.name : "Drop your stock spreadsheet here"}</div>
        <div className="text-sm text-muted">.xlsx, .xls or .csv · first sheet is used · existing SKUs are updated, new ones added</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <button className="mt-2 text-sm text-brand underline" onClick={downloadTemplate}>
        Download a template
      </button>

      {busy && <p className="mt-4 text-sm text-muted">Reading file…</p>}
      {err && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
      {result && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-ok-soft p-3">
              <div className="num text-xl font-semibold text-ok">{result.rows.length - updates}</div>
              <div className="text-xs text-ok">new products</div>
            </div>
            <div className="rounded-lg bg-brand-soft p-3">
              <div className="num text-xl font-semibold text-brand">{updates}</div>
              <div className="text-xs text-brand">will be updated</div>
            </div>
            <div className={cx("rounded-lg p-3", result.errors.length ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>
              <div className="num text-xl font-semibold">{result.errors.length}</div>
              <div className="text-xs">rows to check</div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Columns we matched</div>
            <div className="flex flex-wrap gap-1.5">
              {(["sku", "name", "barcode", "category", "brand", "cost", "price", "qty", "reorderLevel"] as const).map((k) => (
                <Badge key={k} tone={result.mapped[k] ? "ok" : ["sku", "name", "price"].includes(k) ? "danger" : "neutral"}>
                  {k} {result.mapped[k] ? `← "${result.mapped[k]}"` : "not found"}
                </Badge>
              ))}
            </div>
            {missingRequired && <p className="mt-2 text-sm text-danger">SKU, name and sell price columns are required. Rename your headers or use the template.</p>}
          </div>
          {result.errors.length > 0 && (
            <ul className="max-h-32 overflow-y-auto rounded-lg border border-line p-3 text-xs text-muted">
              {result.errors.slice(0, 50).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
