import type { TxType } from "./types";
import { round2, toISO } from "./utils";

/* ================= CSV / value parsing (shared by manual import + live sheet sync) ================= */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function ymd(y: number, m: number, d: number): string | null {
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1980 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Accepts: 2021-03-05 · 05/03/2021 · 3/5/21 · 05-Mar-2021 · 1-Sep-2026 · Mar 5, 2021 ·
 *  5 March 2021 · 2021/03/05 · 05.03.2021 · epoch ms/s · and anything Date.parse knows. */
export function parseDate(s: string): string | null {
  s = s.trim().replace(/[\u200e\u200f\u00a0]/g, ""); // strip LRM/RLM marks Sheets exports
  if (!s) return null;

  let m = s.match(/^(\d{10})(\d{3})?$/); // epoch
  if (m) {
    const d = new Date(m[2] ? Number(s) : Number(s) * 1000);
    return isNaN(d.getTime()) ? null : toISO(d);
  }

  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // ISO / yyyy/mm/dd
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[ \-/.]([A-Za-z]{3,9})[ \-/.]*(\d{2,4})$/); // 5 Mar 2021 / 05-Mar-21
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()])
    return ymd(Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]));

  m = s.match(/^([A-Za-z]{3,9})[ \-/.](\d{1,2}),?\s*(\d{2,4})$/); // Mar 5, 2021
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()])
    return ymd(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2]));

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/); // d/m/y — assume day-first (India), auto-swap if impossible
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]); const y = Number(m[3]);
    if (a > 12 && b <= 12) return ymd(y, b, a); // clearly day-first (25/03/2021)
    if (b > 12 && a <= 12) return ymd(y, a, b); // clearly month-first (03/25/2021)
    return ymd(y, b, a) ?? ymd(y, a, b); // ambiguous → day-first, then month-first
  }

  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1980 && d.getFullYear() < 2100) return toISO(d);
  return null;
}

/** Handles $1,234.56 · ₹12,34,567.89 · 1.234,56 · 45,00 · (45.00) · -45 · plain numbers. */
export function parseAmount(s: string): number | null {
  let t = s.trim().replace(/[^\d.,\-+()]/g, "");
  if (!t) return null;
  const negParen = /^\(.*\)$/.test(t);
  if (t.includes(",") && t.includes(".")) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(/,/g, "."); // EU 1.234,56
    else t = t.replace(/,/g, ""); // US / Indian 1,234.56 / 12,34,567.89
  } else if (t.includes(",")) {
    t = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, ""); // 45,00 → decimal · 1,234 → thousands
  }
  const v = parseFloat(t);
  if (isNaN(v)) return null;
  return negParen ? -Math.abs(v) : v;
}

export function parseType(s: string | null, amount: number, allExpense: boolean): TxType {
  if (s) {
    const v = s.toLowerCase();
    if (/inflow|income|inc\b|dep\b|deposit|credit|cr\b|earned|salary|received|\bin\b/.test(v))
      return "income";
    if (/outflow|expense|exp\b|with\b|withdraw|debit|dr\b|spent|purchase|paid\b|\bout\b/.test(v))
      return "expense";
  }
  if (amount < 0) return "expense";
  return allExpense ? "expense" : "income";
}

export function parsePayment(s: string | null): "cash" | "card" | undefined {
  if (!s) return undefined;
  const v = s.toLowerCase();
  if (/cash|upi|gpay|paytm|phonepe|neft|imps|net ?banking/.test(v)) return "cash";
  if (/card|credit|debit|amex|visa|master|\bcc\b/.test(v)) return "card";
  return undefined;
}

export interface Mapping {
  date: number;
  amount: number;
  type: number;
  category: number;
  note: number;
  payment: number;
}

/** Word-boundary matching so e.g. "Summary" never steals the "sum/amount" slot. */
export function guessMapping(headers: string[]): Mapping {
  const h = headers.map((x) => x.toLowerCase().trim());
  const findIdx = (re: RegExp, skip: number[]) =>
    h.findIndex((x, i) => !skip.includes(i) && re.test(x));
  const date = findIdx(/\b(date|day|when)\b/, []);
  const amount = findIdx(/\b(amount|amt|value|total|price|cost|sum|rs|inr)\b/, [date]);
  const type = findIdx(/\b(type|kind|flow|direction)\b|in\s*\/\s*out/, [date, amount]);
  const payment = findIdx(/\b(payment|paid|pay|mode|channel|via|method)\b/, [date, amount, type]);
  const category = findIdx(/\b(categor(y|ies)?|group|tag|class|bucket|head)\b/, [date, amount, type, payment]);
  const note = findIdx(
    /\b(note|summary|desc(ription)?|memo|detail(s)?|item|particular(s)?|payee|merchant|label|narration|remark(s)?|name)\b/,
    [date, amount, type, payment, category]
  );
  return { date, amount, type, category, note, payment };
}

/* -------- smart category inference from the note text -------- */

export const NOTE_RULES: { re: RegExp; cat: string; income?: boolean }[] = [
  { re: /\bitr\b|tds|tax|challan/i, cat: "Taxes" },
  { re: /wedding|marriage|shaadi|lehnga|tent|\bdj\b/i, cat: "Celebrations" },
  { re: /dasvand|donat|charity|seva|gave\b/i, cat: "Charity & Giving" },
  { re: /rent|landlord|maintenance|society/i, cat: "Housing" },
  { re: /petrol|diesel|fuel|fasttag|toll|uber|ola|rapido|metro|auto|bike|car\b|i20|tyre|servic/i, cat: "Transport" },
  { re: /electricity|power|water|internet|wifi|broadband|recharge|gas\b|bill/i, cat: "Utilities" },
  { re: /sabji|vegetable|grocer|d\s?mart|bigbasket|blinkit|zepto|milk|ration|kirana|instamart|supermarket/i, cat: "Groceries" },
  { re: /pizza|dinner|lunch|breakfast|dhaba|restaurant|caf[ée]|coffee|chai|swiggy|zomato|biryani|food|cake|\beat\b/i, cat: "Dining Out" },
  { re: /flipkart|amazon|myntra|ajio|amway|shopping|mall|slipper|clothes|shoes|suits|shirt|dress|gift|payjama/i, cat: "Shopping" },
  { re: /doctor|medicine|pharmacy|hospital|gym|medical|clinic/i, cat: "Health" },
  { re: /movie|cinema|netflix|spotify|concert|party|subscription/i, cat: "Entertainment" },
  { re: /flight|hotel|trip|travel|vacation|irctc|airbnb/i, cat: "Travel" },
  { re: /salary|payroll|wages|bonus|variable/i, cat: "Salary", income: true },
  { re: /freelance|invoice|client/i, cat: "Freelance", income: true },
  { re: /dividend|interest|mutual|\bsip\b|\bmf\b|invest/i, cat: "Investments", income: true },
  { re: /reimburse|refund|cashback|wallet/i, cat: "Other Income", income: true },
];

export function inferCategory(
  note: string,
  type: TxType,
  cats: { name: string; type: TxType }[]
): string | null {
  const n = note.toLowerCase();
  if (!n.trim()) return null;
  for (const r of NOTE_RULES) {
    if (r.income && type !== "income") continue;
    if (!r.income && type !== "expense") continue;
    if (r.re.test(n)) return r.cat;
  }
  for (const c of cats) {
    if (c.type !== type || c.name.length < 4) continue;
    if (n.includes(c.name.toLowerCase())) return c.name;
  }
  return null;
}

export interface ParsedTx {
  date: string;
  amount: number;
  type: TxType;
  categoryName: string;
  note: string;
  payment?: "cash" | "card";
}

export interface Parsed {
  headers: string[];
  mapping: Mapping;
  sample: string[] | null;
  transactions: ParsedTx[];
  skipped: number;
  totalRows: number;
}

export function buildParsed(
  text: string,
  allExpense: boolean,
  noHeader: boolean,
  cats: { name: string; type: TxType }[]
): Parsed | null {
  const firstNl = text.indexOf("\n");
  const firstLine = firstNl === -1 ? text : text.slice(0, firstNl);
  if (firstLine.includes("\t")) text = text.replace(/\t/g, ","); // pasted straight from a sheet
  const rows = parseCSV(text);
  if (rows.length === 0) return null;
  if (!noHeader && rows.length < 2) return null;
  const headers = noHeader
    ? rows[0].map((_, i) => `Column ${i + 1}`)
    : rows[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  const dataRows = noHeader ? rows : rows.slice(1);
  const mapping: Mapping = noHeader
    ? { date: 0, amount: Math.min(1, headers.length - 1), type: -1, category: -1, note: -1, payment: -1 }
    : guessMapping(headers);
  if (mapping.amount < 0) mapping.amount = headers.length > 1 ? 1 : 0;
  if (mapping.date < 0) mapping.date = 0;

  /* Self-heal: if the guessed columns parse zero rows, scan every
     date×amount column pair and keep the one that parses the most. */
  const readyCount = (m: Mapping) =>
    dataRows.reduce(
      (acc, r) =>
        parseDate(r[m.date] ?? "") && parseAmount(r[m.amount] ?? "") !== null ? acc + 1 : acc,
      0
    );
  if (dataRows.length > 0 && readyCount(mapping) === 0) {
    let best: Mapping | null = null;
    let bestScore = 0;
    for (let d = 0; d < headers.length; d++) {
      for (let a = 0; a < headers.length; a++) {
        if (a === d) continue;
        const cand: Mapping = { ...mapping, date: d, amount: a };
        const s = readyCount(cand);
        if (s > bestScore) {
          bestScore = s;
          best = cand;
        }
      }
    }
    if (best) Object.assign(mapping, best);
  }

  const out: ParsedTx[] = [];
  let skipped = 0;
  for (const r of dataRows) {
    const rawDate = r[mapping.date] ?? "";
    const rawAmount = r[mapping.amount] ?? "";
    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    if (!date || amount === null || amount === 0) { skipped++; continue; }
    const type = parseType(mapping.type >= 0 ? r[mapping.type] : null, amount, allExpense);
    const note = (mapping.note >= 0 ? r[mapping.note] : "").trim();
    const rawCat = (mapping.category >= 0 ? r[mapping.category] : "").trim();
    const categoryName = rawCat || inferCategory(note, type, cats) || "Uncategorized";
    out.push({
      date,
      amount: round2(Math.abs(amount)),
      type,
      categoryName,
      note,
      payment: parsePayment(mapping.payment >= 0 ? r[mapping.payment] : null),
    });
  }
  return {
    headers,
    mapping,
    sample: dataRows[0] ?? null,
    transactions: out,
    skipped,
    totalRows: dataRows.length,
  };
}

/* ================= Google Sheets fetch ================= */

/** Accepts a full sheet URL or a raw spreadsheet id. */
export function spreadsheetIdFromUrl(input: string): string | null {
  const t = input.trim();
  if (/^[a-zA-Z0-9-_]{20,}$/.test(t)) return t;
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

/**
 * Fetches a sheet as CSV without any API key:
 *  - normal sheet URL or id  → public gviz CSV endpoint (needs Share → Anyone with the link)
 *  - "Publish to web" CSV link → used as-is
 *  - tabName targets one specific tab (month-wise sheets)
 */
export async function fetchSheetCSV(urlOrId: string, tabName?: string): Promise<string> {
  let u = urlOrId.trim();
  const id = spreadsheetIdFromUrl(u);
  const tab = tabName?.trim();
  if (id && !u.includes("output=csv") && !u.includes("tqx=out:csv")) {
    u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${tab ? `&sheet=${encodeURIComponent(tab)}` : ""}`;
  } else if (tab && u.includes("tqx=out:csv") && !u.includes("&sheet=") && !u.includes("?sheet=")) {
    u += `&sheet=${encodeURIComponent(tab)}`;
  }
  const res = await fetch(u);
  if (!res.ok) {
    throw new Error(
      `Google returned ${res.status}. Open the sheet → Share → “Anyone with the link” (Viewer) — or use File → Share → Publish to web → CSV.`
    );
  }
  const text = await res.text();
  if (text.trim().startsWith("<")) {
    throw new Error(
      "Google returned a web page instead of CSV. The tab may not exist, or the sheet isn’t link-shared. Share → “Anyone with the link”, then retry."
    );
  }
  return text;
}
