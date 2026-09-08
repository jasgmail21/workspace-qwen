# Fix: Duplicate Inbox Rows Not Being Deleted

## Problem

When the same Google Sheet row was synced multiple times (e.g., user edited a transaction twice), multiple entries with the same `source_ref` would accumulate in the `sheet_inbox` table.

### Example Scenario

1. User adds row to Google Sheet → Apps Script pushes to `sheet_inbox` (id=1, date=7, source_ref="sheet:Test:row_42")
2. User edits the same row → Apps Script pushes again (id=2, date=8, source_ref="sheet:Test:row_42")
3. Sprout sync runs:
   - Deduplicates inbox rows, keeps only the latest (id=2, date=8)
   - Creates transaction with date=8
   - Deletes only id=2 from `sheet_inbox`
   - **Problem:** id=1 (date=7) is still in `sheet_inbox`!
4. Next sync:
   - Finds id=1 still in `sheet_inbox`
   - Updates transaction to date=7 (wrong!)

### Root Cause

The deduplication logic was only tracking which inbox row to process, not which ones to delete:

```typescript
// OLD CODE - Only tracked the row to process
const dedupedInbox = new Map<string, typeof inboxRows[0]>();
for (const r of inboxRows) {
  const key = r.source_ref ?? `no_source_${r.id}`;
  dedupedInbox.set(key, r); // Overwrites previous, loses track of old IDs
}

const inboxIds: number[] = [];
for (const r of dedupedInbox.values()) {
  // ... process row ...
  inboxIds.push(r.id); // Only collects the latest ID
}

// Only deletes the latest, leaves duplicates behind
await client.from("sheet_inbox").delete().in("id", inboxIds);
```

## Solution

Group all inbox rows by `source_ref`, process only the latest one, but **delete ALL of them** from `sheet_inbox`:

```typescript
// NEW CODE - Track ALL rows per source_ref
const inboxBySource = new Map<string, typeof inboxRows>();
for (const r of inboxRows) {
  const key = r.source_ref ?? `no_source_${r.id}`;
  if (!inboxBySource.has(key)) {
    inboxBySource.set(key, []);
  }
  inboxBySource.get(key)!.push(r);
}

const allInboxIds: number[] = [];
for (const rows of inboxBySource.values()) {
  // Sort by ID descending to get the latest entry
  rows.sort((a, b) => b.id - a.id);
  const latest = rows[0];
  
  // Collect ALL inbox IDs for deletion (not just the one we process)
  for (const row of rows) {
    allInboxIds.push(row.id);
  }

  // ... process only the latest row ...
}

// Delete ALL inbox rows (including duplicates)
await client.from("sheet_inbox").delete().in("id", allInboxIds);
```

## Changes Made

### File: `src/cloud.ts`

**Before:**
- Deduplicated inbox rows into a Map (kept only latest)
- Processed each unique source_ref
- Deleted only the processed rows

**After:**
- Grouped inbox rows by source_ref into a Map of arrays
- For each group:
  - Sort by ID descending (latest first)
  - Collect ALL IDs in the group
  - Process only the latest row
- Delete ALL collected IDs (including duplicates)

## Testing

### Test Case 1: Multiple Edits to Same Row

1. Add row to Google Sheet (row 42, date=7)
2. Wait for sync → transaction created with date=7
3. Edit row in Google Sheet (row 42, date=8)
4. Wait for sync → transaction updated to date=8
5. **Verify:** `sheet_inbox` should be empty (no duplicate rows left)
6. **Verify:** Next sync should not change the date back to 7

### Test Case 2: Rapid Edits Before Sync

1. Add row to Google Sheet (row 42, date=7)
2. Immediately edit row (row 42, date=8)
3. Immediately edit again (row 42, date=9)
4. `sheet_inbox` now has 3 rows with same source_ref
5. Trigger sync
6. **Verify:** Transaction created with date=9 (latest)
7. **Verify:** All 3 rows deleted from `sheet_inbox`
8. **Verify:** Next sync does not revert to date=7 or date=8

### SQL Verification

```sql
-- Check for duplicate source_refs in sheet_inbox (should be 0 after fix)
SELECT source_ref, COUNT(*) as count
FROM sheet_inbox
WHERE source_ref IS NOT NULL
GROUP BY source_ref
HAVING COUNT(*) > 1;

-- Check that processed rows are deleted
SELECT * FROM sheet_inbox WHERE source_ref = 'sheet:Test:row_42';
-- Should return 0 rows after sync
```

## Impact

### Before Fix
- Duplicate inbox rows accumulated over time
- Transactions could revert to old values on subsequent syncs
- `sheet_inbox` table grew unbounded
- Required manual cleanup

### After Fix
- All duplicate inbox rows are cleaned up in one sync
- Transactions always reflect the latest Google Sheet state
- `sheet_inbox` stays clean
- No manual intervention needed

## Related Files

- `src/cloud.ts` - Main sync logic
- `src/types.ts` - Transaction type definition (includes sourceRef)
- `src/components/modals.tsx` - Preserves sourceRef when editing in UI

## Migration

No database migration required. The fix works with existing data:
- Existing duplicate rows in `sheet_inbox` will be cleaned up on next sync
- Existing transactions with `source_ref` will continue to work correctly
- No changes to the schema needed

## Edge Cases Handled

1. **Rows without source_ref:** Grouped by `no_source_${id}` key, each processed and deleted individually
2. **Malformed rows:** Still deleted from inbox even if they can't be processed
3. **Empty inbox:** No deletion query executed
4. **Mixed duplicates:** Some source_refs have duplicates, others don't - all handled correctly
