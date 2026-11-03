"use client";

import { useState } from "react";
import { money } from "@/lib/format";

export interface BarDatum {
  label: string;
  sub?: string;
  value: number;
  inner?: number;
}

/** Bars show net sales; the darker inner bar shows the profit share of that day/month. */
export function BarChart({ data, height = 220, valueLabel = "Sales", innerLabel = "Profit" }: { data: BarDatum[]; height?: number; valueLabel?: string; innerLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const { nice, steps } = niceScale(max);
  const W = 720;
  const H = height;
  const pad = { l: 52, r: 8, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / data.length;
  const bw = Math.max(3, Math.min(28, step * 0.68));
  const y = (v: number) => pad.t + ih - (v / nice) * ih;
  const ticks = Array.from({ length: steps + 1 }, (_, i) => (i * nice) / steps);
  const every = Math.ceil(data.length / 10);
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${valueLabel} chart`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? "3 4" : undefined} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {t >= 1000 ? `$${+(t / 1000).toFixed(1)}k` : `$${+t.toFixed(0)}`}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * step + (step - bw) / 2;
          const active = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * step} y={pad.t} width={step} height={ih} fill="transparent" />
              <rect x={x} y={y(d.value)} width={bw} height={Math.max(0, y(0) - y(d.value))} rx={Math.min(4, bw / 3)} fill={active ? "#efc3a6" : "#e6d2c2"} />
              {d.inner != null && d.inner > 0 && (
                <rect x={x} y={y(d.inner)} width={bw} height={Math.max(0, y(0) - y(d.inner))} rx={Math.min(4, bw / 3)} fill="var(--brand)" opacity={active ? 1 : 0.9} />
              )}
              {i % every === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((pad.l + (hover! + 0.5) * step) / W) * 100}%` }}
        >
          <div className="font-medium">{h.sub ?? h.label}</div>
          <div className="num mt-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-[#e6d2c2]" /> {valueLabel} {money(h.value)}
          </div>
          {h.inner != null && (
            <div className="num flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm bg-brand" /> {innerLabel} {money(h.inner)}
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#e6d2c2]" /> {valueLabel} (inc GST)
        </span>
        {data.some((d) => d.inner != null) && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> {innerLabel} (ex GST)
          </span>
        )}
      </div>
    </div>
  );
}

/** Round the axis max up to 1/2/2.5/5/10 x 10^n, split into steps that land on round numbers. */
function niceScale(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return { nice: m * p, steps: m === 2 ? 4 : 5 };
}
