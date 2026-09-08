import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../store";
import type { Category, Transaction, TxType } from "../types";
import { fmtMoney, todayISO } from "../utils";
import { Icon, IconName } from "./Icons";
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY } from "./ui";
import { ICON_CHOICES, SWATCHES } from "../data";

/* ---------------- shell ---------------- */

export function ModalShell({
  onClose,
  children,
  width = "sm:max-w-lg",
}: {
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-pine/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`anim-pop relative max-h-[92vh] w-full overflow-y-auto rounded-t-xl border-2 border-pine bg-card shadow-[10px_10px_0_0_rgba(13,33,26,0.35)] sm:rounded-xl ${width}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-line px-5 py-4 sm:px-6">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <button
        onClick={onClose}
        className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-line-soft hover:text-ink cursor-pointer"
        aria-label="Close"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

/* ---------------- transaction add / edit ---------------- */

export function TransactionModal({
  initial,
  defaultType = "expense",
  onClose,
}: {
  initial?: Transaction | null;
  defaultType?: TxType;
  onClose: () => void;
}) {
  const { categories, addTransaction, updateTransaction, settings } = useApp();
  const [type, setType] = useState<TxType>(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [payment, setPayment] = useState<Transaction["payment"]>(initial?.payment);
  const [error, setError] = useState("");
  const [catModal, setCatModal] = useState(false);

  const typeCats = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!typeCats.some((c) => c.id === categoryId)) {
      setCategoryId(typeCats[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const parsed = parseFloat(amount);
  const validAmount = !isNaN(parsed) && parsed > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validAmount) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!categoryId) {
      setError("Pick a category first.");
      return;
    }
    const payload = {
      type,
      amount: Math.round(parsed * 100) / 100,
      categoryId,
      date: date || todayISO(),
      note: note.trim(),
      payment,
    };
    if (initial) updateTransaction({ ...payload, id: initial.id, sourceRef: initial.sourceRef });
    else addTransaction(payload);
    onClose();
  };

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title={initial ? "Edit transaction" : "New transaction"} onClose={onClose} />
      <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-6">
        {/* type toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-paper p-1.5">
          {(["expense", "income"] as TxType[]).map((t) => {
            const active = type === t;
            return (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all duration-150 cursor-pointer ${
                  active
                    ? t === "expense"
                      ? "bg-coral text-paper shadow-sm"
                      : "bg-moss text-paper shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                <Icon name={t === "expense" ? "downRight" : "upRight"} size={16} strokeWidth={2.2} />
                {t === "expense" ? "Expense" : "Income"}
              </button>
            );
          })}
        </div>

        {/* amount */}
        <div>
          <label className="stamp mb-2 block text-ink-soft">Amount</label>
          <div
            className={`flex items-center gap-2 rounded-xl border-2 bg-card px-4 py-3 transition-colors ${
              error && !validAmount ? "border-coral" : "border-line focus-within:border-moss"
            }`}
          >
            <span className="font-display text-xl font-bold text-ink-faint">
              {type === "expense" ? "\u2212" : "+"}
            </span>
            <input
              autoFocus
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              className="num w-full bg-transparent text-2xl font-bold text-ink outline-none placeholder:text-ink-faint/60"
            />
            <span className="text-xs font-semibold text-ink-faint">{settings.currency}</span>
          </div>
          {error && (
            <p className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-coral-deep">
              <Icon name="alert" size={14} /> {error}
            </p>
          )}
        </div>

        {/* category */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="stamp text-ink-soft">Category</label>
            <button
              type="button"
              onClick={() => setCatModal(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-bold text-moss-deep transition-colors hover:bg-mint-dim cursor-pointer"
            >
              <Icon name="plus" size={13} strokeWidth={2.6} /> New category
            </button>
          </div>
          {typeCats.length === 0 ? (
            <button
              type="button"
              onClick={() => setCatModal(true)}
              className="w-full rounded-lg border-2 border-dashed border-line px-3 py-4 text-sm font-semibold text-ink-soft transition-colors hover:border-moss hover:text-moss-deep cursor-pointer"
            >
              No {type} categories yet — click to create one
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {typeCats.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-2 text-left text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
                      active
                        ? "border-pine bg-mint-dim text-ink shadow-[2px_2px_0_0_var(--color-pine)]"
                        : "border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink"
                    }`}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-paper"
                      style={{ background: c.color }}
                    >
                      <Icon name={c.icon as IconName} size={15} />
                    </span>
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* date + note */}
        <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
          <div>
            <label className="stamp mb-2 block text-ink-soft">Date</label>
            <input type="date" className="field" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="stamp mb-2 block text-ink-soft">Note</label>
            <input
              className="field"
              placeholder={type === "expense" ? "e.g. Saturday market run" : "e.g. March invoice"}
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* paid via */}
        <div>
          <label className="stamp mb-2 block text-ink-soft">Paid via</label>
          <div className="inline-flex items-center gap-1 rounded-[10px] border border-line bg-paper p-1">
            {(
              [
                { v: undefined, label: "—" },
                { v: "cash", label: "Cash / UPI" },
                { v: "card", label: "Card" },
              ] as { v: Transaction["payment"]; label: string }[]
            ).map((o) => (
              <button
                type="button"
                key={o.label}
                onClick={() => setPayment(o.v)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  payment === o.v ? "bg-pine text-mint" : "text-ink-soft hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-dashed border-line pt-4">
          <button type="button" className={BTN_GHOST} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={BTN_PRIMARY}>
            <Icon name={initial ? "check" : "plus"} size={16} strokeWidth={2.4} />
            {initial ? "Save changes" : type === "expense" ? "Add expense" : "Add income"}
          </button>
        </div>
      </form>

      {catModal && (
        <CategoryModal
          defaultType={type}
          onCreated={(c) => setCategoryId(c.id)}
          onClose={() => setCatModal(false)}
        />
      )}
    </ModalShell>
  );
}

/* ---------------- category create ---------------- */

export function CategoryModal({
  onClose,
  initial,
  defaultType = "expense",
  onCreated,
}: {
  onClose: () => void;
  /** when provided, the modal edits this category instead of creating one */
  initial?: Category;
  defaultType?: TxType;
  onCreated?: (c: Category) => void;
}) {
  const { addCategory, updateCategory } = useApp();
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<TxType>(initial?.type ?? defaultType);
  const [color, setColor] = useState(initial?.color ?? SWATCHES[0]);
  const swatches =
    editing && initial && !SWATCHES.includes(initial.color)
      ? [initial.color, ...SWATCHES]
      : SWATCHES;
  const [icon, setIcon] = useState<IconName>((initial?.icon as IconName) ?? "cart");
  const [budget, setBudget] = useState(
    initial?.budget != null && initial.budget > 0 ? String(initial.budget) : ""
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseFloat(budget);
    const budgetVal =
      type === "expense" && !isNaN(b) && b > 0 ? Math.round(b * 100) / 100 : undefined;
    if (editing && initial) {
      updateCategory({ ...initial, name, color, icon, budget: budgetVal });
      onClose();
      return;
    }
    const cat = addCategory({ name, type, color, icon, budget: budgetVal });
    if (cat) {
      onCreated?.(cat);
      onClose();
    }
  };

  return (
    <ModalShell onClose={onClose} width="sm:max-w-md">
      <ModalHeader title={editing ? "Edit category" : "New category"} onClose={onClose} />
      <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <label className="stamp mb-2 block text-ink-soft">Name</label>
          <input
            autoFocus
            className="field"
            placeholder="e.g. Pets, Subscriptions…"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="stamp mb-2 block text-ink-soft">Type</label>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-paper p-1.5">
            {(["expense", "income"] as TxType[]).map((t) => (
              <button
                type="button"
                key={t}
                disabled={editing}
                onClick={() => setType(t)}
                className={`rounded-lg py-2 text-sm font-bold transition-colors ${
                  editing ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                } ${
                  type === t
                    ? t === "expense"
                      ? "bg-coral text-paper"
                      : "bg-moss text-paper"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t === "expense" ? "Expense" : "Income"}
              </button>
            ))}
            {editing && (
              <p className="col-span-2 text-[11px] text-ink-faint">
                Type is fixed so existing entries stay consistent.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="stamp mb-2 block text-ink-soft">Color</label>
          <div className="flex flex-wrap gap-2">
            {swatches.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setColor(s)}
                aria-label={`Color ${s}`}
                className={`h-8 w-8 rounded-full border-2 transition-transform cursor-pointer ${
                  color === s ? "scale-110 border-pine shadow-[2px_2px_0_0_var(--color-pine)]" : "border-transparent hover:scale-105"
                }`}
                style={{ background: s }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="stamp mb-2 block text-ink-soft">Icon</label>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((ic) => (
              <button
                type="button"
                key={ic}
                onClick={() => setIcon(ic as IconName)}
                className={`grid h-10 w-10 place-items-center rounded-lg border-2 transition-all cursor-pointer ${
                  icon === ic
                    ? "border-pine bg-mint-dim text-ink shadow-[2px_2px_0_0_var(--color-pine)]"
                    : "border-line text-ink-soft hover:border-ink-faint hover:text-ink"
                }`}
              >
                <Icon name={ic as IconName} size={18} />
              </button>
            ))}
          </div>
        </div>

        {type === "expense" && (
          <div>
            <label className="stamp mb-2 block text-ink-soft">Monthly budget (optional)</label>
            <input
              className="field num"
              type="number"
              step="1"
              min="0"
              placeholder="250"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-dashed border-line pt-4">
          <button type="button" className={BTN_GHOST} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={BTN_PRIMARY}>
            <Icon name={editing ? "check" : "plus"} size={16} strokeWidth={2.4} />
            {editing ? "Save changes" : "Create category"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ---------------- confirm ---------------- */

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose} width="sm:max-w-sm">
      <div className="px-6 py-6">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-coral-soft text-coral-deep">
          <Icon name="alert" size={22} />
        </div>
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <div className="mt-1.5 text-sm leading-6 text-ink-soft">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={BTN_GHOST} onClick={onClose}>
            Cancel
          </button>
          <button
            className={BTN_DANGER}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Icon name="trash" size={15} /> {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
