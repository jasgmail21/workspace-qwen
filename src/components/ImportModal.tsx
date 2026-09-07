import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildParsed, fetchSheetCSV, type Mapping } from "../importer";
import { useApp } from "../store";
import type { TxType } from "../types";
import { Icon } from "./Icons";
import { BTN_PRIMARY, Segmented } from "./ui";

type Source = "file" | "sheet" | "paste";

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { categories, importBatch, settings } = useApp();
  const saved = settings.sheet ?? null;

  const [source, setSource] = useState<Source>("file");
  const [sheetUrl, setSheetUrl] = useState(
    saved?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${saved.spreadsheetId}` : ""
  );
  const [tabName, setTabName] = useState(saved?.tabName ?? "");
  const [pasteText, setPasteText] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [allExpense, setAllExpense] = useState(true);
  const [noHeader, setNoHeader] = useState(false);
  const [mappingOverride, setMappingOverride] = useState<Mapping | null>(null);
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
  const effParsed = parsed && mappingOverride ? { ...parsed, mapping: mappingOverride } : parsed;

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
      const text = await fetchSheetCSV(sheetUrl, tabName);
      loadData(tabName.trim() ? `Sheet · ${tabName.trim()}` : "Google Sheet", text);
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

  const setMap = (key: keyof Mapping, v: string) => {
    if (!parsed) return;
    setMappingOverride({ ...parsed.mapping, [key]: Number(v) });
  };

  return (
    <div className="anim-fade fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-pine/60 p-4 sm:p-6" onClick={onClose}>
      <div
        className="anim-pop my-8 flex max-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col rounded-xl border-2 border-pine bg-card shadow-[8px_8px_0_0_rgba(13,33,26,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >          <div className="flex items-center justify-between border-b border-line px-6 py-4">
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

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
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
                className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line bg-paper/60 px-6 py-10 text-center transition-colors hover:border-moss hover:bg-mint-dim/40"
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
                <div>
                  <label className="stamp mb-1 block text-ink-soft">Spreadsheet link</label>
                  <input
                    className="field num"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[180px] flex-1">
                    <label className="stamp mb-1 block text-ink-soft">Tab name (month-wise sheets)</label>
                    <input
                      className="field"
                      placeholder="e.g. September 2026 — blank = first tab"
                      value={tabName}
                      onChange={(e) => setTabName(e.target.value)}
                    />
                  </div>
                  <button className={BTN_PRIMARY} onClick={() => void onFetchSheet()} disabled={loading || !sheetUrl.trim()}>
                    {loading ? "Fetching…" : "Fetch"}
                  </button>
                </div>
                <div className="rounded-xl border border-line bg-paper/70 p-4 text-[13px] leading-5 text-ink-soft">
                  <p className="mb-1 font-bold text-ink">Make the sheet readable:</p>
                  <p>
                    <b>Share → “Anyone with the link”</b> (Viewer) — or <b>File → Share → Publish to web → CSV</b>{" "}
                    and paste that published link.
                  </p>
                  <p className="mt-2 border-t border-dashed border-line pt-2">
                    Want it automatic? Set up <b>live sheet sync</b> in the Cloud sync dialog — then every sync
                    pulls your chosen month’s tab without opening this window.
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
                    every format is auto-converted (05/03/2021, 5 Mar 2021, 1-Sep-2026, ₹1,234.56, 1.234,56 …).
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
  );
}