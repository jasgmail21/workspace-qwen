import type { Category, Transaction } from "./types";
import { mulberry32, round2, toISO } from "./utils";

export const SWATCHES = [
  "#3e8e5f",
  "#2f7e58",
  "#4e9e77",
  "#3fa5a0",
  "#31708e",
  "#4e7fb0",
  "#8a5fa0",
  "#c75d7a",
  "#cf4f36",
  "#b0563b",
  "#d97e36",
  "#c9a227",
];

export const ICON_CHOICES = [
  "cart",
  "utensils",
  "coffee",
  "car",
  "home",
  "bolt",
  "film",
  "pulse",
  "bag",
  "plane",
  "briefcase",
  "laptop",
  "trend",
  "coins",
  "receipt",
  "target",
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", color: "#3e8e5f", icon: "cart", type: "expense", budget: 400 },
  { id: "dining", name: "Dining Out", color: "#d97e36", icon: "utensils", type: "expense", budget: 180 },
  { id: "transport", name: "Transport", color: "#4e7fb0", icon: "car", type: "expense", budget: 150 },
  { id: "housing", name: "Housing", color: "#8a5fa0", icon: "home", type: "expense", budget: 1500 },
  { id: "utilities", name: "Utilities", color: "#c9a227", icon: "bolt", type: "expense", budget: 220 },
  { id: "entertainment", name: "Entertainment", color: "#c75d7a", icon: "film", type: "expense", budget: 110 },
  { id: "health", name: "Health", color: "#3fa5a0", icon: "pulse", type: "expense", budget: 120 },
  { id: "shopping", name: "Shopping", color: "#b0563b", icon: "bag", type: "expense", budget: 220 },
  { id: "travel", name: "Travel", color: "#31708e", icon: "plane", type: "expense", budget: 260 },
  { id: "salary", name: "Salary", color: "#2f7e58", icon: "briefcase", type: "income" },
  { id: "freelance", name: "Freelance", color: "#4e9e77", icon: "laptop", type: "income" },
  { id: "invest", name: "Investments", color: "#276e5a", icon: "trend", type: "income" },
];

const FREELANCE_CLIENTS = ["Brightloop", "Atlas & Co", "Fernwood Café"];
const GROCERY_NOTES = ["Green Basket groceries", "Farmers market haul", "Corner store run", "Pantry restock"];
const DINING_NOTES = ["Ramen night", "Coffee & pastry", "Tacos with friends", "Sunday brunch", "Pizza delivery"];

/** ~6 months of realistic, deterministic demo activity so every chart is alive on first load */
export function buildSeedTransactions(): Transaction[] {
  const rand = mulberry32(0x5eed1);
  const ri = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const rf = (min: number, max: number) => round2(min + rand() * (max - min));
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const txs: Transaction[] = [];
  let n = 0;
  const now = new Date();

  for (let back = 5; back >= 0; back--) {
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const maxDay =
      back === 0 ? now.getDate() : new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const add = (
      day: number,
      type: Transaction["type"],
      categoryId: string,
      amount: number,
      note: string
    ) => {
      if (day > maxDay) return;
      txs.push({
        id: `seed-${n++}`,
        type,
        categoryId,
        amount: round2(amount),
        note,
        date: toISO(new Date(base.getFullYear(), base.getMonth(), day)),
      });
    };

    // income
    add(1, "income", "salary", 4350, "Monthly salary · Northwind Studio");
    if (back % 2 === 0)
      add(ri(14, 20), "income", "freelance", rf(520, 1240), `Freelance sprint · ${pick(FREELANCE_CLIENTS)}`);
    if (back === 1 || back === 3) add(20, "income", "invest", rf(38, 92), "Dividends · index fund");

    // fixed expenses
    add(2, "expense", "housing", 1450, "Rent · Maple & 5th apartment");
    add(6, "expense", "utilities", rf(84, 168), "Power & water bill");
    add(7, "expense", "utilities", 49.99, "Fiber internet");
    add(3, "expense", "health", 42, "Gym membership");

    // variable expenses
    for (let i = 0; i < 4; i++)
      if (rand() < 0.9) add(ri(3, 27), "expense", "groceries", rf(26, 96), pick(GROCERY_NOTES));
    for (let i = 0; i < 3; i++)
      if (rand() < 0.85) add(ri(3, 27), "expense", "dining", rf(13, 58), pick(DINING_NOTES));
    add(ri(3, 25), "expense", "transport", 25, "Metro card top-up");
    if (rand() < 0.8) add(ri(3, 26), "expense", "transport", rf(38, 62), "Fuel");
    if (rand() < 0.7) add(ri(3, 26), "expense", "transport", rf(11, 27), "Rideshare home");
    add(8, "expense", "entertainment", 15.99, "Streaming subscription");
    if (rand() < 0.8)
      add(ri(5, 26), "expense", "entertainment", rf(18, 42), pick(["Cinema tickets", "Live jazz night", "Museum pass"]));
    if (rand() < 0.75)
      add(ri(4, 26), "expense", "shopping", rf(22, 140), pick(["Bookshop haul", "New running shoes", "Home goods", "Gift for Ana"]));
    if (rand() < 0.5) add(ri(4, 26), "expense", "health", rf(12, 48), "Pharmacy");
    if (back === 2) add(18, "expense", "travel", 246, "Weekend cabin trip");
    if (back === 4) add(11, "expense", "travel", 318, "Flights home");
  }

  return txs;
}
