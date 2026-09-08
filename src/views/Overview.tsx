import React, { useMemo, useState } from "react";
import { CategoryTransactionsModal } from "../components/CategoryTransactionsModal";
import { Donut, DonutSeg, FlowBars, Sparkline } from "../components/Charts";
import { Icon } from "../components/Icons";
import { MonthNav } from "../components/layout";
import { MonthPicker } from "../components/MonthPicker";
import { Bar, BTN_PRIMARY, CARD, CountUp, DeltaPill, Dot, EmptyState, Reveal, Segmented } from "../components/ui";
import { useApp } from "../store";
import type { Transaction, ViewId } from "../types";
import {
  currentMonthKey,
  dayLabel,
  daysInMonthKey,
  fmtMoney,
  fmtSigned,
  monthLabel,
  monthShort,
  shiftMonth,
} from "../utils";

const sum = (txs: Transaction[], type: "income" | "expense") =>
  txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

const delta = (cur: number, prev: number) =>
  prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

function RecentRow({ t, currency }: { t: Transaction; currency: string }) {
  const { categories } = useApp();
  const cat = categories.find((c) => c.id === t.categoryId);
  return (
    <li className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-line-soft">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-paper"
        style={{ background: cat?.color ?? "var(--color-ink-faint)" }}
      >
        <Icon name={(cat?.icon as never) ?? "receipt"} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{t.note || cat?.name}</p>
        <p className="text-[12px] text-ink-faint">
          {cat?.name} · {dayLabel(t.date)}
          {t.payment ? ` · ${t.payment === "card" ? "Card" : "Cash"}` : ""}
        </p>
      </div>
      <span
        className={`num text-sm font-bold ${t.type === "income" ? "text-moss-deep" : "text-ink"}`}
      >
        {fmtSigned(t, currency)}
      </span>
    </li>
  );
}

export function Overview({
  monthKey,
  onMonth,
  onAdd,
  goTo,
}: {
  monthKey: string;
  onMonth: (k: string) => void;
  onAdd: () => void;
  goTo: (v: ViewId) => void;
}) {
  const { transactions, categories, settings } = useApp();
  const currency = settings.currency;
  const isCurrent = monthKey === currentMonthKey();
  const [hovered, setHovered] = useState<number | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "alltime">("month");

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(monthKey)),
    [transactions, monthKey]
  );
  const prevTx = useMemo(() => {
    const k = shiftMonth(monthKey, -1);
    return transactions.filter((t) => t.date.startsWith(k));
  }, [transactions, monthKey]);

  const income = sum(monthTx, "income");
  const expense = sum(monthTx, "expense");
  const pIncome = sum(prevTx, "income");
  const pExpense = sum(prevTx, "expense");
  const balance = transactions.reduce(
    (s, t) => s + (t.type === "income" ? t.amount : -t.amount),
    0
  );
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : null;

  // All-time calculations
  const allTimeIncome = sum(transactions, "income");
  const allTimeExpense = sum(transactions, "expense");
  const allTimeCount = transactions.length;

  const segments: DonutSeg[] = useMemo(() => {
    const expCats = categories.filter((c) => c.type === "expense");
    const txSource = viewMode === "alltime" ? transactions : monthTx;
    return expCats
      .map((c) => ({
        id: c.id,
        label: c.name,
        color: c.color,
        value: txSource
          .filter((t) => t.type === "expense" && t.categoryId === c.id)
          .reduce((s, t) => s + t.amount, 0),
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categories, monthTx, transactions, viewMode]);

  const flow = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const k = shiftMonth(monthKey, i - 5);
        const txs = transactions.filter((t) => t.date.startsWith(k));
        return {
          key: k,
          label: monthShort(k),
          income: sum(txs, "income"),
          expense: sum(txs, "expense"),
          current: k === monthKey,
        };
      }),
    [transactions, monthKey]
  );

  const cumSeries = (type: "income" | "expense") => {
    const days = daysInMonthKey(monthKey);
    let acc = 0;
    return Array.from({ length: days }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      acc += monthTx
        .filter((t) => t.type === type && t.date === `${monthKey}-${day}`)
        .reduce((s, t) => s + t.amount, 0);
      return acc;
    });
  };
  const incSeries = useMemo(() => cumSeries("income"), [monthTx, monthKey]);
  const expSeries = useMemo(() => cumSeries("expense"), [monthTx, monthKey]);
  const netSeries = flow.map((f) => f.income - f.expense);

  const budgetSnap = useMemo(() => {
    return categories
      .filter((c) => c.type === "expense" && (c.budget ?? 0) > 0)
      .map((c) => {
        const spent = monthTx
          .filter((t) => t.type === "expense" && t.categoryId === c.id)
          .reduce((s, t) => s + t.amount, 0);
        return { cat: c, spent, budget: c.budget ?? 0 };
      })
      .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
      .slice(0, 4);
  }, [categories, monthTx]);

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    [transactions]
  );

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stamp text-moss">Overview</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowMonthPicker(true)}
              className="font-display text-3xl font-bold tracking-tight text-ink hover:text-moss-deep transition-colors cursor-pointer sm:text-4xl"
              title="Click to change month"
            >
              {viewMode === "alltime" ? "All Time" : monthLabel(monthKey)}
            </button>
            {viewMode === "month" && !isCurrent && (
              <button
                onClick={() => onMonth(currentMonthKey())}
                className="rounded-full border border-moss bg-mint-dim px-3 py-1 text-[12px] font-bold text-moss-deep transition-transform hover:scale-105 cursor-pointer"
              >
                ↩ Back to today
              </button>
            )}
          </div>
          <p className="mt-1.5 text-sm text-ink-soft">
            {viewMode === "alltime"
              ? `${allTimeCount} entr${allTimeCount === 1 ? "y" : "ies"} recorded · net ${
                  allTimeIncome - allTimeExpense >= 0 ? "positive" : "negative"
                } ${fmtMoney(Math.abs(allTimeIncome - allTimeExpense), currency)}.`
              : monthTx.length === 0
              ? "Nothing recorded yet — add your first entry."
              : `${monthTx.length} entr${monthTx.length === 1 ? "y" : "ies"} recorded · net ${
                  income - expense >= 0 ? "positive" : "negative"
                } ${fmtMoney(Math.abs(income - expense), currency)}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "month", label: "Month" },
              { value: "alltime", label: "All Time" },
            ]}
          />
          {viewMode === "month" && <MonthNav monthKey={monthKey} onChange={onMonth} />}
          <button className={BTN_PRIMARY} onClick={onAdd}>
            <Icon name="plus" size={16} strokeWidth={2.4} /> Add entry
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid gap-5 md:grid-cols-3">
        <Reveal>
          <div className="relative h-full overflow-hidden rounded-xl border-2 border-pine bg-pine p-5 text-paper shadow-[6px_6px_0_0_var(--color-moss)]">
            <Icon
              name="sprout"
              size={150}
              strokeWidth={1}
              className="pointer-events-none absolute -bottom-9 -right-7 text-pine-2"
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="stamp text-mint/70">Net balance{viewMode === "alltime" ? " · all time" : ""}</span>
                <span className="h-2 w-2 rounded-full bg-mint live-dot" />
              </div>
              <CountUp
                value={balance}
                currency={currency}
                className="mt-2 block text-[32px] font-bold leading-none sm:text-4xl"
              />
              {viewMode === "month" && (
                <div className="mt-3">
                  {savingsRate !== null ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                        savingsRate >= 0 ? "bg-pine-2 text-mint" : "bg-pine-2 text-[#f0a08e]"
                      }`}
                    >
                      <Icon name={savingsRate >= 0 ? "sprout" : "alert"} size={13} />
                      {savingsRate >= 0 ? "Saving" : "Overspending"}{" "}
                      {Math.abs(savingsRate).toFixed(0)}% of {monthShort(monthKey)} income
                    </span>
                  ) : (
                    <span className="text-[12px] text-mint/60">No income recorded this month yet</span>
                  )}
                </div>
              )}
              {viewMode === "alltime" && (
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pine-2 px-2.5 py-1 text-[12px] font-bold text-mint">
                    <Icon name="coins" size={13} />
                    {allTimeCount} total transactions
                  </span>
                </div>
              )}
              {viewMode === "month" && (
                <div className="mt-5">
                  <Sparkline values={netSeries} color="var(--color-mint)" id="net" className="h-12 w-full" />
                  <p className="mt-1.5 text-[11px] text-mint/50">Six-month net flow</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal delay={70}>
          <div className={`${CARD} flex h-full flex-col p-5`}>
            <div className="flex items-center justify-between">
              <span className="stamp text-ink-soft">Money in</span>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-mint-dim text-moss-deep">
                <Icon name="upRight" size={17} strokeWidth={2.2} />
              </span>
            </div>
            <CountUp
              value={viewMode === "alltime" ? allTimeIncome : income}
              currency={currency}
              className="mt-2 block text-2xl font-bold sm:text-3xl"
            />
            {viewMode === "month" && (
              <>
                <div className="mt-2">
                  <DeltaPill pct={delta(income, pIncome)} suffix=" vs last mo." />
                </div>
                <div className="mt-auto pt-4">
                  <Sparkline values={incSeries} color="var(--color-moss)" id="inc" className="h-11 w-full" />
                  <p className="mt-1.5 text-[11px] text-ink-faint">Cumulative across the month</p>
                </div>
              </>
            )}
            {viewMode === "alltime" && (
              <div className="mt-auto pt-4">
                <p className="text-[12px] text-ink-faint">Total income across all time</p>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className={`${CARD} flex h-full flex-col p-5`}>
            <div className="flex items-center justify-between">
              <span className="stamp text-ink-soft">Money out</span>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-coral-soft text-coral-deep">
                <Icon name="downRight" size={17} strokeWidth={2.2} />
              </span>
            </div>
            <CountUp
              value={viewMode === "alltime" ? allTimeExpense : expense}
              currency={currency}
              className="mt-2 block text-2xl font-bold sm:text-3xl"
            />
            {viewMode === "month" && (
              <>
                <div className="mt-2">
                  <DeltaPill pct={delta(expense, pExpense)} goodWhenDown suffix=" vs last mo." />
                </div>
                <div className="mt-auto pt-4">
                  <Sparkline values={expSeries} color="var(--color-coral)" id="exp" className="h-11 w-full" />
                  <p className="mt-1.5 text-[11px] text-ink-faint">Cumulative across the month</p>
                </div>
              </>
            )}
            {viewMode === "alltime" && (
              <div className="mt-auto pt-4">
                <p className="text-[12px] text-ink-faint">Total expenses across all time</p>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* donut + flow */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Reveal className="lg:col-span-2">
          <div className={`${CARD} h-full p-5`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Where it went</h2>
              <span className="text-[12px] font-medium text-ink-faint">
                {viewMode === "alltime" ? "All time" : monthShort(monthKey)} spending
              </span>
            </div>
            {segments.length > 0 ? (
              <div className="mt-4 flex flex-col items-center gap-5">
                <Donut
                  segments={segments}
                  currency={currency}
                  hovered={hovered}
                  onHover={setHovered}
                  onClick={(i) => {
                    const seg = segments[i];
                    if (seg && "id" in seg) {
                      setSelectedCategory((seg as any).id);
                    }
                  }}
                />
                <ul className="w-full space-y-0.5">
                  {segments.map((s, i) => {
                    const totalExp = viewMode === "alltime" ? allTimeExpense : expense;
                    return (
                      <li
                        key={s.label}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => {
                          if ("id" in s) {
                            setSelectedCategory((s as any).id);
                          }
                        }}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                          hovered === i ? "bg-line-soft" : ""
                        }`}
                      >
                        <Dot color={s.color} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.label}</span>
                        <span className="num w-12 text-right text-[12px] text-ink-faint">
                          {totalExp > 0 ? ((s.value / totalExp) * 100).toFixed(0) : 0}%
                        </span>
                        <span className="num w-20 text-right text-sm font-bold text-ink">
                          {fmtMoney(s.value, currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-ink-faint">Click a category to see transactions</p>
              </div>
            ) : (
              <EmptyState
                icon="film"
                title="No spending yet"
                body={
                  viewMode === "alltime"
                    ? "Expenses will be broken down here by category."
                    : `Expenses added in ${monthLabel(monthKey)} will be broken down here by category.`
                }
              />
            )}
          </div>
        </Reveal>

        <Reveal delay={80} className="lg:col-span-3">
          <div className={`${CARD} h-full p-5`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Six-month flow</h2>
              <span className="text-[12px] font-medium text-ink-faint">Hover a month for detail</span>
            </div>
            <div className="mt-4">
              <FlowBars data={flow} currency={currency} />
            </div>
          </div>
        </Reveal>
      </div>

      {/* budgets + recent */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Reveal className="lg:col-span-2">
          <div className={`${CARD} flex h-full flex-col p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Budget pulse</h2>
              <button
                onClick={() => goTo("budgets")}
                className="flex items-center gap-1 text-[13px] font-bold text-moss-deep transition-colors hover:text-moss cursor-pointer"
              >
                Manage <Icon name="arrowR" size={14} strokeWidth={2.4} />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-4">
              {budgetSnap.length === 0 && (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-ink-soft">
                  No budgets set yet. Head to Budgets to give every category a monthly limit.
                </p>
              )}
              {budgetSnap.map(({ cat, spent, budget }) => {
                const r = spent / budget;
                const color =
                  r > 1 ? "var(--color-coral)" : r >= 0.75 ? "var(--color-amber)" : "var(--color-moss)";
                return (
                  <div key={cat.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="grid h-7 w-7 place-items-center rounded-md text-paper"
                        style={{ background: cat.color }}
                      >
                        <Icon name={cat.icon as never} size={14} />
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold text-ink">{cat.name}</span>
                      <span className="num text-[13px] text-ink-soft">
                        <b className="text-ink">{fmtMoney(spent, currency)}</b> / {fmtMoney(budget, currency)}
                      </span>
                    </div>
                    <Bar ratio={r} color={color} />
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        <Reveal delay={80} className="lg:col-span-3">
          <div className={`${CARD} flex h-full flex-col p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Recent activity</h2>
              <span className="text-[12px] font-medium text-ink-faint">Latest {recent.length}</span>
            </div>
            <ul className="mt-3 flex-1 divide-y divide-dashed divide-line">
              {recent.map((t) => (
                <RecentRow key={t.id} t={t} currency={currency} />
              ))}
            </ul>
            <button
              onClick={() => goTo("transactions")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-bold text-ink-soft transition-all hover:border-moss hover:text-moss-deep cursor-pointer"
            >
              View all transactions <Icon name="arrowR" size={15} strokeWidth={2.4} />
            </button>
          </div>
        </Reveal>
      </div>

      {/* Modals */}
      {showMonthPicker && (
        <MonthPicker
          currentKey={monthKey}
          onSelect={onMonth}
          onClose={() => setShowMonthPicker(false)}
        />
      )}

      {selectedCategory && (
        <CategoryTransactionsModal
          categoryId={selectedCategory}
          monthKey={viewMode === "alltime" ? "all" : monthKey}
          onClose={() => setSelectedCategory(null)}
          onEdit={() => {
            // TODO: Implement edit functionality
            setSelectedCategory(null);
          }}
        />
      )}
    </div>
  );
}
