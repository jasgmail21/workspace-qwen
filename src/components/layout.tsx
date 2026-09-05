import React from "react";
import { useApp } from "../store";
import type { ViewId } from "../types";
import { CURRENCIES, currentMonthKey, fmtAgo, fmtMoney, monthLabel, shiftMonth } from "../utils";
import { Icon, IconName } from "./Icons";

/* ---------------- month navigator ---------------- */

const ICON_BTN =
  "grid h-9 w-9 place-items-center rounded-lg border border-line bg-card text-ink-soft transition-all hover:border-ink-faint hover:text-ink active:scale-95 cursor-pointer disabled:opacity-35 disabled:pointer-events-none";

export function MonthNav({
  monthKey,
  onChange,
}: {
  monthKey: string;
  onChange: (k: string) => void;
}) {
  const isCurrent = monthKey === currentMonthKey();
  return (
    <div className="flex items-center gap-1.5">
      <button aria-label="Previous month" className={ICON_BTN} onClick={() => onChange(shiftMonth(monthKey, -1))}>
        <Icon name="chevL" size={17} />
      </button>
      <span className="num min-w-[92px] rounded-lg border border-line bg-card px-2 py-1.5 text-center text-[13px] font-bold text-ink">
        {monthLabel(monthKey).split(" ")[0]} ’{monthLabel(monthKey).split(" ")[1].slice(2)}
      </span>
      <button
        aria-label="Next month"
        className={ICON_BTN}
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(monthKey, 1))}
      >
        <Icon name="chevR" size={17} />
      </button>
    </div>
  );
}

export const NAV: { id: ViewId; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "wallet" },
  { id: "transactions", label: "Transactions", icon: "receipt" },
  { id: "budgets", label: "Budgets", icon: "target" },
  { id: "insights", label: "Insights", icon: "spark" },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] border-2 border-pine-3 bg-pine-2 text-mint shadow-[2px_2px_0_0_rgba(169,223,188,0.25)]">
        <Icon name="sprout" size={20} strokeWidth={2} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[19px] font-bold tracking-tight text-paper">
            Sprout
          </span>
          <span className="mt-0.5 block text-[10px] font-medium tracking-[0.18em] text-mint/70 uppercase">
            Money, tended
          </span>
        </span>
      )}
    </div>
  );
}

/* ---------------- desktop sidebar ---------------- */

function CloudWidget({ onOpen }: { onOpen: () => void }) {
  const { cloud } = useApp();
  const dot =
    cloud.status === "synced" ? "bg-mint live-dot"
    : cloud.status === "syncing" ? "bg-amber animate-pulse"
    : cloud.status === "error" ? "bg-coral"
    : "bg-mint/30";
  const label = !cloud.configured
    ? "Set up free cloud sync"
    : !cloud.user
      ? "Sign in to sync"
      : cloud.status === "syncing"
        ? "Syncing…"
        : cloud.status === "error"
          ? "Sync error — tap to fix"
          : cloud.status === "offline"
            ? "Offline — changes queued"
            : cloud.lastSync
              ? `Synced · ${fmtAgo(cloud.lastSync)}`
              : "Cloud connected";
  return (
    <button
      onClick={onOpen}
      className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl border border-pine-3 bg-pine-2/50 px-3.5 py-3 text-left transition-colors hover:bg-pine-2 cursor-pointer"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0">
        <span className="stamp block text-mint/60">Cloud sync</span>
        <span className="block truncate text-[12.5px] font-semibold text-mint-dim">{label}</span>
      </span>
      <Icon name="plane" size={16} className="ml-auto shrink-0 text-mint/50" />
    </button>
  );
}

export function Sidebar({
  view,
  setView,
  onCloudOpen,
}: {
  view: ViewId;
  setView: (v: ViewId) => void;
  onCloudOpen: () => void;
}) {
  const { settings, setCurrency, transactions, resetDemo, cloud } = useApp();
  const mk = currentMonthKey();
  const monthTx = transactions.filter((t) => t.date.startsWith(mk));
  const net = monthTx.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r-2 border-pine-3 bg-pine lg:flex">
      <div className="px-6 pb-6 pt-7">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-[14px] font-semibold transition-all duration-150 cursor-pointer ${
                active
                  ? "bg-pine-2 text-mint shadow-[inset_3px_0_0_0_var(--color-moss)]"
                  : "text-mint/60 hover:bg-pine-2/60 hover:text-mint"
              }`}
            >
              <Icon name={n.icon} size={18} strokeWidth={active ? 2.1 : 1.8} />
              {n.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-mint live-dot" />}
            </button>
          );
        })}
      </nav>

      <CloudWidget onOpen={onCloudOpen} />

      <div className="mx-4 mb-4 rounded-xl border border-pine-3 bg-pine-2/70 p-4">
        <p className="stamp text-mint/60">This month net</p>
        <p className={`num mt-1 text-xl font-bold ${net >= 0 ? "text-mint" : "text-[#f0a08e]"}`}>
          {net >= 0 ? "+" : "\u2212"}
          {fmtMoney(Math.abs(net), settings.currency)}
        </p>
        <p className="mt-1 text-[11px] leading-4 text-mint/50">
          {monthTx.length} transaction{monthTx.length === 1 ? "" : "s"} recorded
        </p>
      </div>

      <div className="space-y-3 border-t border-pine-3 px-5 py-5">
        <div>
          <label className="stamp mb-1.5 block text-mint/60" htmlFor="currency-select">
            Currency
          </label>
          <select
            id="currency-select"
            className="field field-dark num text-sm"
            value={settings.currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {cloud.user ? (
          <p className="text-[11px] leading-4 text-mint/40">
            Cloud account active — Supabase is your source of truth; this browser keeps an
            offline cache only.
          </p>
        ) : (
          <>
            <button
              onClick={resetDemo}
              className="text-[12px] font-medium text-mint/50 underline decoration-mint/30 underline-offset-4 transition-colors hover:text-mint cursor-pointer"
            >
              Restore demo data
            </button>
            <p className="text-[11px] leading-4 text-mint/40">
              Local mode — data lives in this browser. Connect Cloud sync to use any device.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

/* ---------------- mobile top bar + bottom nav ---------------- */

export function MobileBar({
  view,
  setView,
  onAdd,
  onCloudOpen,
}: {
  view: ViewId;
  setView: (v: ViewId) => void;
  onAdd: () => void;
  onCloudOpen: () => void;
}) {
  const { cloud } = useApp();
  const cloudDot =
    cloud.status === "synced" ? "bg-mint"
    : cloud.status === "syncing" ? "bg-amber animate-pulse"
    : cloud.status === "error" ? "bg-coral"
    : "bg-mint/30";
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b-2 border-pine-3 bg-pine px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            onClick={onCloudOpen}
            aria-label="Cloud sync"
            className="relative grid h-9 w-9 place-items-center rounded-lg border-2 border-pine-3 bg-pine-2 text-mint transition-transform active:scale-95 cursor-pointer"
          >
            <Icon name="plane" size={16} />
            <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-pine ${cloudDot}`} />
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-lg border-2 border-pine-3 bg-pine-2 px-3 py-1.5 text-[13px] font-bold text-mint transition-transform active:scale-95 cursor-pointer"
          >
            <Icon name="plus" size={15} strokeWidth={2.6} /> Add
          </button>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t-2 border-pine-3 bg-pine pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                active ? "text-mint" : "text-mint/50"
              }`}
            >
              <Icon name={n.icon} size={20} strokeWidth={active ? 2.1 : 1.8} />
              {n.label}
              <span
                className={`h-1 w-1 rounded-full transition-all ${active ? "bg-mint live-dot" : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </nav>
    </>
  );
}

/* ---------------- floating action button (desktop) ---------------- */

export function AddFAB({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      aria-label="Add transaction"
      className="fixed bottom-24 right-5 z-40 hidden h-14 w-14 place-items-center rounded-full border-2 border-pine bg-moss text-paper shadow-[4px_4px_0_0_var(--color-pine)] transition-all duration-150 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-pine)] active:translate-y-0 cursor-pointer lg:grid"
    >
      <Icon name="plus" size={24} strokeWidth={2.4} />
    </button>
  );
}

/* ---------------- toasts ---------------- */

export function ToastHost() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  const iconFor = (kind: string): IconName =>
    kind === "success" ? "check" : kind === "error" ? "alert" : "info";
  const colorFor = (kind: string) =>
    kind === "success" ? "text-mint" : kind === "error" ? "text-[#f0a08e]" : "text-amber-soft";

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-slide-in pointer-events-auto flex w-full max-w-[400px] items-center gap-3 rounded-xl border-2 border-pine-3 bg-pine px-4 py-3 shadow-[5px_5px_0_0_rgba(13,33,26,0.3)]"
          role="status"
        >
          <span className={`shrink-0 ${colorFor(t.kind)}`}>
            <Icon name={iconFor(t.kind)} size={18} strokeWidth={2.2} />
          </span>
          <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-mint-dim">
            {t.message}
          </p>
          {t.action && (
            <button
              onClick={() => {
                t.action?.fn();
                dismissToast(t.id);
              }}
              className="shrink-0 rounded-md bg-pine-2 px-2.5 py-1 text-[12px] font-bold text-mint transition-colors hover:bg-pine-3 cursor-pointer"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 text-mint/50 transition-colors hover:text-mint cursor-pointer"
            aria-label="Dismiss"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
