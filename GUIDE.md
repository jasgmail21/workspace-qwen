# Sprout — Complete Setup & Ownership Guide

Everything in this document matches **this** codebase (Vite + React + TypeScript + Tailwind v4).
There is no `lib/supabase.js`, no `lib/googleSheets.js`, and no `.env` file required — the cloud
connection is configured **once, inside the app**. Details below.

---

## 1 · Run it on your local machine

**Requirements:** Node.js 18+ (check with `node -v`).

```bash
# 1. get the project (clone your repo, or unzip the downloaded folder), then:
cd sprout

# 2. install dependencies
npm install

# 3. start the dev server
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). The app works **immediately** —
it seeds demo data and saves everything to your browser's `localStorage`.

Production build (what hosts deploy):

```bash
npm run build   # outputs the static site into dist/
npm run preview # test the production build locally
```

---

## 2 · Connect Supabase (new key system explained)

### Which key is which?

| Key in your dashboard | Starts with | Use it where? |
|---|---|---|
| **Publishable key** (new) | `sb_publishable_…` | ✅ In this app — it replaces the old **anon key**. Paste it into Sprout's Cloud sync dialog. |
| Legacy anon key | `eyJ…` | Also works — the app accepts either. |
| **Secret key** (new) | `sb_secret_…` | ❌ **Never** in a browser. Servers/functions only. This app never needs it — Row Level Security protects your data instead. |

### Setup steps (~5 minutes)

1. **Create project** — [supabase.com/dashboard](https://supabase.com/dashboard) → New project (Hobby plan = free, no card).
2. **Run the schema** — In Supabase: **SQL Editor → New query**. Copy the SQL from inside Sprout
   (open *Cloud sync → Free setup* and click **Copy SQL**) — or use the copy below — then press **Run**.
3. **Copy credentials** — **Project Settings → API keys** → copy the **Project URL** and the
   **Publishable key** (`sb_publishable_…`).
4. **Connect in the app** — In Sprout: sidebar **Cloud sync** → paste URL + key → **Connect project**
   → **Create account** (use any email + password — this is *your* account, not Supabase's login).
   Optional: Supabase → *Authentication → Providers → Email* → turn **Confirm email** off to skip inbox verification.
5. **Other devices** — open the app, sign in with the same email/password. The ledger merges automatically.

### The schema (same SQL that's inside the app)

```sql
create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount >= 0),
  category_id text not null,
  note text not null default '',
  date date not null,
  updated_at bigint not null default 0
);

create table if not exists public.categories (
  id text primary key,
  user_id uuid not null,
  name text not null,
  color text not null,
  icon text not null,
  type text not null check (type in ('income','expense')),
  budget numeric(12,2),
  updated_at bigint not null default 0
);

create table if not exists public.settings (
  user_id uuid primary key,
  currency text not null default 'USD',
  updated_at bigint not null default 0
);

create table if not exists public.sheet_inbox (
  id bigint generated always as identity primary key,
  date date,
  kind text default 'expense',
  category text default 'Uncategorized',
  note text default '',
  amount numeric(12,2),
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;
alter table public.categories   enable row level security;
alter table public.settings     enable row level security;
alter table public.sheet_inbox  enable row level security;

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sheet insert" on public.sheet_inbox
  for insert to anon with check (true);
create policy "sheet read" on public.sheet_inbox
  for select to authenticated using (true);
create policy "sheet clear" on public.sheet_inbox
  for delete to authenticated using (true);
```

### Free-plan caveats (current)

- **Auto-pause after 7 days of inactivity** — the only real time limit. Any sync counts as
  activity; if it does pause, resume it with one click in the Supabase dashboard (data is safe).
- **500 MB database** ≈ millions of transactions — you won't hit it.
- **2 projects, 5 GB bandwidth/month** — both irrelevant for personal use.

---

## 3 · Where credentials live — ONE place only

You never edit credentials in multiple files. Pick **one** option:

### Option A — in-app (recommended, zero files touched)

Sidebar → **Cloud sync** → paste URL + publishable key → Connect.
Stored in that browser's `localStorage` under the key `sprout.cloud.config`.
Repeat once per browser/device (same as signing into any website).

### Option B — environment variables (auto pre-fill)

The app also reads standard Vite env vars at build time (`src/cloud.ts` → `loadCloudConfig`):

```bash
# create .env.local in the project root (never commit this file)
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_XXXXXXXX
```

Restart `npm run dev`. On Vercel/Netlify, add the same two names in the host's
*Environment Variables* panel instead of a file.

> Note: the variable name says `ANON_KEY` for compatibility — put your new
> `sb_publishable_…` key in it. Both formats work.

---

## 4 · Deploy (Vercel, Netlify, Cloudflare Pages — all fine)

This is a static Vite app; **no server code, no special Supabase configuration** is needed on the host.

### Vercel

1. Push the project to GitHub/GitLab/Bitbucket.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel auto-detects **Vite**. Build command `npm run build`, output `dist` (already set).
4. *(Only if you chose Option B)* add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
   under *Settings → Environment Variables*.
5. **Deploy.**
6. Open your new `*.vercel.app` URL → sidebar → **Cloud sync** → Connect + sign in
   (if you used Option A, each deployed origin connects once — the config is stored per-browser).

### Netlify / Cloudflare Pages

Same flow: import repo → build `npm run build` → publish directory `dist`
(Cloudflare: output `dist`). Optional env vars identical to Vercel.

---

## 5 · Import your Google Sheets history (where the mapping lives)

**Transactions → Import** button (top-right of the Transactions view).

1. **Choose a source** — three tabs:
   - **CSV file**: Google Sheets → *File → Download → Comma Separated Values (.csv)* → drop it in.
   - **Sheet link**: paste the sheet URL. The sheet must be shared
     (*Share → Anyone with the link = Viewer*) **or** published
     (*File → Share → Publish to web → CSV*). If you get a "Google returned 4xx / web page"
     error, this is the cause.
   - **Paste text**: the bulletproof fallback — copy rows straight out of the sheet
     (tabs are handled) or paste CSV text.
2. **Review panel = the mapping.** After parsing you see five dropdowns —
   **date · amount · type · category · note**. Each maps one role to one column of
   *your* sheet; the app guesses first, you correct it. Choose *— none —* for roles your
   sheet doesn't have.
3. **No Type column?** Leave `type` on *— none —* and tick
   *"treat positive rows as expenses"* (untick it if your sheet only contains income).
4. The preview table shows the first 6 rows exactly as they'll import, plus counts:
   *rows ready · in · out · skipped (bad date/amount)*.
5. Press **Import** — unknown categories are created automatically, exact duplicates skipped.

**Supported formats**

| Field | Examples that parse |
|---|---|
| Date | `2021-03-05`, `05/03/2021`, `3/5/21`, `Mar 5, 2021`, `5 Apr 2021` |
| Amount | `1240.50`, `1,240.50`, `₹1,240.50`, `1.240,50`, `(45.00)`, `-45` |
| Type (optional) | any cell containing in/out, income/expense, credit/debit, dep/with |

**Header row:** the first row is treated as headers (column names). If your sheet has no
header row, add one — it makes the mapping dropdowns readable.

---

## 6 · Live sync: add a row in Sheets → it appears in Sprout

Flow: `Google Sheet → Apps Script → sheet_inbox table → next Sprout sync ingests it`.

1. In your sheet: **Extensions → Apps Script**. Delete the boilerplate, paste:

```js
const SUPABASE_URL = "https://YOURPROJECT.supabase.co";
const ANON_KEY = "sb_publishable_XXXXXXXX"; // publishable key (Apps Script is server-side, this is fine)

// Sheet columns: A=Date  B=Type(income/expense)  C=Category  D=Note  E=Amount
function syncToSprout(e) {
  const row = e.range.getRow();
  if (row < 2) return; // skip header
  const [date, kind, category, note, amount] = e.source
    .getActiveSheet().getRange(row, 1, 1, 5).getValues()[0];
  if (!date || !amount) return;
  UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/sheet_inbox", {
    method: "post",
    contentType: "application/json",
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
    payload: JSON.stringify({
      date: Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      kind: String(kind || "expense"),
      category: String(category || "Uncategorized"),
      note: String(note || ""),
      amount: Math.abs(Number(amount)),
    }),
  });
}
```

2. Replace `SUPABASE_URL` and `ANON_KEY` (the only two places credentials appear — both server-side).
3. Add the trigger: in Apps Script, left panel **Triggers (⏰) → Add trigger** →
   function `syncToSprout`, event source *From spreadsheet*, event type **On edit** → Save
   (authorize Google's permission prompts once).
4. Add a row in the sheet → open Sprout (or press **Sync now**) → toast:
   *"Imported 1 entry from your Google Sheet"*. Categories that don't exist yet are auto-created.

---

## 7 · File map — what to edit when you enhance things

| File | Role | Touch it when… |
|---|---|---|
| `index.html` | Shell, fonts, title | Changing fonts/title/favicon |
| `src/index.css` | Tailwind v4 `@theme` palette, fonts, animations, background grid | **Re-theming**: every color is a token (`--color-moss` etc.) |
| `src/types.ts` | `Transaction`, `Category`, `Settings`, cloud types | Adding a field (e.g. payment method) — then update store + cloud rows + modal |
| `src/utils.ts` | Money/date formatting, CSV export, PRNG | Currency display, date formats |
| `src/data.ts` | Default categories + demo-data generator | Changing starter categories/seed |
| `src/store.tsx` | **The app state**: all mutations, toasts, cloud orchestration, `importBatch` | Any new feature's logic lives here |
| `src/cloud.ts` | Supabase client, SQL schema text, sync engine (last-write-wins), tombstones, sheet fetch | Sync behavior, schema changes |
| `src/components/Icons.tsx` | Custom SVG icon set | Adding icons |
| `src/components/ui.tsx` | Buttons, cards, `CountUp`, `Reveal`, `Bar`, `Segmented`, `EmptyState` | Shared UI primitives |
| `src/components/Charts.tsx` | Hand-rolled SVG donut / bars / sparklines / rank rows | New visualizations |
| `src/components/layout.tsx` | Sidebar, mobile nav, FAB, toasts, `MonthNav`, cloud widget | Navigation/chrome |
| `src/components/modals.tsx` | Add/edit transaction, new category, confirm dialogs | Transaction form fields |
| `src/components/CloudModal.tsx` | Cloud setup dialog, sign-in, status | Cloud UX |
| `src/components/ImportModal.tsx` | CSV/Sheet import: parser + **column mapping UI** | Import formats |
| `src/views/Overview.tsx` | Dashboard | Stat cards, charts layout |
| `src/views/Transactions.tsx` | Ledger: search, filters, day groups | Filtering/ledger features |
| `src/views/Budgets.tsx` | Budget envelopes | Budget logic UI |
| `src/views/Insights.tsx` | Analytics | New metrics |
| `src/App.tsx` | View switching, modal hosts, footer | Adding a new view: add to `ViewId`, `NAV`, and the switch |
| `GUIDE.md` | This document | Keep it current :) |

**Common enhancements & where they go**

- *New field on transactions* → `types.ts` → row mapping in `cloud.ts` (`txToRow`/`rowToTx`) →
  form in `components/modals.tsx` → display in `views/Transactions.tsx` → SQL `alter table`.
- *New chart* → add component in `components/Charts.tsx`, mount it in a view.
- *New theme* → edit `@theme` tokens in `src/index.css` only.
- *New view (e.g. "Goals")* → `types.ts` `ViewId` → `layout.tsx` `NAV` → new file in `src/views/` → render in `App.tsx`.

---

## 8 · Troubleshooting

| Symptom | Fix |
|---|---|
| "Invalid API key" on connect | You pasted the **secret** key or a truncated one. Use the full `sb_publishable_…` key. |
| Sync error "relation does not exist" | The SQL schema wasn't run — SQL Editor → Run the schema. |
| Sign-up says "check your inbox" | Click Supabase's email, or disable **Confirm email** (Authentication → Providers → Email). |
| Project paused | Supabase dashboard → your project → **Restore** (free, data intact). Use the app once a week to avoid it. |
| Sheet fetch returns a web page / 403 | Share → *Anyone with the link*, or Publish to web → CSV; or just use **Paste text**. |
| Import skips all rows | Date/amount columns unmapped — fix the dropdowns in the review panel; check supported formats above. |
| Data not on other device | Same email account? Press **Sync now** on both. Each browser connects once. |
| Want to start fresh | Sidebar → *Restore demo data* (resets local + pushes on next sync). |
