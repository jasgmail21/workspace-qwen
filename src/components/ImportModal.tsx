import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchSheetCSV } from "../cloud";
import { useApp } from "../store";
import type { TxType } from "../types";
import { round2, toISO } from "../utils";
import { Icon } from "./Icons";
import { BTN_PRIMARY, Segmented } from "./ui";

/* ---------------- parsing helpers ---------------- */

function parseCSV(text: string): string[][] {
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

/** Accepts: 2021-03-05 · 05/03/2021 · 3/5/21 · 05-Mar-2021 · Mar 5, 2021 ·
 *  5 March 2021 · 2021/03/05 · 05.03.2021 · epoch ms/s · and anything Date.parse knows. */
function parseDate(s: string): string | null {
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
function parseAmount(s: string): number | null {
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

function parseType(s: string | null, amount: number, allExpense: boolean): TxType {
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

function parsePayment(s: string | null): "cash" | "card" | undefined {
  if (!s) return undefined;
  const v = s.toLowerCase();
  if (/cash|upi|gpay|paytm|phonepe|neft|imps|net ?banking/.test(v)) return "cash";
  if (/card|credit|debit|amex|visa|master|\bcc\b/.test(v)) return "card";
  return undefined;
}

interface Mapping {
  date: number;
  amount: number;
  type: number;
  category: number;
  note: number;
  payment: number;
}

/** Word-boundary matching so e.g. "Summary" never steals the "sum/amount" slot. */
function guessMapping(headers: string[]): Mapping {
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

const NOTE_RULES: { re: RegExp; cat: string; income?: boolean }[] = [
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

function inferCategory(
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

interface Parsed {
  headers: string[];
  mapping: Mapping;
  sample: string[] | null;
  transactions: {
    date: string;
    amount: number;
    type: TxType;
    categoryName: string;
    note: string;
    payment?: "cash" | "card";
  }[];
  skipped: number;
  totalRows: number;
}

function buildParsed(
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

  const out: Parsed["transactions"] = [];
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
    const categoryName =
      rawCat || inferCategory(note, type, cats) || "Uncategorized";
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

/* ---------------- component ---------------- */

type Source = "file" | "sheet" | "paste";

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { categories, importBatch } = useApp();
  const [source, setSource] = useState<Source>("file");
  const [sheetUrl, setSheetUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [allExpense, setAllExpense] = useState(true);
  const [noHeader, setNoHeader] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const parsed = useMemo(
    () => (raw ? buildParsed(raw, allExpense, noHeader, categories) : null),
    [raw, allExpense, noHeader, categories]
  );

  const loadData = (name: string, text: string) => {
    setErr(null);
    setFileName(name);
    setMappingOverride(null);
    setRaw(text);
  };

  const onFile = async (f: File | undefined | null) => {
    if (!f) return;
    loadData(f.name, await f.text());
  };

  const onFetchSheet = async () => {
    setErr(null);
    setLoading(true);
    try {
      const text = await fetchSheetCSV(sheetUrl);
      loadData("Google Sheet", text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not fetch the sheet.");
    } finally {
      setLoading(false);
    }
  };

  const doImport = () => {
    if (!parsed || parsed.transactions.length === 0) return;
    const existingCats = new Map(
      categories.map((c) => [`${c.type}|${c.name.toLowerCase()}`, c.name])
    );
    const newCatNames = new Map<string, TxType>();
    for (const t of parsed.transactions) {
      const sig = `${t.type}|${t.categoryName.toLowerCase()}`;
      if (!existingCats.has(sig)) newCatNames.set(sig, t.type);
    }
    const palette = ["#2f7e58", "#c2703e", "#4f7ac2", "#b64f6e", "#7a6bc9", "#3d8f8a", "#a3802c", "#8a5a3b"];
    const newCats = Array.from(newCatNames.entries()).map(([sig, type], i) => ({
      name: sig.split("|")[1].replace(/^\w/, (c) => c.toUpperCase()),
      type,
      color: palette[i % palette.length],
      icon: "coins",
    }));
    importBatch({
      categories: newCats,
      transactions: parsed.transactions.map((t) => ({
        type: t.type,
        amount: t.amount,
        categoryId: t.categoryName, // resolved by signature in the store
        note: t.note,
        date: t.date,
        payment: t.payment,
      })),
    });
    onClose();
  };

  const [mappingOverride, setMappingOverride] = useState<Mapping | null>(null);
  const effParsed = parsed && mappingOverride ? { ...parsed, mapping: mappingOverride } : parsed;

  const setMap = (key: keyof Mapping, v: string) => {
    if (!parsed) return;
    setMappingOverride({ ...parsed.mapping, [key]: Number(v) });
  };

  return (
    <div className="anim-fade fixed inset-0 z-[60] overflow-y-auto bg-pine/60" onClick={onClose}>
      <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
      <div
        className="anim-pop my-auto w-full max-w-2xl rounded-xl border-2 border-pine bg-card shadow-[8px_8px_0_0_rgba(13,33,26,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-moss text-paper">
              <Icon name="download" size={19} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Bring in your history</h2>
              <p className="text-[12px] text-ink-soft">
                Import years of Google Sheets data in one go — duplicates are skipped automatically.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-line-soft hover:text-ink cursor-pointer" aria-label="Close">
            <Icon name="x" size={17} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* source picker */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented<Source>
              value={source}
              onChange={setSource}
              options={[
                { value: "file", label: "CSV file", icon: "receipt" },
                { value: "sheet", label: "Sheet link", icon: "laptop" },
                { value: "paste", label: "Paste text", icon: "pencil" },
              ]}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={allExpense}
                  onChange={(e) => setAllExpense(e.target.checked)}
                  className="h-4 w-4 accent-[#2f7e58]"
                />
                No type column → treat positive rows as expenses
              </label>
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={noHeader}
                  onChange={(e) => { setNoHeader(e.target.checked); setMappingOverride(null); }}
                  className="h-4 w-4 accent-[#2f7e58]"
                />
                First row is data (no header row)
              </label>
            </div>
          </div>

          {!raw && source === "file" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line bg-paper/60 px-6 py-12 text-center transition-colors hover:border-moss hover:bg-mint-dim/40"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-moss text-moss-deep">
                <Icon name="receipt" size={24} />
              </span>
              <div>
                <p className="font-display text-[15px] font-bold text-ink">Drop your CSV here</p>
                <p className="mt-1 text-[13px] text-ink-soft">
                  In Google Sheets: <b>File → Download → Comma Separated Values (.csv)</b>
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
          )}

          {!raw && source === "sheet" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  className="field num flex-1"
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                />
                <button className={BTN_PRIMARY} onClick={() => void onFetchSheet()} disabled={loading || !sheetUrl.trim()}>
                  {loading ? "Fetching…" : "Fetch"}
                </button>
              </div>
              <div className="rounded-xl border border-line bg-paper/70 p-4 text-[13px] leading-5 text-ink-soft">
                <p className="mb-1 font-bold text-ink">Make the sheet readable:</p>
                <p>
                  Option A — <b>Share → Anyone with the link</b> (Viewer), then paste the normal sheet URL.
                  <br />
                  Option B — <b>File → Share → Publish to web → CSV</b>, and paste that published link.
                </p>
                <p className="mt-2 border-t border-dashed border-line pt-2">
                  Fetch keeps failing? Switch to <b>Paste text</b> and copy straight from the sheet
                  (or <b>File → Download → CSV</b>, then open the file in a text editor).
                </p>
              </div>
            </div>
          )}

          {!raw && source === "paste" && (
            <div className="space-y-3">
              <textarea
                className="field num min-h-[140px] text-[12.5px] leading-5"
                placeholder={`Date,Type,Category,Note,Amount\n2021-03-05,expense,Groceries,Big bazaar,1240.50\n2021-03-07,income,Salary,March salary,52000`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button
                className={BTN_PRIMARY + " w-full"}
                disabled={!pasteText.trim()}
                onClick={() => loadData("Pasted data", pasteText)}
              >
                <Icon name="check" size={15} strokeWidth={2.4} /> Parse pasted rows
              </button>
              <p className="text-[12px] leading-5 text-ink-faint">
                Works with CSV text or values copied straight out of Google Sheets (tabs are converted for you).
              </p>
            </div>
          )}

          {err && (
            <p className="flex items-start gap-2 rounded-lg bg-coral-soft px-3 py-2.5 text-[13px] font-medium text-coral-deep">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0" /> {err}
            </p>
          )}

          {/* review step */}
          {effParsed && raw && (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border-2 border-moss bg-mint-dim/50 px-4 py-3">
                <span className="text-sm font-bold text-ink">{fileName ?? "data"}</span>
                <span className="num text-[13px] text-moss-deep">{effParsed.transactions.length} rows ready</span>
                <span className="num text-[13px] text-ink-soft">
                  {effParsed.transactions.filter((t) => t.type === "income").length} in ·{" "}
                  {effParsed.transactions.filter((t) => t.type === "expense").length} out
                </span>
                {effParsed.skipped > 0 && (
                  <span className="num text-[13px] text-coral-deep">{effParsed.skipped} skipped (bad date/amount)</span>
                )}
                <button onClick={() => { setRaw(null); setMappingOverride(null); }} className="ml-auto text-[12px] font-bold text-ink-soft underline underline-offset-4 hover:text-ink cursor-pointer">
                  Start over
                </button>
              </div>

              {/* -------- column mapping -------- */}
              <div className="rounded-xl border-2 border-pine bg-paper/60 p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[15px] font-bold text-ink">Column mapping</h3>
                  <span className="num text-[12px] font-semibold text-moss-deep">
                    {effParsed.transactions.length}/{effParsed.totalRows} rows parse cleanly — changes apply instantly
                  </span>
                </div>

                {effParsed.sample && (
                  <div className="mb-4 overflow-x-auto rounded-lg border border-dashed border-line bg-card px-3 py-2">
                    <p className="stamp mb-1.5 text-ink-faint">First raw row — match the dropdowns to these values</p>
                    <div className="flex gap-2">
                      {effParsed.headers.map((h, i) => (
                        <span key={i} className="shrink-0 rounded-md bg-line-soft px-2 py-1 text-[11.5px]">
                          <b className="text-ink">{h}:</b>{" "}
                          <span className="num text-ink-soft">{(effParsed.sample?.[i] ?? "").trim() || "·empty·"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {(["date", "amount", "type", "category", "note", "payment"] as const).map((k) => (
                    <div key={k}>
                      <label className="stamp mb-1 block text-ink-soft">
                        {k === "type" ? "type (in/out)" : k === "payment" ? "paid via" : k}
                        {k === "date" || k === "amount" ? " *" : ""}
                      </label>
                      <select
                        className="field px-2 py-2 text-[13px]"
                        value={effParsed.mapping[k]}
                        onChange={(e) => setMap(k, e.target.value)}
                      >
                        <option value={-1}>— none —</option>
                        {effParsed.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[12px] leading-5 text-ink-faint">
                  <b className="text-ink-soft">date</b> and <b className="text-ink-soft">amount</b> are required —
                  every format is auto-converted (05/03/2021, 5 Mar 2021, March 5 2021, ₹1,234.56, 1.234,56 …).
                  Rows without a category land in <b className="text-ink-soft">Uncategorized</b>; rows with
                  unparseable dates/amounts are skipped and counted above.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-paper text-[11px] uppercase tracking-wider text-ink-faint">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Paid via</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Note</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-line">
                    {effParsed.transactions.slice(0, 6).map((t, i) => (
                      <tr key={i} className="bg-card">
                        <td className="num px-3 py-2 text-ink-soft">{t.date}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.type === "income" ? "bg-mint-dim text-moss-deep" : "bg-coral-soft text-coral-deep"}`}>
                            {t.type === "income" ? "in" : "out"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {t.payment ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
                              <Icon name={t.payment === "card" ? "wallet" : "coins"} size={13} />
                              {t.payment}
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-ink">
                          {t.categoryName}
                          {t.categoryName === "Uncategorized" && (
                            <span className="ml-1.5 rounded bg-line-soft px-1.5 py-0.5 text-[10px] font-bold text-ink-faint">auto</span>
                          )}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2 text-ink-soft">{t.note || "—"}</td>
                        <td className="num px-3 py-2 text-right font-bold text-ink">{t.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {effParsed.transactions.length > 6 && (
                  <p className="border-t border-line bg-paper px-3 py-2 text-center text-[12px] text-ink-faint">
                    …and {effParsed.transactions.length - 6} more rows
                  </p>
                )}
              </div>

              <button className={BTN_PRIMARY + " w-full"} onClick={doImport} disabled={effParsed.transactions.length === 0}>
                <Icon name="check" size={16} strokeWidth={2.4} />
                Import {effParsed.transactions.length} transaction{effParsed.transactions.length === 1 ? "" : "s"}
              </button>
              <p className="text-center text-[12px] text-ink-faint">
                Unknown categories are created automatically · exact duplicates are skipped · imports sync to your cloud if connected.
              </p>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
