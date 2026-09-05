import React, { useEffect, useState } from "react";
import { AddFAB, MobileBar, Sidebar, ToastHost } from "./components/layout";
import { TransactionModal } from "./components/modals";
import { AppProvider, useApp } from "./store";
import type { Transaction, ViewId } from "./types";
import { CURRENCIES, currentMonthKey } from "./utils";
import { Budgets } from "./views/Budgets";
import { Insights } from "./views/Insights";
import { Overview } from "./views/Overview";
import { Transactions } from "./views/Transactions";

function Shell() {
  const { settings, setCurrency } = useApp();
  const [view, setView] = useState<ViewId>("overview");
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [txModal, setTxModal] = useState<{ open: boolean; tx: Transaction | null }>({
    open: false,
    tx: null,
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const openAdd = () => setTxModal({ open: true, tx: null });
  const openEdit = (t: Transaction) => setTxModal({ open: true, tx: t });
  const closeTx = () => setTxModal({ open: false, tx: null });

  return (
    <div className="min-h-screen">
      <Sidebar view={view} setView={setView} />
      <MobileBar view={view} setView={setView} onAdd={openAdd} />

      <main className="lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-24 lg:pt-10">
          <div key={view} className="anim-rise">
            {view === "overview" && (
              <Overview monthKey={monthKey} onMonth={setMonthKey} onAdd={openAdd} goTo={setView} />
            )}
            {view === "transactions" && <Transactions onAdd={openAdd} onEdit={openEdit} />}
            {view === "budgets" && <Budgets monthKey={monthKey} onMonth={setMonthKey} />}
            {view === "insights" && <Insights />}
          </div>

          <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-6 text-[12px] text-ink-faint">
            <span className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-pine text-mint">
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21v-8" />
                  <path d="M12 13C12 8.5 8.9 6 4.5 6 4.5 10.5 7.6 13 12 13z" />
                  <path d="M12 11c0-3.5 2.7-5.5 6.5-5.5C18.5 9 15.8 11 12 11z" />
                </svg>
              </span>
              Sprout — a private ledger that lives in your browser.
            </span>
            <span className="flex items-center gap-3">
              <label htmlFor="currency-mobile" className="lg:hidden">
                Currency
                <select
                  id="currency-mobile"
                  className="field num ml-2 w-auto px-2 py-1 text-[12px]"
                  value={settings.currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
              <span className="num">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </span>
          </footer>
        </div>
      </main>

      <AddFAB onAdd={openAdd} />
      <ToastHost />

      {txModal.open && <TransactionModal initial={txModal.tx} onClose={closeTx} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
