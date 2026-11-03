"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { Badge, Button, Card, Input, PageHeader, Pager, Select, Td, Th } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { exportWorkbook } from "@/lib/excel";
import { useDb } from "@/lib/store";
import type { LogAction } from "@/lib/types";

const TONE: Record<LogAction, "ok" | "warn" | "danger" | "brand" | "neutral"> = {
  created: "ok",
  updated: "brand",
  deleted: "danger",
  sale: "neutral",
  return: "warn",
  "stock-in": "ok",
  import: "brand",
  login: "neutral",
};

const PAGE = 50;

export default function ActivityPage() {
  const { db } = useDb();
  const [q, setQ] = useState("");
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [hideRoutine, setHideRoutine] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u.name])), [db.users]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.activity.filter(
      (a) =>
        (!user || a.userId === user) &&
        (!action || a.action === action) &&
        (!hideRoutine || action || (a.action !== "sale" && a.action !== "login")) &&
        (!s || a.summary.toLowerCase().includes(s)),
    );
  }, [db.activity, q, user, action, hideRoutine]);
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <>
      <PageHeader
        title="Activity log"
        sub="Who added, changed or deleted what, and when. Entries can't be edited or removed."
        actions={
          <Button
            onClick={() =>
              exportWorkbook("activity-log.xlsx", [
                {
                  name: "Activity",
                  rows: list.map((a) => ({
                    When: fmtDateTime(a.at),
                    User: users.get(a.userId) ?? a.userId,
                    Action: a.action,
                    Record: a.entity,
                    Summary: a.summary,
                    Changes: (a.changes ?? []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join("; "),
                  })),
                },
              ])
            }
          >
            <Download size={16} /> Export
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Search activity" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
          </div>
          <Select className="w-auto" value={user} onChange={(e) => (setUser(e.target.value), setPage(0))} aria-label="User">
            <option value="">Everyone</option>
            {db.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select className="w-auto" value={action} onChange={(e) => (setAction(e.target.value), setPage(0))} aria-label="Action">
            <option value="">All actions</option>
            {Object.keys(TONE).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 px-2 text-sm text-muted">
            <input type="checkbox" className="accent-[var(--brand)]" checked={hideRoutine} onChange={(e) => (setHideRoutine(e.target.checked), setPage(0))} />
            Hide sales &amp; sign-ins
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-2/60">
              <tr>
                <Th className="w-8" />
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((a) => (
                <Fragment key={a.id}>
                  <tr className={a.changes?.length ? "cursor-pointer hover:bg-surface-2/60" : ""} onClick={() => a.changes?.length && setOpen(open === a.id ? null : a.id)}>
                    <Td className="text-muted">{a.changes?.length ? open === a.id ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}</Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDateTime(a.at)}</Td>
                    <Td className="whitespace-nowrap">{users.get(a.userId) ?? "System"}</Td>
                    <Td>
                      <Badge tone={TONE[a.action]}>
                        {a.action} · {a.entity}
                      </Badge>
                    </Td>
                    <Td>{a.summary}</Td>
                  </tr>
                  {open === a.id && a.changes && (
                    <tr className="bg-surface-2/50">
                      <td />
                      <td colSpan={4} className="px-4 py-3">
                        <table className="text-sm">
                          <tbody>
                            {a.changes.map((c) => (
                              <tr key={c.field}>
                                <td className="pr-4 font-medium">{c.field}</td>
                                <td className="pr-2 text-danger line-through">{c.from || "(empty)"}</td>
                                <td className="pr-2 text-muted">→</td>
                                <td className="text-ok">{c.to || "(empty)"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="py-12 text-center text-sm text-muted">No activity matches.</p>}
        </div>
        <Pager page={page} total={list.length} size={PAGE} onPage={setPage} />
      </Card>
    </>
  );
}
