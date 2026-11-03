"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Undo2 } from "lucide-react";
import { Badge, Card, Empty, PageHeader, Td, Th } from "@/components/ui";
import { fmtDateTime, money } from "@/lib/format";
import { useDb } from "@/lib/store";

export default function ReturnsPage() {
  const { db } = useDb();
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u.name])), [db.users]);
  const list = [...db.returns].reverse();
  const total = list.reduce((a, r) => a + r.total, 0);

  return (
    <>
      <PageHeader
        title="Returns"
        sub={
          <>
            Every return is linked to its original invoice. To start a new one, open the invoice from{" "}
            <Link href="/sales" className="text-brand underline">
              Invoices
            </Link>{" "}
            and choose <b>Process return</b>.
          </>
        }
      />
      <Card>
        {list.length === 0 ? (
          <Empty icon={<Undo2 size={28} />} title="No returns yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-surface-2/60">
                <tr>
                  <Th>Return</Th>
                  <Th>Original invoice</Th>
                  <Th>Date</Th>
                  <Th>Items</Th>
                  <Th className="hidden md:table-cell">Reason</Th>
                  <Th>Stock</Th>
                  <Th className="hidden md:table-cell">By</Th>
                  <Th right>Refund</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap font-medium">{r.returnNo}</Td>
                    <Td>
                      <Link href={`/sales/view?id=${r.saleId}`} className="text-brand hover:underline">
                        {r.invoiceNo}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDateTime(r.date)}</Td>
                    <Td className="max-w-[260px] truncate">{r.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}</Td>
                    <Td className="hidden text-muted md:table-cell">{r.reason}</Td>
                    <Td>
                      <Badge tone={r.restocked ? "ok" : "neutral"}>{r.restocked ? "Restocked" : "Written off"}</Badge>
                    </Td>
                    <Td className="hidden text-muted md:table-cell">{users.get(r.userId)}</Td>
                    <Td right className="font-medium">
                      -{money(r.total)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.length > 0 && (
          <div className="flex justify-between border-t border-line px-4 py-3 text-sm">
            <span className="font-medium">Total refunded</span>
            <span className="num font-semibold">-{money(total)}</span>
          </div>
        )}
      </Card>
    </>
  );
}
