import React, { useMemo, useState } from "react";
import { Icon } from "./Icons";
import { useApp } from "../store";
import type { Transaction } from "../types";
import { dayLabel, fmtMoney, fmtSigned } from "../utils";

export function CategoryTransactionsModal({
  categoryId,
  monthKey,
  onClose,
  onEdit,
}: {
  categoryId: string;
  monthKey: string;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
}) {
  const { transactions, categories, settings } = useApp();
  const currency = settings.currency;
  const cat = categories.find((c) => c.id === categoryId);

  const txs = useMemo(() => {
    return transactions
      .filter((t) => t.categoryId === categoryId && (monthKey === "all" || t.date.startsWith(monthKey)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, categoryId, monthKey]);

  const total = txs.reduce((sum, t) => sum + t.amount, 0);

  if (!cat) return null;

  return (
    <div
      className="anim-fade fixed inset-0 z-[70] flex items-center justify-center bg-pine/60 p-4"
      onClick={onClose}
    >
      <div
        className="anim-pop flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border-2 border-pine bg-card shadow-[8px_8px_0_0_rgba(13,33,26,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-lg text-paper"
              style={{ background: cat.color }}
            >
              <Icon name={(cat.icon as any) ?? "coins"} size={18} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">{cat.name}</h2>
              <p className="text-[12px] text-ink-soft">
                {txs.length} transaction{txs.length !== 1 ? "s" : ""} · Total{" "}
                <span className="num font-bold text-ink">{fmtMoney(total, currency)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-line-soft hover:text-ink cursor-pointer"
            aria-label="Close"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {txs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-line text-ink-faint">
                <Icon name="receipt" size={28} strokeWidth={1.6} />
              </div>
              <div>
                <p className="font-display text-base font-semibold text-ink">No transactions yet</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Transactions in this category will appear here.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {txs.map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-line-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{t.note || cat.name}</p>
                    <p className="text-[12px] text-ink-faint">
                      {dayLabel(t.date)}
                      {t.payment ? ` · ${t.payment === "card" ? "Card" : "Cash"}` : ""}
                    </p>
                  </div>
                  <span
                    className={`num text-sm font-bold ${
                      t.type === "income" ? "text-moss-deep" : "text-ink"
                    }`}
                  >
                    {fmtSigned(t, currency)}
                  </span>
                  <button
                    onClick={() => onEdit(t)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-faint opacity-0 transition-all hover:bg-card hover:text-ink group-hover:opacity-100 cursor-pointer"
                    aria-label="Edit transaction"
                  >
                    <Icon name="pencil" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-line bg-card py-2.5 text-sm font-bold text-ink-soft transition-all hover:border-ink-faint hover:text-ink cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
