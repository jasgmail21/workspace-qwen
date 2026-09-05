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

function parseDate(s: string): string | null {
  s = s.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let a = Number(m[1]); let b = Number(m[2]); let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (a > 12 && b <= 12) { const t = a; a = b; b = t; } // dd/mm → mm/dd
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31)
      return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    return null;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1980 && d.getFullYear() < 2100) return toISO(d);
  return null;
}

function parseAmount(s: string): number | null {
  let t = s.trim().replace(/[^\d.,\-+()]/g, "");
  if (!t) return null;
  const negParen = /^\(.*\)$/.test(t);
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", "."); // 1.234,56 → 1234.56
  else t = t.replace(/,/g, "");
  const v = parseFloat(t);
  if (isNaN(v)) return null;
  return negParen ? -Math.abs(v) : v;
}

function parseType(s: string | null, amount: number, allExpense: boolean): TxType {
  if (s) {
    const v = s.toLowerCase();
    if (/inc|dep|credit|earned|salary|in\b/.test(v)) return "income";
    if (/exp|with|debit|spent|out\b|purchase/.test(v)) return "expense";
  }
  if (amount < 0) return "expense";
  return allExpense ? "expense" : "income";
}

interface Mapping { date: number; amount: number; type: number; category: number; note: number }

function guessMapping(headers: string[]): Mapping {
  const h = headers.map((x) => x.toLowerCase().trim());
  const find = (keys: string[], skip: number[] = []) =>
    h.findIndex((x, i) => !skip.includes(i) && keys.some((k) => x.includes(k)));
  const date = find(["date", "day", "when", "time"]);
  const amount = find(["amount", "value", "sum", "total", "price", "cost"], [date]);
  const type = find(["type", "kind", "flow", "in/out", "direction"], [date, amount]);
  const category = find(["categor", "group", "tag", "class", "bucket"], [date, amount, type]);
  const note = find(["note", "desc", "memo", "detail", "item", "payee", "merchant", "label"], [date, amount, type, category]);
  return { date, amount, type, category, note };
}

interface Parsed {
  headers: string[];
  mapping: Mapping;
  transactions: { date: string; amount: number; type: TxType; categoryName: string; note: string }[];
  skipped: number;
}

function buildParsed(text: string, allExpense: boolean): Parsed | null {
  const rows = parseCSV(text);
  if (rows.length < 2) return null;
  const headers = rows[0];
  const mapping = guessMapping(headers);
  if (mapping.amount < 0) mapping.amount = headers.length > 1 ? 1 : 0;
  if (mapping.date < 0) mapping.date = 0;

  const out: Parsed["transactions"] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const rawDate = r[mapping.date] ?? "";
    const rawAmount = r[mapping.amount] ?? "";
    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    if (!date || amount === null || amount === 0) { skipped++; continue; }
    const type = parseType(mapping.type >= 0 ? r[mapping.type] : null, amount, allExpense);
    out.push({
      date,
      amount: round2(Math.abs(amount)),
      type,
      categoryName: (mapping.category >= 0 ? r[mapping.category] : "").trim() || "Uncategorized",
      note: (mapping.note >= 0 ? r[mapping.note] : "").trim(),
    });
  }
  return { headers, mapping, transactions: out, skipped };
}

/* ---------------- component ---------------- */

type Source = "file" | "sheet";

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { categories, importBatch } = useApp();
  const [source, setSource] = useState<Source>("file");
  const [sheetUrl, setSheetUrl] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [allExpense, setAllExpense] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsed = useMemo(() => (raw ? buildParsed(raw, allExpense) : null), [raw, allExpense]);

  const onFile = async (f: File | undefined | null) => {
    if (!f) return;
    setErr(null);
    setFileName(f.name);
    setRaw(await f.text());
  };

  const onFetchSheet = async () => {
    setErr(null);
    setLoading(true);
    try {
      const text = await fetchSheetCSV(sheetUrl);
      setFileName("Google Sheet");
      setRaw(text);
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
    <div className="anim-fade fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-pine/60 p-4" onClick={onClose}>
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
                { value: "sheet", label: "Google Sheet link", icon: "laptop" },
              ]}
            />
            <label className="flex items-center gap-2 text-[13px] font-medium text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                checked={allExpense}
                onChange={(e) => setAllExpense(e.target.checked)}
                className="h-4 w-4 accent-[#2f7e58]"
              />
              No type column → treat positive rows as expenses
            </label>
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
              </div>
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

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(["date", "amount", "type", "category", "note"] as const).map((k) => (
                  <div key={k}>
                    <label className="stamp mb-1 block text-ink-soft">{k === "type" ? "type (in/out)" : k}</label>
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

              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-paper text-[11px] uppercase tracking-wider text-ink-faint">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
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
                        <td className="px-3 py-2 font-medium text-ink">{t.categoryName}</td>
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
  );
}
