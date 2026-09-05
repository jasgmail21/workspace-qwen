import React, { useEffect, useRef, useState } from "react";
import { fmtMoney } from "../utils";
import { Icon, IconName } from "./Icons";

/* ---------- shared class strings ---------- */

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-pine text-paper px-4 py-2.5 text-sm font-semibold border-2 border-pine shadow-[3px_3px_0_0_var(--color-moss)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-moss)] active:translate-y-0 active:shadow-[1px_1px_0_0_var(--color-moss)] cursor-pointer select-none";

export const BTN_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-coral text-paper px-4 py-2.5 text-sm font-semibold border-2 border-coral-deep shadow-[3px_3px_0_0_var(--color-coral-deep)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-coral-deep)] active:translate-y-0 cursor-pointer select-none";

export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink hover:bg-line-soft transition-colors cursor-pointer select-none";

export const CARD = "bg-card border border-line rounded-xl";

/* ---------- hooks ---------- */

export function useMounted(delay = 80): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return m;
}

/* ---------- Reveal on scroll ---------- */

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------- animated number ---------- */

export function CountUp({
  value,
  currency,
  className = "",
  compact = false,
  prefix = "",
}: {
  value: number;
  currency: string;
  className?: string;
  compact?: boolean;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={`num ${className}`}>
      {prefix}
      {fmtMoney(display, currency, { compact })}
    </span>
  );
}

/* ---------- segmented control ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-[10px] border border-line bg-paper p-1 ${className}`}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              active
                ? "bg-pine text-mint shadow-sm"
                : "text-ink-soft hover:text-ink hover:bg-line-soft"
            }`}
          >
            {o.icon && <Icon name={o.icon} size={15} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- animated progress bar ---------- */

export function Bar({
  ratio,
  color,
  className = "h-2",
  track = "bg-line-soft",
}: {
  ratio: number;
  color: string;
  className?: string;
  track?: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const r1 = requestAnimationFrame(() =>
      requestAnimationFrame(() => setW(Math.max(0, Math.min(1, ratio))))
    );
    return () => cancelAnimationFrame(r1);
  }, [ratio]);
  return (
    <div className={`w-full overflow-hidden rounded-full ${track} ${className}`}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${w * 100}%`, background: color }}
      />
    </div>
  );
}

/* ---------- empty state ---------- */

export function EmptyState({
  icon = "sprout",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-line text-ink-faint">
        <Icon name={icon} size={28} strokeWidth={1.6} />
      </div>
      <div>
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{body}</p>
      </div>
      {action}
    </div>
  );
}

/* ---------- misc ---------- */

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}

export function DeltaPill({
  pct,
  goodWhenDown = false,
  suffix = " vs last month",
}: {
  pct: number;
  goodWhenDown?: boolean;
  suffix?: string;
}) {
  const up = pct >= 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span
      className={`num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
        good ? "bg-mint-dim text-moss-deep" : "bg-coral-soft text-coral-deep"
      }`}
    >
      <Icon name={up ? "upRight" : "downRight"} size={12} strokeWidth={2.4} />
      {Math.abs(pct).toFixed(0)}%
      <span className="font-body font-normal opacity-70">{suffix}</span>
    </span>
  );
}
