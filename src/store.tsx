import type { SupabaseClient } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addTombstone,
  loadCloudConfig,
  makeClient,
  saveCloudConfig,
  syncAll,
} from "./cloud";
import { buildSeedTransactions, DEFAULT_CATEGORIES } from "./data";
import type {
  Category,
  CloudConfig,
  CloudState,
  CloudUser,
  Settings,
  ToastItem,
  Transaction,
} from "./types";
import { fmtMoney, round2, uid } from "./utils";

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
          settings: {
            currency: parsed.settings?.currency ?? "USD",
            updatedAt: parsed.settings?.updatedAt ?? 0,
          },
        };
      }
    }
  } catch {
    /* fall through to seed */
  }
  const now = Date.now();
  return {
    transactions: buildSeedTransactions().map((t) => ({ ...t, updatedAt: now })),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: now })),
    settings: { currency: "USD", updatedAt: now },
  };
}

interface ImportBatchInput {
  transactions: Omit<Transaction, "id" | "updatedAt">[];
  categories: Omit<Category, "id" | "updatedAt">[];
}

interface AppApi {
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
  toasts: ToastItem[];
  cloud: CloudState;
  pushToast: (t: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
  addTransaction: (t: Omit<Transaction, "id" | "updatedAt">) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (categoryId: string, budget: number) => void;
  addCategory: (c: Omit<Category, "id" | "updatedAt">) => boolean;
  deleteCategory: (id: string) => void;
  setCurrency: (code: string) => void;
  resetDemo: () => void;
  importBatch: (b: ImportBatchInput) => void;
  connectCloud: (cfg: CloudConfig) => Promise<string | null>;
  disconnectCloud: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

const userOf = (session: { user: { id: string; email?: string | null } } | null): CloudUser | null =>
  session ? { id: session.user.id, email: session.user.email ?? "" } : null;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadInitial);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [cloud, setCloud] = useState<CloudState>({
    configured: false,
    user: null,
    status: "off",
    lastSync: null,
    error: null,
  });

  const toastId = useRef(1);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clientRef = useRef<SupabaseClient | null>(null);
  const dirtyTx = useRef(new Set<string>());
  const dirtyCat = useRef(new Set<string>());
  const dirtySettings = useRef(false);
  const syncTimer = useRef<number | null>(null);
  const syncingRef = useRef(false);
  const lastErrToast = useRef(0);

  /* ---------- toasts ---------- */

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

  /* ---------- persist local copy ---------- */

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked — app still works in-memory */
    }
  }, [state]);

  /* ---------- cloud sync core ---------- */

  const doSync = useCallback(
    async (manual: boolean) => {
      const client = clientRef.current;
      const user = cloud.user;
      if (!client || !user) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setCloud((c) => ({ ...c, status: "offline" }));
        return;
      }
      if (syncingRef.current) return;
      syncingRef.current = true;
      setCloud((c) => ({ ...c, status: "syncing", error: null }));
      try {
        const s = stateRef.current;
        const result = await syncAll(
          client,
          user.id,
          {
            transactions: s.transactions,
            categories: s.categories,
            currency: s.settings.currency,
            settingsUpdatedAt: s.settings.updatedAt ?? 0,
          },
          { tx: dirtyTx.current, cat: dirtyCat.current, settings: dirtySettings.current }
        );
        dirtyTx.current.clear();
        dirtyCat.current.clear();
        dirtySettings.current = false;
        setState({
          transactions: result.transactions,
          categories: result.categories,
          settings: { currency: result.currency, updatedAt: result.settingsUpdatedAt },
        });
        setCloud((c) => ({ ...c, status: "synced", lastSync: Date.now(), error: null }));
        if (result.ingestedFromSheet > 0) {
          pushToast({
            kind: "success",
            message: `Imported ${result.ingestedFromSheet} entr${result.ingestedFromSheet === 1 ? "y" : "ies"} from your Google Sheet`,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sync failed";
        setCloud((c) => ({ ...c, status: "error", error: msg }));
        const nowTs = Date.now();
        if (manual || nowTs - lastErrToast.current > 45000) {
          lastErrToast.current = nowTs;
          pushToast({ kind: "error", message: `Cloud sync failed — ${msg}` });
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [cloud.user, pushToast]
  );

  const scheduleSync = useCallback(
    (delay = 1200) => {
      if (!clientRef.current || !cloud.user) return;
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => void doSync(false), delay);
    },
    [cloud.user, doSync]
  );

  const markAllDirty = useCallback(() => {
    const s = stateRef.current;
    dirtyTx.current = new Set(s.transactions.map((t) => t.id));
    dirtyCat.current = new Set(s.categories.map((c) => c.id));
    dirtySettings.current = true;
  }, []);

  const markDirtyAndSync = useCallback(
    (kind: "tx" | "cat" | "settings", id?: string) => {
      if (kind === "tx" && id) dirtyTx.current.add(id);
      if (kind === "cat" && id) dirtyCat.current.add(id);
      if (kind === "settings") dirtySettings.current = true;
      scheduleSync();
    },
    [scheduleSync]
  );

  /* ---------- boot: restore session + connectivity listeners ---------- */

  useEffect(() => {
    const cfg = loadCloudConfig();
    let cancelled = false;
    if (cfg) {
      const client = makeClient(cfg);
      clientRef.current = client;
      setCloud((c) => ({ ...c, configured: true }));
      client.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        const u = userOf(data.session);
        if (u) {
          setCloud((c) => ({ ...c, user: u }));
        }
      });
      client.auth.onAuthStateChange((_event, session) => {
        if (cancelled) return;
        setCloud((c) => ({ ...c, user: userOf(session) }));
      });
    }

    const goOnline = () => {
      setCloud((c) => (c.user ? { ...c, status: "syncing" } : c));
      void doSync(false);
    };
    const goOffline = () => setCloud((c) => ({ ...c, status: "offline" }));
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* sync once a session appears */
  useEffect(() => {
    if (cloud.user && clientRef.current) {
      markAllDirty(); // first sync uploads this device's full ledger; LWW keeps it safe
      const t = window.setTimeout(() => void doSync(false), 500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.user?.id]);

  /* ---------- api ---------- */

  const api = useMemo<AppApi>(() => {
    const now = () => Date.now();
    const categoryOf = (id: string) => state.categories.find((c) => c.id === id);

    return {
      transactions: state.transactions,
      categories: state.categories,
      settings: state.settings,
      toasts,
      cloud,
      pushToast,
      dismissToast,

      addTransaction(t) {
        const tx: Transaction = { ...t, id: uid(), updatedAt: now() };
        setState((s) => ({ ...s, transactions: [...s.transactions, tx] }));
        markDirtyAndSync("tx", tx.id);
        const cat = categoryOf(t.categoryId);
        pushToast({
          kind: "success",
          message: `${t.type === "income" ? "Income" : "Expense"} added · ${fmtMoney(t.amount, state.settings.currency)}${cat ? ` (${cat.name})` : ""}`,
        });
      },

      updateTransaction(t) {
        const tx = { ...t, updatedAt: now() };
        setState((s) => ({
          ...s,
          transactions: s.transactions.map((x) => (x.id === t.id ? tx : x)),
        }));
        markDirtyAndSync("tx", tx.id);
        pushToast({ kind: "success", message: "Transaction updated" });
      },

      deleteTransaction(id) {
        const tx = state.transactions.find((x) => x.id === id);
        setState((s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== id) }));
        addTombstone({ table: "transactions", id, at: now() });
        markDirtyAndSync("tx");
        if (tx) {
          pushToast({
            kind: "info",
            message: `Deleted “${tx.note || categoryOf(tx.categoryId)?.name || "transaction"}”`,
            action: {
              label: "Undo",
              fn: () =>
                setState((s) => ({
                  ...s,
                  transactions: [...s.transactions, { ...tx, updatedAt: Date.now() }],
                })),
            },
          });
        }
      },

      setBudget(categoryId, budget) {
        const b = round2(budget);
        setState((s) => ({
          ...s,
          categories: s.categories.map((c) =>
            c.id === categoryId ? { ...c, budget: b, updatedAt: now() } : c
          ),
        }));
        markDirtyAndSync("cat", categoryId);
        const cat = categoryOf(categoryId);
        pushToast({
          kind: "success",
          message: `${cat?.name ?? "Category"} budget set to ${fmtMoney(b, state.settings.currency)}/mo`,
        });
      },

      addCategory(c) {
        const name = c.name.trim();
        if (!name) return false;
        if (state.categories.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
          pushToast({ kind: "error", message: `A category named “${name}” already exists` });
          return false;
        }
        const cat: Category = { ...c, name, id: `cat-${uid()}`, updatedAt: now() };
        setState((s) => ({ ...s, categories: [...s.categories, cat] }));
        markDirtyAndSync("cat", cat.id);
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
        addTombstone({ table: "categories", id, at: now() });
        markDirtyAndSync("cat");
        pushToast({ kind: "info", message: `Category “${cat?.name}” deleted` });
      },

      setCurrency(code) {
        setState((s) => ({ ...s, settings: { currency: code, updatedAt: now() } }));
        markDirtyAndSync("settings");
        pushToast({ kind: "success", message: `Currency switched to ${code}` });
      },

      resetDemo() {
        const ts = now();
        setState((prev) => ({
          transactions: buildSeedTransactions().map((t) => ({ ...t, updatedAt: ts })),
          categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: ts })),
          settings: prev.settings,
        }));
        markAllDirty();
        scheduleSync();
        pushToast({ kind: "success", message: "Demo data restored" });
      },

      importBatch({ transactions: txIn, categories: catIn }) {
        const ts = now();
        const existing = new Set(
          state.transactions.map(
            (t) => `${t.date}|${t.amount.toFixed(2)}|${t.categoryId}|${t.note}`
          )
        );
        const newCats: Category[] = catIn.map((c) => ({ ...c, id: `cat-${uid()}`, updatedAt: ts }));
        const catIdBySig = new Map<string, string>();
        for (const c of [...state.categories, ...newCats]) {
          catIdBySig.set(`${c.type}|${c.name.toLowerCase()}`, c.id);
        }
        let added = 0;
        let dupes = 0;
        const newTx: Transaction[] = [];
        for (const t of txIn) {
          const key = `${t.date}|${t.amount.toFixed(2)}|${catIdBySig.get(`${t.type}|${t.categoryId.toLowerCase()}`) ?? t.categoryId}|${t.note}`;
          if (existing.has(key)) {
            dupes++;
            continue;
          }
          existing.add(key);
          const tx: Transaction = {
            ...t,
            categoryId: catIdBySig.get(`${t.type}|${t.categoryId.toLowerCase()}`) ?? t.categoryId,
            id: uid(),
            updatedAt: ts + added,
          };
          newTx.push(tx);
          added++;
        }
        if (added === 0 && newCats.length === 0) {
          pushToast({
            kind: "info",
            message: dupes > 0 ? `Nothing new — ${dupes} duplicate rows skipped` : "Nothing to import",
          });
          return;
        }
        setState((s) => ({
          ...s,
          transactions: [...s.transactions, ...newTx],
          categories: [...s.categories, ...newCats],
        }));
        newTx.forEach((t) => dirtyTx.current.add(t.id));
        newCats.forEach((c) => dirtyCat.current.add(c.id));
        scheduleSync();
        pushToast({
          kind: "success",
          message: `Imported ${added} transaction${added === 1 ? "" : "s"}${dupes ? ` · ${dupes} duplicates skipped` : ""}${newCats.length ? ` · ${newCats.length} new categor${newCats.length === 1 ? "y" : "ies"}` : ""}`,
        });
      },

      /* ---------- cloud actions ---------- */

      async connectCloud(cfg) {
        const url = cfg.url.trim().replace(/\/$/, "");
        const anonKey = cfg.anonKey.trim();
        if (!/^https:\/\/.+\.supabase\.co$/.test(url)) {
          return "That doesn’t look like a Supabase project URL (https://xxxx.supabase.co).";
        }
        if (anonKey.length < 20)
          return "That publishable key looks too short — copy the full key from Project Settings → API keys.";
        const client = makeClient({ url, anonKey });
        clientRef.current = client;
        saveCloudConfig({ url, anonKey });
        setCloud((c) => ({ ...c, configured: true }));
        const { data, error } = await client.auth.getSession();
        if (error) return error.message;
        const u = userOf(data.session);
        if (u) setCloud((c) => ({ ...c, user: u }));
        client.auth.onAuthStateChange((_e, session) => {
          setCloud((c) => ({ ...c, user: userOf(session) }));
        });
        return null;
      },

      disconnectCloud() {
        clientRef.current = null;
        saveCloudConfig(null);
        setCloud({ configured: false, user: null, status: "off", lastSync: null, error: null });
        pushToast({ kind: "info", message: "Cloud disconnected — your local ledger is untouched" });
      },

      async signIn(email, password) {
        const client = clientRef.current;
        if (!client) return "Connect a project first.";
        const { error } = await client.auth.signInWithPassword({ email, password });
        return error ? error.message : null;
      },

      async signUp(email, password) {
        const client = clientRef.current;
        if (!client) return "Connect a project first.";
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) return error.message;
        if (!data.session) {
          return "Account created — check your inbox and confirm the email, then sign in.";
        }
        return null;
      },

      async signOut() {
        await clientRef.current?.auth.signOut();
        setCloud((c) => ({ ...c, user: null, status: "off" }));
        pushToast({ kind: "info", message: "Signed out — data stays on this device" });
      },

      async syncNow() {
        await doSync(true);
      },
    };
  }, [state, toasts, cloud, pushToast, doSync, markAllDirty, markDirtyAndSync, scheduleSync]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
