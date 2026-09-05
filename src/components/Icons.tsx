import React from "react";

const ICONS = {
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13C12 8.5 8.9 6 4.5 6 4.5 10.5 7.6 13 12 13z" />
      <path d="M12 11c0-3.5 2.7-5.5 6.5-5.5C18.5 9 15.8 11 12 11z" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  upRight: (
    <>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </>
  ),
  downRight: (
    <>
      <path d="m7 7 10 10" />
      <path d="M17 9v8H9" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
      <path d="M3 4h2.4l2.1 10.6a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20.8 8H6.2" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 3v18" />
      <path d="M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3" />
      <path d="M16.5 3v18" />
      <path d="M16.5 3c-2 1.8-3 4.2-3 7.5h3" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M7.5 3.5c-.6.9.6 1.6 0 2.5" />
      <path d="M11.5 3.5c-.6.9.6 1.6 0 2.5" />
    </>
  ),
  car: (
    <>
      <path d="M4 16.5 5.7 11a2 2 0 0 1 1.9-1.4h8.8a2 2 0 0 1 1.9 1.4l1.7 5.5" />
      <rect x="3" y="16.5" width="18" height="3.5" rx="1.2" />
      <circle cx="7.3" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.7" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M6.5 10v10h11V10" />
      <path d="M10.5 20v-5h3v5" />
    </>
  ),
  bolt: <path d="M13 2.5 4.5 14H11l-1 7.5L18.5 10H12l1-7.5z" />,
  film: (
    <>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M3.8 9 6 4.5h14L17.8 9" />
      <path d="m9.8 4.5 2.2 4.5" />
      <path d="m15.2 4.5 2.2 4.5" />
    </>
  ),
  pulse: <path d="M3 12h4l2.5-6.5 4.5 13L16.5 12H21" />,
  bag: (
    <>
      <path d="M6.2 8h11.6l1 12.2a.8.8 0 0 1-.8.8H6a.8.8 0 0 1-.8-.8L6.2 8z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </>
  ),
  plane: (
    <>
      <path d="m2.5 11.5 19-7.5-6.5 18-3.5-7.5-9-3z" />
      <path d="M21.5 4 11.5 14.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
      <path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7" />
      <path d="M3 12.5h18" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="5" width="15" height="10.5" rx="1.5" />
      <path d="M2.5 19h19" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9.5" cy="6.5" rx="6" ry="3" />
      <path d="M3.5 6.5v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      <path d="M3.5 11.5v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      <path d="M18.8 9.7c1.1.5 1.7 1.2 1.7 1.9 0 1.2-1.5 2.2-3.6 2.7" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12V21l-2-1.4-2 1.4-2-1.4L10 21l-2-1.4L6 21V3.5z" />
      <path d="M9.5 8.5h5" />
      <path d="M9.5 12h5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  pencil: (
    <>
      <path d="m4 20 1-4L16.6 4.4a2 2 0 0 1 2.9 2.9L8 19l-4 1z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="m6.5 7 .9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5V15" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 20h15" />
    </>
  ),
  chevL: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevR: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  filter: <path d="M4 5.5h16l-6.2 7.2v5l-3.6 2.3v-7.3L4 5.5z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7-5.6-1.9L10.1 9 12 3.5z" />
      <path d="M19 16.5v4" />
      <path d="M17 18.5h4" />
    </>
  ),
  check: <path d="m4.5 12.5 5.5 5.5L19.5 6.5" />,
  alert: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  arrowR: (
    <>
      <path d="M4.5 12h15" />
      <path d="m13 5.5 6.5 6.5L13 18.5" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICONS[name] ?? ICONS.info}
    </svg>
  );
}
