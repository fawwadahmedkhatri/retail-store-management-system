"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, Barcode, FileSpreadsheet, Lock, ReceiptText, ShieldCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { DEMO_USERS } from "@/lib/seed";
import { useStore } from "@/lib/store";

const POINTS = [
  { icon: ReceiptText, title: "GST-ready tax invoices", body: "ABN, GST breakdown and 80mm thermal receipts on every sale." },
  { icon: Barcode, title: "Scan, sell, done", body: "Works with any USB or Bluetooth barcode scanner. No training needed." },
  { icon: FileSpreadsheet, title: "Bring your Excel across", body: "Import your existing stock list in one go, export reports any time." },
  { icon: ShieldCheck, title: "Yours to keep", body: "Runs on your own hosting. No monthly subscription, no lock-in." },
];

export default function LoginPage() {
  const store = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (store?.user) router.replace(store.isAdmin ? "/dashboard" : "/pos");
  }, [store, router]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    const u = store.login(email, password);
    if (!u) return setError("That email and password don't match. Check and try again.");
    router.replace(u.role === "admin" ? "/dashboard" : "/pos");
  }

  function quick(i: number) {
    setEmail(DEMO_USERS[i].email);
    setPassword(DEMO_USERS[i].password);
    setError("");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <Logo light />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Stock counts you can trust. Profit you can see.</h1>
          <p className="mt-4 text-white/75">
            Inventory, point of sale and invoicing for independent shops, built to replace the spreadsheet.
          </p>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-white/70">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Made for Sydney retail · Prices in AUD incl. GST</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">G&apos;day, sign in to your shop</h2>
          <p className="mt-1 text-sm text-muted">Use your staff email and password.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button variant="primary" size="lg" className="w-full" disabled={!store}>
              <Lock size={16} /> Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-line bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BadgeCheck size={16} className="text-brand" /> Demo accounts
            </div>
            <p className="mt-1 text-xs text-muted">Try both roles to see what staff can and can&apos;t access.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" size="sm" onClick={() => quick(0)}>
                Owner (Admin)
              </Button>
              <Button type="button" size="sm" onClick={() => quick(1)}>
                Staff
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
