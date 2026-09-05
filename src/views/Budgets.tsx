import React, { useMemo, useState } from "react";
import { Icon, IconName } from "../components/Icons";
import { MonthNav } from "../components/layout";
import { CategoryModal, ConfirmModal } from "../components/modals";
import { Bar, CARD, Reveal } from "../components/ui";
import { useApp } from "../store";
import type { Category } from "../types";
import { fmtMoney, monthLabel } from "../utils";

function statusFor(r: number) {
  if (r > 1) return { label: "Over budget", cls: "bg-coral-soft text-coral-deep" };
  if (r >= 0.75) return { label: "Watch it", cls: "bg-amber-soft text-[#8a6210]" };
  return { label: "On track", cls: "bg-mint-dim text-moss-deep" };
}

function BudgetCard({
  cat,
  spent,
  currency,
  onSetBudget,
  onDelete,
  delay,
}: {
  cat: Category;
  spent: number;
  currency: string;
  onSetBudget: (id: string, v: number) => void;
  onDelete: (c: Category) => void;
  delay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const budget = cat.budget ?? 0;
  const r = budget > 0 ? spent / budget : 0;
  const barColor =
    r > 1 ? "var(--color-coral)" : r >= 0.75 ? "var(--color-amber)" : "var(--color-moss)";
  const status = statusFor(r);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= 0) onSetBudget(cat.id, Math.round(v * 100) / 100);
    setEditing(false);
  };

  return (
    <Reveal delay={delay}>
      <div className={`${CARD} group flex h-full flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-line)]`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-paper"
              style={{ background: cat.color }}
            >
              <Icon name={cat.icon as IconName} size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-bold text-ink">{cat.name}</p>
              <p className="text-[12px] text-ink-faint">Monthly envelope</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setEditOpen(true)}
              aria-label={`Edit ${cat.name}`}
              title="Edit category (name, color, icon, budget)"
              className="grid h-8 w-8 place-items-center rounded-md text-ink-faint opacity-100 transition-all hover:bg-mint-dim hover:text-moss-deep lg:opacity-0 lg:group-hover:opacity-100 cursor-pointer"
            >
              <Icon name="pencil" size={15} />
            </button>
            <button
              onClick={() => onDelete(cat)}
              aria-label={`Delete ${cat.name}`}
              className="grid h-8 w-8 place-items-center rounded-md text-ink-faint opacity-100 transition-all hover:bg-coral-soft hover:text-coral-deep lg:opacity-0 lg:group-hover:opacity-100 cursor-pointer"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        </div>

        {editOpen && <CategoryModal initial={cat} onClose={() => setEditOpen(false)} />}

        <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="num text-[26px] font-bold leading-none text-ink">
            {fmtMoney(spent, currency)}
          </span>
          <span className="text-sm text-ink-soft">of</span>
          {editing ? (
            <form onSubmit={save} className="flex items-center gap-1.5">
              <input
                autoFocus
                type="number"
                min="0"
                step="1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="field num w-24 px-2 py-1 text-sm"
                aria-label="New budget"
              />
              <button
                type="submit"
                className="grid h-8 w-8 place-items-center rounded-md bg-moss text-paper transition-transform active:scale-90 cursor-pointer"
                aria-label="Save budget"
              >
                <Icon name="check" size={15} strokeWidth={2.6} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-line-soft cursor-pointer"
                aria-label="Cancel"
              >
                <Icon name="x" size={15} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setDraft(budget > 0 ? String(budget) : "");
                setEditing(true);
              }}
              title="Click to edit budget"
              className="num cursor-text text-sm font-bold text-ink-soft underline decoration-dashed decoration-ink-faint underline-offset-4 transition-colors hover:text-ink"
            >
              {budget > 0 ? fmtMoney(budget, currency) : "set a budget"}
            </button>
          )}
        </div>

        <div className="mt-3.5">
          <Bar ratio={budget > 0 ? Math.min(r, 1) : 0} color={barColor} className="h-2.5" />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-ink-soft">
            {budget === 0
              ? "No limit set"
              : r > 1
                ? `Over by ${fmtMoney(spent - budget, currency)}`
                : `${fmtMoney(budget - spent, currency)} left`}
          </span>
          {budget > 0 && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.cls}`}>
              {status.label}
            </span>
          )}
        </div>
      </div>
    </Reveal>
  );
}

export function Budgets({
  monthKey,
  onMonth,
}: {
  monthKey: string;
  onMonth: (k: string) => void;
}) {
  const { categories, transactions, settings, setBudget, deleteCategory } = useApp();
  const currency = settings.currency;
  const [showNew, setShowNew] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const expenseCats = categories.filter((c) => c.type === "expense");

  const spentBy = useMemo(() => {
    const m = new Map<string, number>();
    transactions
      .filter((t) => t.type === "expense" && t.date.startsWith(monthKey))
      .forEach((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount));
    return m;
  }, [transactions, monthKey]);

  const totalBudget = expenseCats.reduce((s, c) => s + (c.budget ?? 0), 0);
  const totalSpent = expenseCats.reduce((s, c) => s + (spentBy.get(c.id) ?? 0), 0);
  const overallR = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const used = new Set(transactions.map((t) => t.categoryId));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stamp text-moss">Budgets</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Give every rupee a job
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Monthly envelopes for {monthLabel(monthKey)} — click any budget to adjust it, or use the
            pencil to rename and restyle a category.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-pine bg-mint-dim px-4 py-2.5 text-sm font-bold text-moss-deep shadow-[3px_3px_0_0_var(--color-line)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-line)] active:translate-y-0 cursor-pointer"
          >
            <Icon name="plus" size={16} strokeWidth={2.4} /> New category
          </button>
          <MonthNav monthKey={monthKey} onChange={onMonth} />
        </div>
      </div>

      {/* summary strip */}
      <Reveal>
        <div className={`${CARD} border-2 border-pine p-5 shadow-[5px_5px_0_0_var(--color-moss)]`}>
          <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4">
            <div>
              <p className="stamp text-ink-soft">Total budgeted</p>
              <p className="num mt-1 text-2xl font-bold text-ink sm:text-3xl">
                {fmtMoney(totalBudget, currency)}
              </p>
            </div>
            <div>
              <p className="stamp text-ink-soft">Spent so far</p>
              <p className="num mt-1 text-2xl font-bold text-coral-deep sm:text-3xl">
                {fmtMoney(totalSpent, currency)}
              </p>
            </div>
            <div>
              <p className="stamp text-ink-soft">Still available</p>
              <p
                className={`num mt-1 text-2xl font-bold sm:text-3xl ${
                  totalBudget - totalSpent >= 0 ? "text-moss-deep" : "text-coral-deep"
                }`}
              >
                {totalBudget - totalSpent >= 0 ? "" : "\u2212"}
                {fmtMoney(Math.abs(totalBudget - totalSpent), currency)}
              </p>
            </div>
            <div className="w-full sm:w-56">
              <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-ink-soft">
                <span>{Math.round(overallR * 100)}% used</span>
                <span>{monthLabel(monthKey).split(" ")[0]}</span>
              </div>
              <Bar
                ratio={overallR}
                color={
                  overallR > 1
                    ? "var(--color-coral)"
                    : overallR >= 0.75
                      ? "var(--color-amber)"
                      : "var(--color-moss)"
                }
                className="h-3"
              />
            </div>
          </div>
        </div>
      </Reveal>

      {/* category grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {expenseCats.map((c, i) => (
          <BudgetCard
            key={c.id}
            cat={c}
            spent={spentBy.get(c.id) ?? 0}
            currency={currency}
            onSetBudget={setBudget}
            onDelete={setToDelete}
            delay={Math.min(i, 6) * 60}
          />
        ))}

        <Reveal delay={Math.min(expenseCats.length, 6) * 60}>
          <button
            onClick={() => setShowNew(true)}
            className="flex h-full min-h-[190px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line text-ink-faint transition-all duration-200 hover:-translate-y-0.5 hover:border-moss hover:text-moss-deep cursor-pointer"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-current">
              <Icon name="plus" size={20} strokeWidth={2.4} />
            </span>
            <span className="font-display text-[15px] font-bold">New category</span>
            <span className="px-6 text-[12px] text-ink-faint">
              Track something specific — pets, gifts, subscriptions…
            </span>
          </button>
        </Reveal>
      </div>

      {showNew && <CategoryModal onClose={() => setShowNew(false)} />}

      {toDelete && (
        <ConfirmModal
          title={`Delete “${toDelete.name}”?`}
          body={
            used.has(toDelete.id) ? (
              <>
                This category is still used by existing transactions, so it can’t be deleted. Remove
                or reassign those entries first.
              </>
            ) : (
              <>This only removes the category — it won’t affect any recorded transactions.</>
            )
          }
          confirmLabel="Delete category"
          onConfirm={() => deleteCategory(toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
