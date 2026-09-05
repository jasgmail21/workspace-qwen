export type TxType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: TxType;
  /** monthly budget, expense categories only */
  budget?: number;
  /** epoch ms — used for cloud merge (last-write-wins) */
  updatedAt?: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  /** ISO date yyyy-mm-dd (local) */
  date: string;
  /** how it was paid — from the sheet's “Payment Type” column */
  payment?: "cash" | "card";
  /** epoch ms — used for cloud merge (last-write-wins) */
  updatedAt?: number;
}

export interface Settings {
  currency: string;
  updatedAt?: number;
}

/* ---------- cloud sync ---------- */

export interface CloudConfig {
  url: string;
  anonKey: string;
}

export interface CloudUser {
  id: string;
  email: string;
}

export type SyncStatus = "off" | "syncing" | "synced" | "error" | "offline";

export interface CloudState {
  configured: boolean;
  user: CloudUser | null;
  status: SyncStatus;
  lastSync: number | null;
  error: string | null;
}

export type ViewId = "overview" | "transactions" | "budgets" | "insights";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
  action?: { label: string; fn: () => void };
}
