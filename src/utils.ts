import type { Category, Transaction } from "./types";

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
];

export function fmtMoney(
  n: number,
  currency: string,
  opts: { compact?: boolean; decimals?: number } = {}
): string {
  const abs = Math.abs(n);
  const decimals = opts.decimals ?? (abs >= 1000 ? 0 : 2);
  try {
    if (opts.compact && abs >= 10000) {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
    }
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function fmtSigned(t: Pick<Transaction, "type" | "amount">, currency: string): string {
  return `${t.type === "income" ? "+" : "\u2212"}${fmtMoney(t.amount, currency)}`;
}

export function fmtPct(n: number, digits = 0): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function fmtAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ---------------- dates ---------------- */

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = (): string => toISO(new Date());

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const currentMonthKey = (): string => monthKeyOf(new Date());

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function monthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

export function dayLabel(iso: string): string {
  const d = fromISO(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (toISO(today) === iso) return "Today";
  if (toISO(yest) === iso) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function niceDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysInMonthKey(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/* ---------------- misc ---------------- */

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** deterministic PRNG for stable demo data */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function exportCSV(txs: Transaction[], categories: Category[], currency: string): void {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ["Date", "Type", "Category", "Note", `Amount (${currency})`];
  const rows = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) =>
      [t.date, t.type, catName(t.categoryId), esc(t.note), (t.type === "expense" ? -t.amount : t.amount).toFixed(2)].join(",")
    );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sprout-transactions-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
