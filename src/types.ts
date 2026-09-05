export type TxType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: TxType;
  /** monthly budget, expense categories only */
  budget?: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  /** ISO date yyyy-mm-dd (local) */
  date: string;
}

export interface Settings {
  currency: string;
}

export type ViewId = "overview" | "transactions" | "budgets" | "insights";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
  action?: { label: string; fn: () => void };
}
