"use client";

import { useRef, useState } from "react";
import { ImagePlus, RotateCcw, UserPlus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Td, Th, Toast } from "@/components/ui";
import { Receipt } from "@/components/Receipt";
import { useDb } from "@/lib/store";
import type { Role, ShopSettings, User } from "@/lib/types";

export default function SettingsPage() {
  const store = useDb();
  const { db } = store;
  const [s, setS] = useState<ShopSettings>(db.settings);
  const [toast, setToast] = useState<string | null>(null);
  const [userModal, setUserModal] = useState<User | "new" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof ShopSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS({ ...s, [k]: k === "lowStockDefault" ? Number(e.target.value) || 0 : e.target.value });

  function onLogo(f: File | undefined) {
    if (!f) return;
    if (f.size > 500_000) return setToast("Logo must be under 500 KB");
    const r = new FileReader();
    r.onload = () => setS((x) => ({ ...x, logo: String(r.result) }));
    r.readAsDataURL(f);
  }

  const preview = db.sales[db.sales.length - 1];

  return (
    <>
      <PageHeader title="Settings" sub="Shop details printed on every tax invoice, and who can sign in." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Shop details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trading name">
                <Input value={s.name} onChange={set("name")} />
              </Field>
              <Field label="ABN" hint="Required on tax invoices.">
                <Input value={s.abn} onChange={set("abn")} placeholder="12 345 678 901" />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={s.address} onChange={set("address")} />
              </Field>
              <Field label="Phone">
                <Input value={s.phone} onChange={set("phone")} />
              </Field>
              <Field label="Email">
                <Input value={s.email} onChange={set("email")} />
              </Field>
              <Field label="Receipt footer" className="sm:col-span-2" hint="Returns policy, thank-you note, socials.">
                <Input value={s.receiptFooter} onChange={set("receiptFooter")} />
              </Field>
              <Field label="Default low-stock alert" hint="Used for new and imported products.">
                <Input type="number" value={s.lowStockDefault} onChange={set("lowStockDefault")} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium">Logo</span>
                <div className="flex items-center gap-3">
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt="Shop logo" className="h-10 w-auto max-w-[120px] rounded border border-line object-contain" />
                  ) : null}
                  <Button type="button" onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={16} /> {s.logo ? "Replace" : "Upload"}
                  </Button>
                  {s.logo && (
                    <Button variant="ghost" onClick={() => setS({ ...s, logo: null })}>
                      Remove
                    </Button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                variant="primary"
                onClick={() => {
                  store.updateSettings(s);
                  setToast("Settings saved");
                }}
              >
                Save changes
              </Button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold">Staff accounts</h2>
              <Button size="sm" onClick={() => setUserModal("new")}>
                <UserPlus size={14} /> Add staff
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-surface-2/60">
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {db.users.map((u) => (
                    <tr key={u.id}>
                      <Td className="font-medium">{u.name}</Td>
                      <Td className="text-muted">{u.email}</Td>
                      <Td>
                        <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{u.role === "admin" ? "Admin" : "Staff"}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={u.active ? "ok" : "danger"}>{u.active ? "Active" : "Disabled"}</Badge>
                      </Td>
                      <Td right>
                        <Button size="sm" variant="ghost" onClick={() => setUserModal(u)}>
                          Edit
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-5 py-3 text-xs text-muted">
              <b>Admin</b>: everything. <b>Staff</b>: sales, returns, customers and stock-in. Staff can&apos;t change prices or see costs, profit, reports or this page.
            </p>
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h2 className="font-semibold">Reset demo data</h2>
              <p className="text-sm text-muted">Restores the 600 sample products and 90 days of sample sales.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={16} /> Reset
            </Button>
          </Card>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-muted">Receipt preview</div>
          {preview && <Receipt db={{ ...db, settings: s }} sale={preview} />}
        </div>
      </div>

      {userModal && (
        <UserModal
          user={userModal === "new" ? null : userModal}
          onClose={() => setUserModal(null)}
          onSaved={() => {
            setUserModal(null);
            setToast("User saved");
          }}
        />
      )}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all demo data?"
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                store.resetDemo();
                setConfirmReset(false);
                setToast("Demo data restored");
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm">Any products, sales and customers you added in this browser will be replaced with the sample data.</p>
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function UserModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const store = useDb();
  const [f, setF] = useState({ name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? ("staff" as Role), active: user?.active ?? true, password: "" });
  const self = user?.id === store.user?.id;
  const valid = f.name.trim() && f.email.includes("@") && (user || f.password.length >= 8);
  return (
    <Modal
      open
      onClose={onClose}
      title={user ? "Edit user" : "Add staff member"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              store.saveUser({ ...f, name: f.name.trim(), email: f.email.trim() }, user?.id);
              onSaved();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.active ? "1" : "0"} disabled={self} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
            <option value="1">Active</option>
            <option value="0">Disabled</option>
          </Select>
        </Field>
        <Field label={user ? "New password" : "Password"} hint={user ? "Leave blank to keep the current one." : "At least 8 characters."} className="sm:col-span-2">
          <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
