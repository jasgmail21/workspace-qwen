import React, { useMemo, useState } from "react";
import { RankRows, WeekBars } from "../components/Charts";
import { Icon, IconName } from "../components/Icons";
import { Bar, CARD, Reveal, Segmented } from "../components/ui";
import { useApp } from "../store";
import {
  currentMonthKey,
  daysInMonthKey,
  fmtMoney,
  fromISO,
  monthShort,
  niceDate,
  shiftMonth,
  toISO,
} from "../utils";

type Range = "month" | "all";

function StatTile({
  icon,
  label,
  children,
  foot,
  delay = 0,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
  foot?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className={`${CARD} h-full p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-line)]`}>
        <div className="flex items-center justify-between">
          <span className="stamp text-ink-soft">{label}</span>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-mint-dim text-moss-deep">
            <Icon name={icon} size={16} />
          </span>
        </div>
        <div className="mt-2.5">{children}</div>
        {foot && <p className="mt-2.5 text-[12px] leading-4 text-ink-faint">{foot}</p>}
      </div>
    </Reveal>
  );
}

export function Insights() {
  const { transactions, categories, settings } = useApp();
  const currency = settings.currency;
  const [range, setRange] = useState<Range>("month");

  const mk = currentMonthKey();

  const scoped = useMemo(
    () => (range === "month" ? transactions.filter((t) => t.date.startsWith(mk)) : transactions),
    [transactions, range, mk]
  );

  const income = scoped.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = scoped.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const savings = income > 0 ? ((income - expense) / income) * 100 : null;

  const days = useMemo(() => {
    if (range === "month") {
      return mk === currentMonthKey() ? new Date().getDate() : daysInMonthKey(mk);
    }
    if (transactions.length === 0) return 1;
    const first = transactions.reduce((m, t) => (t.date < m ? t.date : m), transactions[0].date);
    const ms = fromISO(toISO(new Date())).getTime() - fromISO(first).getTime();
    return Math.max(1, Math.round(ms / 86400000) + 1);
  }, [range, mk, transactions]);

  const avgDaily = expense / days;

  const biggest = useMemo(() => {
    let best: { note: string; amount: number; date: string; categoryId: string } | null = null;
    for (const t of scoped) {
      if (t.type === "expense" && (!best || t.amount > best.amount)) best = t;
    }
    return best;
  }, [scoped]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    scoped
      .filter((t) => t.type === "expense")
      .forEach((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount));
    return categories
      .map((c) => ({ cat: c, value: m.get(c.id) ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [scoped, categories]);

  const topCat = byCategory[0] ?? null;

  const momPct = useMemo(() => {
    const cur = transactions
      .filter((t) => t.type === "expense" && t.date.startsWith(mk))
      .reduce((s, t) => s + t.amount, 0);
    const prevK = shiftMonth(mk, -1);
    const prev = transactions
      .filter((t) => t.type === "expense" && t.date.startsWith(prevK))
      .reduce((s, t) => s + t.amount, 0);
    return prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
  }, [transactions, mk]);

  const weekValues = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    scoped
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        arr[fromISO(t.date).getDay()] += t.amount;
      });
    return arr;
  }, [scoped]);

  const incomeSources = useMemo(() => {
    const m = new Map<string, number>();
    scoped
      .filter((t) => t.type === "income")
      .forEach((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount));
    return categories
      .map((c) => ({ cat: c, value: m.get(c.id) ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [scoped, categories]);

  const incomeCount = scoped.filter((t) => t.type === "income").length;
  const rangeLabel = range === "month" ? monthShort(mk) : "all time";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stamp text-moss">Insights</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            The story behind the numbers
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Patterns, outliers and habits — computed locally from {transactions.length} entries.
          </p>
        </div>
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "month", label: "This month", icon: "calendar" },
            { value: "all", label: "All time", icon: "trend" },
          ]}
        />
      </div>

      {/* stat tiles */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          icon="sprout"
          label="Savings rate"
          delay={0}
          foot={`${fmtMoney(Math.max(0, income - expense), currency)} kept of ${fmtMoney(income, currency)} earned · ${rangeLabel}`}
        >
          {savings !== null ? (
            <>
              <p className={`num text-3xl font-bold ${savings >= 0 ? "text-moss-deep" : "text-coral-deep"}`}>
                {savings.toFixed(0)}%
              </p>
              <div className="mt-2.5">
                <Bar
                  ratio={Math.max(0, Math.min(1, savings / 100))}
                  color={savings >= 20 ? "var(--color-moss)" : savings >= 0 ? "var(--color-amber)" : "var(--color-coral)"}
                />
              </div>
            </>
          ) : (
            <p className="text-lg font-semibold text-ink-faint">No income in range</p>
          )}
        </StatTile>

        <StatTile
          icon="calendar"
          label="Avg daily spend"
          delay={60}
          foot={`Spread across ${days} day${days === 1 ? "" : "s"} · ${rangeLabel}`}
        >
          <p className="num text-3xl font-bold text-ink">{fmtMoney(avgDaily, currency)}</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {avgDaily > 0 ? "per day, on average" : "nothing spent — impressive"}
          </p>
        </StatTile>

        <StatTile icon="bag" label="Biggest expense" delay={120} foot={biggest ? niceDate(biggest.date) : undefined}>
          {biggest ? (
            <>
              <p className="num text-3xl font-bold text-coral-deep">
                {fmtMoney(biggest.amount, currency)}
              </p>
              <p className="mt-1 truncate text-[13px] font-medium text-ink-soft">
                {biggest.note || categories.find((c) => c.id === biggest.categoryId)?.name}
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-ink-faint">No expenses in range</p>
          )}
        </StatTile>

        <StatTile icon="target" label="Top category" delay={180} foot={topCat ? `${((topCat.value / Math.max(1, expense)) * 100).toFixed(0)}% of all spending · ${rangeLabel}` : undefined}>
          {topCat ? (
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-paper"
                style={{ background: topCat.cat.color }}
              >
                <Icon name={topCat.cat.icon as IconName} size={19} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-bold text-ink">{topCat.cat.name}</p>
                <p className="num text-[13px] text-ink-soft">{fmtMoney(topCat.value, currency)}</p>
              </div>
            </div>
          ) : (
            <p className="text-lg font-semibold text-ink-faint">Nothing to rank yet</p>
          )}
        </StatTile>

        <StatTile icon="trend" label="vs last month" delay={240} foot="Spending change, current month over previous">
          <p
            className={`num flex items-center gap-2 text-3xl font-bold ${
              momPct <= 0 ? "text-moss-deep" : "text-coral-deep"
            }`}
          >
            <Icon name={momPct <= 0 ? "downRight" : "upRight"} size={22} strokeWidth={2.4} />
            {Math.abs(momPct).toFixed(0)}%
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {momPct <= 0 ? "spending is cooling down" : "spending picked up pace"}
          </p>
        </StatTile>

        <StatTile icon="receipt" label="Entries" delay={300} foot={`${incomeCount} income · ${scoped.length - incomeCount} expense · ${rangeLabel}`}>
          <p className="num text-3xl font-bold text-ink">{scoped.length}</p>
          <p className="mt-1 text-[13px] text-ink-soft">transactions recorded</p>
        </StatTile>
      </div>

      {/* ranking + weekday + income */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <div className={`${CARD} h-full p-5`}>
            <h2 className="font-display text-lg font-bold text-ink">Spending leaderboard</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">Categories ranked by spend · {rangeLabel}</p>
            <div className="mt-5">
              {byCategory.length > 0 ? (
                <RankRows
                  items={byCategory.slice(0, 7).map((x) => ({
                    label: x.cat.name,
                    value: x.value,
                    color: x.cat.color,
                    sub: `${((x.value / Math.max(1, expense)) * 100).toFixed(0)}%`,
                  }))}
                  currency={currency}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-ink-soft">
                  No expenses in this range yet.
                </p>
              )}
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-5">
          <Reveal delay={70}>
            <div className={`${CARD} p-5`}>
              <h2 className="font-display text-lg font-bold text-ink">Day-of-week rhythm</h2>
              <p className="mt-0.5 text-[12px] text-ink-faint">
                Where spending lands across the week · red marks your heaviest day
              </p>
              <div className="mt-5">
                <WeekBars values={weekValues} currency={currency} />
              </div>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className={`${CARD} p-5`}>
              <h2 className="font-display text-lg font-bold text-ink">Income sources</h2>
              <div className="mt-5">
                {incomeSources.length > 0 ? (
                  <RankRows
                    items={incomeSources.map((x) => ({
                      label: x.cat.name,
                      value: x.value,
                      color: x.cat.color,
                      sub: `${((x.value / Math.max(1, income)) * 100).toFixed(0)}%`,
                    }))}
                    currency={currency}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-ink-soft">
                    No income in this range yet.
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
