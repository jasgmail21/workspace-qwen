# Source-Based Deduplication - Migration Guide

## What Changed

The app now uses **source-based deduplication** instead of content-based deduplication. This means:

### Before (Content-Based)
- Dedup key: `${date}|${amount}|${note}|${type}`
- Problem: Editing a note in your sheet created a duplicate because the key changed
- Problem: No way to update existing transactions from the sheet

### After (Source-Based)
- Dedup key: `source_ref` field (e.g., `sheet:September 2026:row_42`)
- Benefit: Editing any field (note, amount, category) in your sheet **updates** the existing transaction
- Benefit: No duplicates when you fix typos or change categories
- Benefit: Stable identity across syncs

## Database Changes

Run this SQL in your Supabase SQL Editor:

```sql
-- Add source_ref column to transactions
alter table public.transactions add column if not exists source_ref text;

-- Add source_ref column to sheet_inbox
alter table public.sheet_inbox add column if not exists source_ref text;

-- Create unique index for source-based dedup (allows nulls for manual entries)
create unique index if not exists idx_transactions_source_ref 
  on public.transactions(user_id, source_ref) 
  where source_ref is not null;
```

## Apps Script Update

Update your Apps Script to send the `source_ref` field:

```js
const SUPABASE_URL = "https://YOURPROJECT.supabase.co";
const ANON_KEY = "sb_publishable_XXXXXXXX";

// Sheet columns: A=Date  B=Type  C=Category  D=Note  E=Amount  F=Payment
function syncToSprout(e) {
  const row = e.range.getRow();
  if (row < 2) return; // skip header
  const sheet = e.source.getActiveSheet();
  const [date, kind, category, note, amount, payment] = sheet.getRange(row, 1, 1, 6).getValues()[0];
  if (!date || !amount) return;
  
  // Generate stable source_ref from sheet name + row number
  const sheetName = sheet.getName();
  const sourceRef = `sheet:${sheetName}:row_${row}`;
  
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
      payment: String(payment || "").toLowerCase() === "cash" ? "cash" : "card",
      source_ref: sourceRef,
    }),
  });
}
```

## How It Works Now

### Live Sheet Sync (Pull Mode)
When Sprout pulls from your Google Sheet:
1. Generates `source_ref` for each row: `sheet:{tabName}:row_{rowNumber}`
2. Checks if a transaction with that `source_ref` already exists
3. If yes → **updates** the existing transaction with new data
4. If no → creates a new transaction with that `source_ref`

### Apps Script Push (Push Mode)
When you edit your sheet:
1. Apps Script sends the row data with `source_ref: "sheet:{sheetName}:row_{row}"`
2. Sprout checks if a transaction with that `source_ref` exists
3. If yes → **updates** the existing transaction
4. If no → creates a new transaction

## Migration Steps

### 1. Run the SQL migration
```sql
alter table public.transactions add column if not exists source_ref text;
alter table public.sheet_inbox add column if not exists source_ref text;
create unique index if not exists idx_transactions_source_ref 
  on public.transactions(user_id, source_ref) 
  where source_ref is not null;
```

### 2. Update your Apps Script
Replace your existing Apps Script with the new version above.

### 3. Clean up existing duplicates (optional)
If you have duplicates from before this change, you can manually delete them in the app.

### 4. Backfill source_ref for existing transactions (optional)
If you want existing sheet-imported transactions to have `source_ref` values, you can:
- Delete them from the app
- Re-sync from your sheet (they'll be recreated with proper `source_ref`)

Or manually update them via SQL if you know the row numbers.

## Benefits

✅ **Edit notes freely** - No more duplicates when you fix typos
✅ **Update amounts** - Correct mistakes without creating duplicates  
✅ **Change categories** - Re-categorize without losing the transaction
✅ **Stable identity** - Each row in your sheet has a permanent ID
✅ **Two-way sync ready** - Future: edit in app, push back to sheet

## Backward Compatibility

- Transactions without `source_ref` (manually created) still work fine
- The unique index allows `NULL` values, so manual entries aren't affected
- Old content-based dedup is completely replaced by source-based dedup

## Troubleshooting

### "Duplicate entry" errors
If you see unique constraint violations, it means two transactions have the same `source_ref`. This shouldn't happen with the new logic, but if it does:
1. Check your Apps Script is sending unique `source_ref` values
2. Verify the SQL index was created correctly

### Existing transactions not updating
If editing your sheet doesn't update existing transactions:
1. Make sure you ran the SQL migration
2. Check that the transactions have `source_ref` values (they should after re-sync)
3. Verify your Apps Script is sending the `source_ref` field

### Manual entries affected?
No. Manually created transactions have `source_ref = NULL` and are unaffected by the unique index.
