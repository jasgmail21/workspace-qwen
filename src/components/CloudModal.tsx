import React, { useEffect, useState } from "react";
import { SCHEMA_SQL } from "../cloud";
import { useApp } from "../store";
import { fmtAgo } from "../utils";
import { Icon } from "./Icons";
import { BTN_PRIMARY } from "./ui";

function StatusPill() {
  const { cloud } = useApp();
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    off: { label: "Not connected", dot: "bg-ink-faint", cls: "bg-line-soft text-ink-soft" },
    syncing: { label: "Syncing…", dot: "bg-amber", cls: "bg-amber-soft text-[#8a6210]" },
    synced: { label: "Synced", dot: "bg-moss", cls: "bg-mint-dim text-moss-deep" },
    error: { label: "Sync error", dot: "bg-coral", cls: "bg-coral-soft text-coral-deep" },
    offline: { label: "Offline — queued", dot: "bg-ink-faint", cls: "bg-line-soft text-ink-soft" },
  };
  const s = map[cloud.status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${cloud.status === "syncing" ? "animate-pulse" : cloud.status === "synced" ? "live-dot" : ""}`} />
      {s.label}
      {cloud.status === "synced" && cloud.lastSync ? ` · ${fmtAgo(cloud.lastSync)}` : ""}
    </span>
  );
}

export function CloudModal({ onClose }: { onClose: () => void }) {
  const { cloud, connectCloud, disconnectCloud, signIn, signUp, signOut, syncNow } = useApp();

  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(!cloud.configured);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFormErr("Couldn’t reach the clipboard — select the SQL text and copy manually.");
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("connect");
    setFormErr(null);
    const err = await connectCloud({ url, anonKey });
    setBusy(null);
    if (err) setFormErr(err);
    else setShowGuide(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(mode);
    setAuthErr(null);
    const err = mode === "signin" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(null);
    if (err) setAuthErr(err);
  };

  return (
    <div className="anim-fade fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-pine/60 p-4" onClick={onClose}>
      <div
        className="anim-pop my-auto w-full max-w-xl rounded-xl border-2 border-pine bg-card shadow-[8px_8px_0_0_rgba(13,33,26,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-pine text-mint">
              <Icon name="plane" size={19} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Cloud sync</h2>
              <p className="text-[12px] text-ink-soft">Free Supabase project · your data, on every device</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill />
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-line-soft hover:text-ink cursor-pointer" aria-label="Close">
              <Icon name="x" size={17} />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* ---------- connected account ---------- */}
          {cloud.configured && cloud.user && (
            <div className="rounded-xl border-2 border-moss bg-mint-dim/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-moss text-paper font-display text-sm font-bold">
                    {(cloud.user.email || "?").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{cloud.user.email}</p>
                    <p className="text-[12px] text-ink-soft">
                      {cloud.lastSync ? `Last sync ${fmtAgo(cloud.lastSync)}` : "First sync running…"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className={BTN_PRIMARY + " !py-2"} onClick={() => void syncNow()}>
                    <Icon name="spark" size={15} /> Sync now
                  </button>
                  <button
                    className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-line-soft cursor-pointer"
                    onClick={() => void signOut()}
                  >
                    Sign out
                  </button>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-ink-soft">
                Sign in with this account on any other device — the ledger merges automatically
                (last edit wins). Changes made offline are queued and pushed when you’re back online.
              </p>
            </div>
          )}

          {/* ---------- sign in / sign up ---------- */}
          {cloud.configured && !cloud.user && (
            <div>
              <div className="mb-3 inline-flex rounded-[10px] border border-line bg-paper p-1">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setAuthErr(null); }}
                    className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold cursor-pointer transition-colors ${mode === m ? "bg-pine text-mint" : "text-ink-soft hover:text-ink"}`}
                  >
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>
              <form onSubmit={handleAuth} className="space-y-3">
                <input className="field" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <input className="field" type="password" required minLength={6} placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
                {authErr && (
                  <p className="flex items-start gap-2 rounded-lg bg-coral-soft px-3 py-2 text-[13px] font-medium text-coral-deep">
                    <Icon name="alert" size={15} className="mt-0.5 shrink-0" /> {authErr}
                  </p>
                )}
                <button className={BTN_PRIMARY + " w-full"} disabled={busy !== null}>
                  {busy === mode ? "One moment…" : mode === "signin" ? "Sign in & sync" : "Create account & sync"}
                </button>
                <p className="text-[12px] leading-5 text-ink-faint">
                  Tip: in Supabase → Authentication → Providers → Email, turn <b>Confirm email</b> off
                  for a friction-free personal setup (or just click the link Supabase emails you).
                </p>
              </form>
            </div>
          )}

          {/* ---------- project connection form ---------- */}
          {(!cloud.configured || !cloud.user) && (
            <div>
              <button
                onClick={() => setShowGuide((v) => !v)}
                className="mb-3 flex w-full items-center justify-between rounded-lg border border-line bg-paper px-4 py-3 text-left cursor-pointer hover:border-ink-faint"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Icon name="info" size={16} className="text-moss-deep" />
                  {cloud.configured ? "Show setup guide" : "Free setup — 4 steps, ~5 minutes"}
                </span>
                <Icon name={showGuide ? "chevR" : "chevL"} size={15} className="rotate-90 text-ink-faint" />
              </button>

              {showGuide && (
                <ol className="mb-4 space-y-3 rounded-xl border border-line bg-paper/70 p-4 text-[13px] leading-5 text-ink-soft">
                  <li className="flex gap-3">
                    <b className="num shrink-0 text-moss-deep">1.</b>
                    <span>
                      Create a free project at{" "}
                      <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="font-semibold text-moss-deep underline underline-offset-2">supabase.com</a>{" "}
                      (Hobby plan — free forever, no card).
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <b className="num shrink-0 text-moss-deep">2.</b>
                    <span>
                      Open <b>SQL Editor</b> → <b>New query</b>, paste the schema below and press <b>Run</b>.
                      It creates four tiny tables with row-level security so only <i>your</i> account can read your ledger.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <b className="num shrink-0 text-moss-deep">3.</b>
                    <span>
                      Go to <b>Project Settings → API keys</b> and copy the <b>Project URL</b> and the{" "}
                      <b>Publishable key</b> (starts with <span className="num">sb_publishable_</span> — it replaces
                      the old “anon” key). Never use the <span className="num">sb_secret_</span> key in a browser.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <b className="num shrink-0 text-moss-deep">4.</b>
                    <span>Paste both below, hit <b>Connect</b>, then create an account and sign in on every device you use.</span>
                  </li>
                </ol>
              )}

              <div className="mb-4 overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-paper px-3 py-2">
                  <span className="stamp text-ink-faint">schema.sql</span>
                  <button
                    onClick={copySql}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold transition-colors cursor-pointer ${copied ? "bg-mint-dim text-moss-deep" : "bg-pine text-mint hover:bg-pine-2"}`}
                  >
                    <Icon name={copied ? "check" : "receipt"} size={13} /> {copied ? "Copied" : "Copy SQL"}
                  </button>
                </div>
                <pre className="num max-h-36 overflow-auto bg-pine p-3 text-[11px] leading-4 text-mint-dim/90">
                  {SCHEMA_SQL}
                </pre>
              </div>

              <form onSubmit={handleConnect} className="space-y-3">
                <div>
                  <label className="stamp mb-1 block text-ink-soft" htmlFor="sb-url">Project URL</label>
                  <input id="sb-url" className="field num" placeholder="https://abcdefgh.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} required />
                </div>
                <div>
                  <label className="stamp mb-1 block text-ink-soft" htmlFor="sb-key">
                    Publishable key <span className="normal-case tracking-normal">(new <span className="num">sb_publishable_…</span> or legacy anon key)</span>
                  </label>
                  <input id="sb-key" className="field num" placeholder="sb_publishable_…" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} required />
                </div>
                {formErr && (
                  <p className="flex items-start gap-2 rounded-lg bg-coral-soft px-3 py-2 text-[13px] font-medium text-coral-deep">
                    <Icon name="alert" size={15} className="mt-0.5 shrink-0" /> {formErr}
                  </p>
                )}
                <button className={BTN_PRIMARY + " w-full"} disabled={busy !== null}>
                  {busy === "connect" ? "Connecting…" : "Connect project"}
                </button>
                <p className="text-[12px] text-ink-faint">
                  The publishable key is safe to store here — security comes from row-level security + your account
                  password. The <span className="num">sb_secret_</span> key belongs on servers only; this app never needs it.
                </p>
              </form>

              {cloud.configured && (
                <div className="mt-4 border-t border-dashed border-line pt-4">
                  <button onClick={disconnectCloud} className="text-[12px] font-semibold text-coral-deep underline underline-offset-4 cursor-pointer hover:text-coral">
                    Disconnect this project
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------- signed-in extras ---------- */}
          {cloud.configured && cloud.user && (
            <div className="rounded-xl border border-line bg-paper/70 p-4 text-[13px] leading-5 text-ink-soft">
              <p className="mb-1.5 flex items-center gap-2 font-bold text-ink">
                <Icon name="laptop" size={15} className="text-moss-deep" /> Google Sheet entries flow in too
              </p>
              If you wired your sheet with the Apps Script from the setup notes, rows you add there
              land in the <span className="num text-[12px]">sheet_inbox</span> table and appear here on the next sync.
            </div>
          )}

          {cloud.configured && cloud.user && (
            <div className="flex justify-end border-t border-dashed border-line pt-4">
              <button
                onClick={() => { disconnectCloud(); }}
                className="text-[12px] font-semibold text-ink-faint underline underline-offset-4 hover:text-coral-deep cursor-pointer"
              >
                Disconnect project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
