import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildSeedTransactions, DEFAULT_CATEGORIES } from "./data";
import type { Category, Settings, ToastItem, Transaction } from "./types";
import { fmtMoney, uid } from "./utils";

const STORAGE_KEY = "sprout.ledger.v1";

interface PersistedState {
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
}

function loadInitial(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (Array.isArray(parsed.transactions) && Array.isArray(parsed.categories)) {
        return {
          transactions: parsed.transactions,
          categories: parsed.categories,
          settings: { currency: parsed.settings?.currency ?? "USD" },
        };
      }
    }
  } catch {
    /* fall through to seed */
  }
  return {
    transactions: buildSeedTransactions(),
    categories: DEFAULT_CATEGORIES,
    settings: { currency: "USD" },
  };
}

interface AppApi {
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
  toasts: ToastItem[];
  pushToast: (t: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
  addTransaction: (t: Omit<Transaction, "id">) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (categoryId: string, budget: number) => void;
  addCategory: (c: Omit<Category, "id">) => boolean;
  deleteCategory: (id: string) => void;
  setCurrency: (code: string) => void;
  resetDemo: () => void;
}

const Ctx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadInitial);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(1);

  /* persist */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked — app still works in-memory */
    }
  }, [state]);

  const dismissToast = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = toastId.current++;
      setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismissToast(id), 4600);
    },
    [dismissToast]
  );

  const api = useMemo<AppApi>(() => {
    const categoryOf = (id: string) => state.categories.find((c) => c.id === id);

    return {
      transactions: state.transactions,
      categories: state.categories,
      settings: state.settings,
      toasts,
      pushToast,
      dismissToast,

      addTransaction(t) {
        const tx: Transaction = { ...t, id: uid() };
        setState((s) => ({ ...s, transactions: [...s.transactions, tx] }));
        const cat = categoryOf(t.categoryId);
        pushToast({
          kind: "success",
          message: `${t.type === "income" ? "Income" : "Expense"} added · ${fmtMoney(t.amount, state.settings.currency)}${cat ? ` (${cat.name})` : ""}`,
        });
      },

      updateTransaction(t) {
        setState((s) => ({
          ...s,
          transactions: s.transactions.map((x) => (x.id === t.id ? t : x)),
        }));
        pushToast({ kind: "success", message: "Transaction updated" });
      },

      deleteTransaction(id) {
        const tx = state.transactions.find((x) => x.id === id);
        setState((s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== id) }));
        if (tx) {
          pushToast({
            kind: "info",
            message: `Deleted “${tx.note || categoryOf(tx.categoryId)?.name || "transaction"}”`,
            action: {
              label: "Undo",
              fn: () => setState((s) => ({ ...s, transactions: [...s.transactions, tx] })),
            },
          });
        }
      },

      setBudget(categoryId, budget) {
        setState((s) => ({
          ...s,
          categories: s.categories.map((c) => (c.id === categoryId ? { ...c, budget } : c)),
        }));
        const cat = categoryOf(categoryId);
        pushToast({
          kind: "success",
          message: `${cat?.name ?? "Category"} budget set to ${fmtMoney(budget, state.settings.currency)}/mo`,
        });
      },

      addCategory(c) {
        const name = c.name.trim();
        if (!name) return false;
        if (state.categories.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
          pushToast({ kind: "error", message: `A category named “${name}” already exists` });
          return false;
        }
        const cat: Category = { ...c, name, id: `cat-${uid()}` };
        setState((s) => ({ ...s, categories: [...s.categories, cat] }));
        pushToast({ kind: "success", message: `Category “${name}” created` });
        return true;
      },

      deleteCategory(id) {
        const inUse = state.transactions.some((t) => t.categoryId === id);
        const cat = categoryOf(id);
        if (inUse) {
          pushToast({
            kind: "error",
            message: `“${cat?.name}” can’t be deleted — transactions still use it`,
          });
          return;
        }
        setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
        pushToast({ kind: "info", message: `Category “${cat?.name}” deleted` });
      },

      setCurrency(code) {
        setState((s) => ({ ...s, settings: { ...s.settings, currency: code } }));
        pushToast({ kind: "success", message: `Currency switched to ${code}` });
      },

      resetDemo() {
        setState({
          transactions: buildSeedTransactions(),
          categories: DEFAULT_CATEGORIES,
          settings: state.settings,
        });
        pushToast({ kind: "success", message: "Demo data restored" });
      },
    };
  }, [state, toasts, pushToast, dismissToast]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
