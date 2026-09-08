import React, { useState } from "react";
import { Icon } from "./Icons";
import { BTN_PRIMARY } from "./ui";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function MonthPicker({
  currentKey,
  onSelect,
  onClose,
}: {
  currentKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(parseInt(currentKey.split("-")[0]));
  const [month, setMonth] = useState(parseInt(currentKey.split("-")[1]) - 1);

  const handleSelect = () => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    onSelect(key);
    onClose();
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-[70] flex items-center justify-center bg-pine/60 p-4"
      onClick={onClose}
    >
      <div
        className="anim-pop w-full max-w-sm rounded-xl border-2 border-pine bg-card p-6 shadow-[8px_8px_0_0_rgba(13,33,26,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Select month</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-line-soft hover:text-ink cursor-pointer"
            aria-label="Close"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Year selector */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setYear(year - 1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-card text-ink-soft transition-all hover:border-ink-faint hover:text-ink cursor-pointer"
          >
            <Icon name="chevL" size={17} />
          </button>
          <span className="num text-xl font-bold text-ink">{year}</span>
          <button
            onClick={() => setYear(year + 1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-card text-ink-soft transition-all hover:border-ink-faint hover:text-ink cursor-pointer"
          >
            <Icon name="chevR" size={17} />
          </button>
        </div>

        {/* Month grid */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          {MONTHS.map((m, i) => {
            const isSelected = i === month;
            return (
              <button
                key={m}
                onClick={() => setMonth(i)}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-pine text-mint shadow-sm"
                    : "text-ink-soft hover:bg-line-soft hover:text-ink"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        <button onClick={handleSelect} className={BTN_PRIMARY + " w-full"}>
          <Icon name="check" size={16} strokeWidth={2.4} />
          Go to {MONTHS[month]} {year}
        </button>
      </div>
    </div>
  );
}
