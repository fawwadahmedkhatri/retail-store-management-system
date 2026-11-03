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
      <aside className="relative hidden overflow-hidden bg-case text-case-ink shadow-[inset_-18px_0_40px_-28px_rgba(0,0,0,0.65)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo light />
        <div className="relative max-w-md">
          <div className="case-scene mb-8 h-36 w-44" aria-hidden="true">
            <div className="case-stack space-y-3">
              <div className="case-tray" />
              <div className="case-tray case-tray-copper" />
              <div className="case-tray" />
            </div>
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">The counter, in one case.</h1>
          <p className="mt-4 text-case-ink/70">
            Stock, the till and GST invoices for a Sydney accessories shop. Open the case and the numbers are already on the shelf.
          </p>
          <ul className="mt-10 space-y-3">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="well-dark flex gap-4 rounded-2xl px-4 py-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_0_#0a3c36]">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-case-ink/65">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-case-ink/50">Sydney retail · AUD incl. GST</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="slab w-full max-w-sm rounded-3xl p-6 sm:p-8">
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

          <div className="well mt-8 rounded-2xl p-4">
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
