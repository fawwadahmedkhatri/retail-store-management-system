"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Td, Th, Toast } from "@/components/ui";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import { useDb } from "@/lib/store";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  return (
    <Suspense>
      <Customers />
    </Suspense>
  );
}

function Customers() {
  const store = useDb();
  const { db, isAdmin } = store;
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { spend: number; visits: number; last: string }>();
    for (const s of db.sales) {
      if (!s.customerId) continue;
      const e = m.get(s.customerId) ?? { spend: 0, visits: 0, last: "" };
      e.spend += s.total;
      e.visits += 1;
      if (s.date > e.last) e.last = s.date;
      m.set(s.customerId, e);
    }
    for (const r of db.returns) {
      const sale = db.sales.find((s) => s.id === r.saleId);
      const e = sale?.customerId ? m.get(sale.customerId) : null;
      if (e) e.spend -= r.total;
    }
    return m;
  }, [db.sales, db.returns]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.customers
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")) || c.email.toLowerCase().includes(s))
      .sort((a, b) => (stats.get(b.id)?.last ?? b.createdAt).localeCompare(stats.get(a.id)?.last ?? a.createdAt));
  }, [db.customers, q, stats]);

  const selected = selectedId ? db.customers.find((c) => c.id === selectedId) : null;
  const history = useMemo(() => (selected ? db.sales.filter((s) => s.customerId === selected.id).reverse() : []), [db.sales, selected]);
  const select = (id: string | null) => router.replace(id ? `/customers?id=${id}` : "/customers", { scroll: false });

  return (
    <>
      <PageHeader
        title="Customers"
        sub={`${db.customers.length} saved customers`}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Add customer
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card className={selected ? "hidden lg:block" : ""}>
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Search name, mobile or email" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {list.length === 0 ? (
            <Empty icon={<Users size={28} />} title="No customers found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-surface-2/60">
                  <tr>
                    <Th>Customer</Th>
                    <Th className="hidden sm:table-cell">Suburb</Th>
                    <Th right>Visits</Th>
                    <Th right>Spend</Th>
                    <Th className="hidden md:table-cell">Last visit</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((c) => {
                    const s = stats.get(c.id);
                    return (
                      <tr key={c.id} onClick={() => select(c.id)} className={`cursor-pointer hover:bg-surface-2/60 ${c.id === selectedId ? "bg-brand-soft/60" : ""}`}>
                        <Td>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted">{c.phone}</div>
                        </Td>
                        <Td className="hidden text-muted sm:table-cell">{c.suburb.replace(/ NSW \d+$/, "")}</Td>
                        <Td right>{s?.visits ?? 0}</Td>
                        <Td right className="font-medium">
                          {money(s?.spend ?? 0)}
                        </Td>
                        <Td className="hidden text-muted md:table-cell">{s ? fmtDate(s.last) : "–"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selected ? (
          <Card className="self-start lg:sticky lg:top-8">
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <div className="mt-1 space-y-0.5 text-sm text-muted">
                  {selected.phone && <div>{selected.phone}</div>}
                  {selected.email && <div>{selected.email}</div>}
                  {selected.suburb && <div>{selected.suburb}</div>}
                </div>
                {selected.notes && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">{selected.notes}</p>}
              </div>
              <div className="flex gap-1">
                <button className="rounded-lg p-2 text-muted hover:bg-surface-2" onClick={() => setEditing(selected)} aria-label="Edit customer">
                  <Pencil size={16} />
                </button>
                {isAdmin && (
                  <button className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger" onClick={() => setDeleting(selected)} aria-label="Delete customer">
                    <Trash2 size={16} />
                  </button>
                )}
                <button className="rounded-lg p-2 text-muted hover:bg-surface-2" onClick={() => select(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
              <div className="p-3">
                <div className="num text-lg font-semibold">{stats.get(selected.id)?.visits ?? 0}</div>
                <div className="text-xs text-muted">Visits</div>
              </div>
              <div className="p-3">
                <div className="num text-lg font-semibold">{money(stats.get(selected.id)?.spend ?? 0)}</div>
                <div className="text-xs text-muted">Lifetime spend</div>
              </div>
              <div className="p-3">
                <div className="num text-lg font-semibold">{fmtDate(selected.createdAt)}</div>
                <div className="text-xs text-muted">Customer since</div>
              </div>
            </div>
            <div className="px-5 pb-2 pt-4 text-sm font-medium">Purchase history</div>
            {history.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">No purchases yet.</p>
            ) : (
              <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
                {history.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sales/view?id=${s.id}`} className="block px-5 py-3 hover:bg-surface-2/60">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-brand">{s.invoiceNo}</span>
                        <span className="num font-medium">{money(s.total)}</span>
                      </div>
                      <div className="text-xs text-muted">{fmtDateTime(s.date)}</div>
                      <div className="mt-1 truncate text-xs text-muted">{s.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card className="hidden self-start p-8 text-center text-sm text-muted lg:block">Select a customer to see their details and purchase history.</Card>
        )}
      </div>

      {editing && (
        <CustomerModal
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            setEditing(null);
            setToast(`Saved ${c.name}`);
            select(c.id);
          }}
        />
      )}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete customer?"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Keep</Button>
            <Button
              variant="danger"
              onClick={() => {
                store.deleteCustomer(deleting!.id);
                setToast(`Deleted ${deleting!.name}`);
                setDeleting(null);
                select(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm">
          <b>{deleting?.name}</b> will be removed. Their past invoices are kept for your records.
        </p>
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function CustomerModal({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: (c: Customer) => void }) {
  const store = useDb();
  const [f, setF] = useState({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    suburb: customer?.suburb ?? "",
    notes: customer?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? "Edit customer" : "Add customer"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!f.name.trim()} onClick={() => onSaved(store.saveCustomer({ ...f, name: f.name.trim() }, customer?.id))}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2">
          <Input autoFocus value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Mobile">
          <Input inputMode="tel" placeholder="04xx xxx xxx" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Suburb" className="sm:col-span-2">
          <Input placeholder="e.g. Parramatta NSW 2150" value={f.suburb} onChange={set("suburb")} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input placeholder="e.g. Trade customer, prefers invoices by email" value={f.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}
