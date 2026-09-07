import React, { useState } from "react";
import { useApp } from "../store";
import { Icon } from "./Icons";
import { BTN_PRIMARY } from "./ui";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  // No password set — show the app
  if (!settings.password) {
    return <>{children}</>;
  }

  // Already unlocked this session — show the app
  if (unlocked) {
    return <>{children}</>;
  }

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === settings.password) {
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-pine/80 p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-pine bg-card p-8 shadow-[8px_8px_0_0_rgba(13,33,26,0.35)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-mint-dim text-moss-deep">
            <Icon name="wallet" size={32} />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Sprout</h1>
          <p className="mt-2 text-sm text-ink-soft">Enter password to access your ledger</p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              autoFocus
              className={`field w-full ${error ? "border-coral" : ""}`}
              placeholder="Password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(false);
              }}
            />
            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-coral-deep">
                <Icon name="alert" size={14} />
                Incorrect password
              </p>
            )}
          </div>

          <button type="submit" className={BTN_PRIMARY + " w-full"}>
            <Icon name="check" size={16} strokeWidth={2.4} />
            Unlock
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Password is stored in your cloud settings and synced across devices
        </p>
      </div>
    </div>
  );
}
