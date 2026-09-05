import React, { useMemo, useState } from "react";
import { Icon } from "../components/Icons";
import { ImportModal } from "../components/ImportModal";
import { ConfirmModal } from "../components/modals";
import { BTN_GHOST, BTN_PRIMARY, CARD, EmptyState, Reveal, Segmented } from "../components/ui";
import { useApp } from "../store";
import type { Transaction, TxType } from "../types";
import { dayLabel, exportCSV, fmtMoney, fmtSigned, monthLabel } from "../utils";

type TypeFilter = "all" | TxType;

export function Transactions({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
}) {
  const { transactions, categories, settings, deleteTransaction, pushToast } = useApp();
  const currency = settings.currency;
  const [importOpen, setImportOpen] = useState(false);

  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<TypeFilter>("all");
  const [catF, setCatF] = useState("all");
  const [monthF, setMonthF] = useState("all");
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const monthOptions = useMemo(
    () =>
      Array.from(new Set(transactions.map((t) => t.date.slice(0, 7))))
        .sort()
        .reverse(),
    [transactions]
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return transactions
      .filter((t) => typeF === "all" || t.type === typeF)
      .filter((t) => catF === "all" || t.categoryId === catF)
      .filter((t) => monthF === "all" || t.date.startsWith(monthF))
      .filter((t) => {
        if (!ql) return true;
        const cat = categories.find((c) => c.id === t.categoryId);
        return (
          t.note.toLowerCase().includes(ql) ||
          (cat?.name.toLowerCase().includes(ql) ?? false)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, categories, q, typeF, catF, monthF]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = m.get(t.date);
      if (arr) arr.push(t);
      else m.set(t.date, [t]);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const totals = useMemo(
    () => ({
      income: filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    }),
    [filtered]
  );

  const hasFilters = q !== "" || typeF !== "all" || catF !== "all" || monthF !== "all";
  const clearFilters = () => {
    setQ("");
    setTypeF("all");
    setCatF("all");
    setMonthF("all");
  };

  const catOf = (id: string) => categories.find((c) => c.id === id);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stamp text-moss">Transactions</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Every cent, accounted for
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Showing <b className="num">{filtered.length}</b> of {transactions.length} entries
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={BTN_GHOST + " border border-line bg-card"}
            onClick={() => setImportOpen(true)}
          >
            <Icon name="download" size={16} className="rotate-180" /> Import
          </button>
          <button
            className={BTN_GHOST + " border border-line bg-card"}
            onClick={() => {
              exportCSV(filtered, categories, currency);
              pushToast({ kind: "success", message: `Exported ${filtered.length} rows to CSV` });
            }}
            disabled={filtered.length === 0}
          >
            <Icon name="download" size={16} /> Export
          </button>
          <button className={BTN_PRIMARY} onClick={onAdd}>
            <Icon name="plus" size={16} strokeWidth={2.4} /> Add entry
          </button>
        </div>
      </div>

      {/* filters */}
      <Reveal>
        <div className={`${CARD} flex flex-wrap items-center gap-2.5 p-3.5`}>
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
              <Icon name="search" size={16} />
            </span>
            <input
              className="field pl-10"
              placeholder="Search notes or categories…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Segmented<TypeFilter>
            value={typeF}
            onChange={setTypeF}
            options={[
              { value: "all", label: "All" },
              { value: "income", label: "In", icon: "upRight" },
              { value: "expense", label: "Out", icon: "downRight" },
            ]}
          />
          <select className="field w-auto" value={catF} onChange={(e) => setCatF(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="field w-auto" value={monthF} onChange={(e) => setMonthF(e.target.value)}>
            <option value="all">All time</option>
            {monthOptions.map((k) => (
              <option key={k} value={k}>
                {monthLabel(k)}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-coral-deep transition-colors hover:bg-coral-soft cursor-pointer"
            >
              <Icon name="x" size={13} strokeWidth={2.6} /> Clear
            </button>
          )}
        </div>
      </Reveal>

      {/* list */}
      {filtered.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            icon="receipt"
            title={hasFilters ? "Nothing matches those filters" : "No transactions yet"}
            body={
              hasFilters
                ? "Try widening the search or clearing a filter or two."
                : "Add your first income or expense and it will show up here."
            }
            action={
              hasFilters ? (
                <button className={BTN_GHOST + " border border-line bg-card"} onClick={clearFilters}>
                  <Icon name="filter" size={15} /> Clear all filters
                </button>
              ) : (
                <button className={BTN_PRIMARY} onClick={onAdd}>
                  <Icon name="plus" size={16} strokeWidth={2.4} /> Add your first entry
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, txs], gi) => {
            const dayNet = txs.reduce(
              (s, t) => s + (t.type === "income" ? t.amount : -t.amount),
              0
            );
            return (
              <Reveal key={date} delay={Math.min(gi, 5) * 50}>
                <section className={`${CARD} overflow-hidden`}>
                  <header className="flex items-center justify-between border-b border-dashed border-line bg-paper/60 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
                      <Icon name="calendar" size={14} className="text-ink-faint" />
                      {dayLabel(date)}
                    </span>
                    <span
                      className={`num text-[13px] font-bold ${
                        dayNet >= 0 ? "text-moss-deep" : "text-coral-deep"
                      }`}
                    >
                      {dayNet >= 0 ? "+" : "\u2212"}
                      {fmtMoney(Math.abs(dayNet), currency)}
                    </span>
                  </header>
                  <ul>
                    {txs.map((t, i) => {
                      const cat = catOf(t.categoryId);
                      return (
                        <li
                          key={t.id}
                          className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-line-soft/60 ${
                            i > 0 ? "dashed-rule" : ""
                          }`}
                        >
                          <span
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-paper transition-transform duration-150 group-hover:scale-105"
                            style={{ background: cat?.color ?? "var(--color-ink-faint)" }}
                          >
                            <Icon name={(cat?.icon as never) ?? "receipt"} size={17} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-ink">
                              {t.note || cat?.name || "Untitled"}
                            </p>
                            <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ background: cat?.color }}
                              />
                              {cat?.name ?? "Uncategorized"}
                              <span aria-hidden>·</span>
                              {t.type === "income" ? "Money in" : "Money out"}
                            </p>
                          </div>
                          <span
                            className={`num text-[15px] font-bold ${
                              t.type === "income" ? "text-moss-deep" : "text-ink"
                            }`}
                          >
                            {fmtSigned(t, currency)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                            <button
                              onClick={() => onEdit(t)}
                              aria-label="Edit"
                              className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-mint-dim hover:text-moss-deep cursor-pointer"
                            >
                              <Icon name="pencil" size={15} />
                            </button>
                            <button
                              onClick={() => setToDelete(t)}
                              aria-label="Delete"
                              className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral-deep cursor-pointer"
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </Reveal>
            );
          })}

          {/* totals */}
          <Reveal>
            <div className={`${CARD} flex flex-wrap items-center justify-between gap-4 border-2 border-pine px-5 py-4 shadow-[4px_4px_0_0_var(--color-line)]`}>
              <span className="stamp text-ink-soft">Filtered totals</span>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-moss-deep">
                  <Icon name="upRight" size={15} strokeWidth={2.4} />
                  <span className="num">{fmtMoney(totals.income, currency)}</span>
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold text-coral-deep">
                  <Icon name="downRight" size={15} strokeWidth={2.4} />
                  <span className="num">{fmtMoney(totals.expense, currency)}</span>
                </span>
                <span className="text-sm text-ink-soft">
                  Net{" "}
                  <b
                    className={`num ${
                      totals.income - totals.expense >= 0 ? "text-moss-deep" : "text-coral-deep"
                    }`}
                  >
                    {totals.income - totals.expense >= 0 ? "+" : "\u2212"}
                    {fmtMoney(Math.abs(totals.income - totals.expense), currency)}
                  </b>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      )}

      {toDelete && (
        <ConfirmModal
          title="Delete this entry?"
          body={
            <>
              <b className="text-ink">
                {toDelete.note || catOf(toDelete.categoryId)?.name || "Untitled"}
              </b>{" "}
              — {fmtSigned(toDelete, currency)} on {dayLabel(toDelete.date)}. You can undo right
              after deleting.
            </>
          }
          onConfirm={() => deleteTransaction(toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      )}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
