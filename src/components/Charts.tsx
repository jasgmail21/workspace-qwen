import React, { useState } from "react";
import { fmtMoney } from "../utils";
import { Dot, useMounted } from "./ui";

/* ================= Donut ================= */

export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  currency,
  size = 218,
  thickness = 27,
  hovered,
  onHover,
  onClick,
}: {
  segments: DonutSeg[];
  currency: string;
  size?: number;
  thickness?: number;
  hovered: number | null;
  onHover: (i: number | null) => void;
  onClick?: (i: number) => void;
}) {
  const mounted = useMounted(60);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness - 8) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const active = hovered !== null ? segments[hovered] : null;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line-soft)"
          strokeWidth={thickness}
        />
        {segments.map((s, i) => {
          const len = total > 0 ? (s.value / total) * C : 0;
          const off = -acc;
          acc += len;
          const isActive = hovered === i;
          const dimmed = hovered !== null && hovered !== i;
          return (
            <circle
              key={s.label + i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={isActive ? thickness + 7 : thickness}
              strokeDasharray={`${mounted ? len : 0} ${C}`}
              strokeDashoffset={off}
              style={{
                transition: `stroke-dasharray 0.9s cubic-bezier(0.2,0.7,0.2,1) ${i * 70}ms, stroke-width 0.18s ease, opacity 0.18s ease`,
                opacity: dimmed ? 0.28 : 1,
                cursor: "pointer",
              }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClick?.(i)}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {active ? (
          <>
            <span className="max-w-[60%] truncate text-[12px] font-semibold text-ink-soft">
              {active.label}
            </span>
            <span className="num text-xl font-bold text-ink">{fmtMoney(active.value, currency)}</span>
            <span className="num text-[12px] text-ink-faint">
              {total > 0 ? ((active.value / total) * 100).toFixed(1) : 0}%
            </span>
          </>
        ) : (
          <>
            <span className="stamp text-ink-faint">Spent</span>
            <span className="num mt-0.5 text-2xl font-bold text-ink">{fmtMoney(total, currency)}</span>
            <span className="text-[12px] text-ink-faint">{segments.length} categories</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= Income vs expense bars ================= */

export function FlowBars({
  data,
  currency,
}: {
  data: { key: string; label: string; income: number; expense: number; current?: boolean }[];
  currency: string;
}) {
  const mounted = useMounted(120);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));

  return (
    <div>
      <div className="flex h-44 items-end gap-1.5 sm:gap-3">
        {data.map((d, i) => (
          <div
            key={d.key}
            className="group relative flex h-full flex-1 flex-col justify-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && (
              <div className="anim-fade pointer-events-none absolute -top-1 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg border border-pine-3 bg-pine px-3 py-2 text-[12px] leading-5 text-mint-dim shadow-lg">
                <span className="flex items-center gap-1.5">
                  <Dot color="var(--color-mint)" size={7} /> In
                  <b className="num">{fmtMoney(d.income, currency)}</b>
                </span>
                <span className="flex items-center gap-1.5">
                  <Dot color="var(--color-coral)" size={7} /> Out
                  <b className="num">{fmtMoney(d.expense, currency)}</b>
                </span>
              </div>
            )}
            <div className="flex h-full items-end justify-center gap-1 sm:gap-1.5">
              <div
                className="w-3 rounded-t-[5px] bg-moss sm:w-4"
                style={{
                  height: mounted ? `${(d.income / max) * 100}%` : "0%",
                  transition: `height 0.7s cubic-bezier(0.2,0.7,0.2,1) ${i * 70}ms`,
                }}
              />
              <div
                className="w-3 rounded-t-[5px] bg-coral/85 sm:w-4"
                style={{
                  height: mounted ? `${(d.expense / max) * 100}%` : "0%",
                  transition: `height 0.7s cubic-bezier(0.2,0.7,0.2,1) ${i * 70 + 40}ms`,
                }}
              />
            </div>
            <span
              className={`mt-2 text-center text-[11px] font-medium ${
                d.current ? "font-bold text-ink" : "text-ink-faint"
              }`}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-5 border-t border-dashed border-line pt-3 text-[12px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <Dot color="var(--color-moss)" size={9} /> Money in
        </span>
        <span className="flex items-center gap-1.5">
          <Dot color="var(--color-coral)" size={9} /> Money out
        </span>
      </div>
    </div>
  );
}

/* ================= Sparkline ================= */

export function Sparkline({
  values,
  color,
  id,
  className = "h-10 w-full",
}: {
  values: number[];
  color: string;
  id: string;
  className?: string;
}) {
  const vals = values.length ? values : [0];
  const w = 100;
  const h = 30;
  const pad = 2;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => [
    pad + (i * (w - 2 * pad)) / Math.max(1, vals.length - 1),
    h - pad - ((v - min) / range) * (h - 2 * pad),
  ]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(2)},${h} L${pts[0][0].toFixed(2)},${h} Z`;
  const gid = `spark-${id}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ================= Ranked horizontal bars ================= */

export function RankRows({
  items,
  currency,
  formatValue,
}: {
  items: { label: string; value: number; color: string; sub?: string }[];
  currency: string;
  formatValue?: (v: number) => string;
}) {
  const mounted = useMounted(100);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={it.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
              <Dot color={it.color} />
              <span className="truncate">{it.label}</span>
              {it.sub && <span className="shrink-0 text-[12px] text-ink-faint">{it.sub}</span>}
            </span>
            <span className="num shrink-0 text-sm font-bold text-ink">
              {formatValue ? formatValue(it.value) : fmtMoney(it.value, currency)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full"
              style={{
                width: mounted ? `${(it.value / max) * 100}%` : "0%",
                background: it.color,
                transition: `width 0.8s cubic-bezier(0.2,0.7,0.2,1) ${i * 70}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= Weekday bars ================= */

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function WeekBars({ values, currency }: { values: number[]; currency: string }) {
  const mounted = useMounted(120);
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1.5 sm:gap-2">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex flex-1 flex-col items-center gap-1.5"
          title={`${v > 0 ? fmtMoney(v, currency) : "No spending"}`}
        >
          <div className="flex h-24 w-full items-end justify-center">
            <div
              className="w-full max-w-[30px] rounded-t-[6px]"
              style={{
                height: mounted ? `${Math.max(3, (v / max) * 100)}%` : "3%",
                background: v === max && v > 0 ? "var(--color-coral)" : "var(--color-moss)",
                opacity: v === 0 ? 0.25 : 0.9,
                transition: `height 0.7s cubic-bezier(0.2,0.7,0.2,1) ${i * 55}ms`,
              }}
            />
          </div>
          <span className="text-[11px] font-semibold text-ink-faint">{DAY_LETTERS[i]}</span>
        </div>
      ))}
    </div>
  );
}
