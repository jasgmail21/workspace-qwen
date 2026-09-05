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
  { id: "groceries", name: "Groceries", color: "#3e8e5f", icon: "cart", type: "expense", budget: 8000 },
  { id: "dining", name: "Dining Out", color: "#d97e36", icon: "utensils", type: "expense", budget: 4000 },
  { id: "transport", name: "Transport", color: "#4e7fb0", icon: "car", type: "expense", budget: 3500 },
  { id: "housing", name: "Housing", color: "#8a5fa0", icon: "home", type: "expense", budget: 25000 },
  { id: "utilities", name: "Utilities", color: "#c9a227", icon: "bolt", type: "expense", budget: 3500 },
  { id: "entertainment", name: "Entertainment", color: "#c75d7a", icon: "film", type: "expense", budget: 2000 },
  { id: "health", name: "Health", color: "#3fa5a0", icon: "pulse", type: "expense", budget: 2500 },
  { id: "shopping", name: "Shopping", color: "#b0563b", icon: "bag", type: "expense", budget: 5000 },
  { id: "travel", name: "Travel", color: "#31708e", icon: "plane", type: "expense", budget: 6000 },
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
    add(1, "income", "salary", 52000, "Monthly salary · Northwind Studio");
    if (back % 2 === 0)
      add(ri(14, 20), "income", "freelance", rf(6000, 15000), `Freelance sprint · ${pick(FREELANCE_CLIENTS)}`);
    if (back === 1 || back === 3) add(20, "income", "invest", rf(450, 1100), "Dividends · index fund");

    // fixed expenses
    add(2, "expense", "housing", 18000, "Rent · apartment");
    add(6, "expense", "utilities", rf(900, 2200), "Power & water bill");
    add(7, "expense", "utilities", 499, "Fiber internet");
    add(3, "expense", "health", 1200, "Gym membership");

    // variable expenses
    for (let i = 0; i < 4; i++)
      if (rand() < 0.9) add(ri(3, 27), "expense", "groceries", rf(350, 1400), pick(GROCERY_NOTES));
    for (let i = 0; i < 3; i++)
      if (rand() < 0.85) add(ri(3, 27), "expense", "dining", rf(180, 900), pick(DINING_NOTES));
    add(ri(3, 25), "expense", "transport", 500, "Metro card top-up");
    if (rand() < 0.8) add(ri(3, 26), "expense", "transport", rf(1800, 3200), "Fuel");
    if (rand() < 0.7) add(ri(3, 26), "expense", "transport", rf(120, 350), "Rideshare home");
    add(8, "expense", "entertainment", 199, "Streaming subscription");
    if (rand() < 0.8)
      add(ri(5, 26), "expense", "entertainment", rf(250, 800), pick(["Cinema tickets", "Live music night", "Museum pass"]));
    if (rand() < 0.75)
      add(ri(4, 26), "expense", "shopping", rf(400, 3500), pick(["Bookshop haul", "New running shoes", "Home goods", "Gift for Ana"]));
    if (rand() < 0.5) add(ri(4, 26), "expense", "health", rf(150, 900), "Pharmacy");
    if (back === 2) add(18, "expense", "travel", 5400, "Weekend trip · Coorg");
    if (back === 4) add(11, "expense", "travel", 7200, "Flights home");
  }

  return txs;
}
