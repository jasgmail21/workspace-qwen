# Edge Case Fixes - Source-Based Deduplication

## Issues Fixed

### Issue 1: Duplicate source_ref in Inbox Causing PostgreSQL Error

**Problem:**
When the sheet_inbox table contained multiple rows with the same `source_ref`, the sync process would fail with:
```
ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time
```

**Root Cause:**
The inbox processing loop was iterating through all inbox rows without deduplication. If two rows had the same `source_ref` (e.g., due to duplicate entries in the Google Sheet or multiple sync attempts), the code would:
1. Find the existing transaction by source_ref
2. Push it to `pushTx` array for update
3. Process the second inbox row with the same source_ref
4. Push the SAME transaction object to `pushTx` again
5. When Supabase upserted, it tried to update the same row twice in one operation → PostgreSQL error

**Fix:**
Added deduplication logic before processing inbox rows:
```typescript
// Deduplicate inbox rows by source_ref - keep only the latest entry for each source_ref
const dedupedInbox = new Map<string, typeof inboxRows[0]>();
for (const r of inboxRows) {
  const key = r.source_ref ?? `no_source_${r.id}`;
  dedupedInbox.set(key, r);
}
```

This ensures we only process one inbox row per unique source_ref, preventing the duplicate update error.

---

### Issue 2: sourceRef Lost When Editing Transaction in UI

**Problem:**
When a user edited a transaction in the Sprout UI (changing note, category, amount, etc.), the `sourceRef` field was being removed from the transaction, breaking the link to the original Google Sheet row.

**Root Cause:**
In `src/components/modals.tsx`, the transaction update was:
```typescript
if (initial) updateTransaction({ ...payload, id: initial.id });
```

The `payload` object only contained form fields (type, amount, categoryId, date, note, payment) but not `sourceRef`. When spreading `{ ...payload, id: initial.id }`, the `sourceRef` from the initial transaction was lost.

**Fix:**
Preserve `sourceRef` from the initial transaction:
```typescript
if (initial) updateTransaction({ ...payload, id: initial.id, sourceRef: initial.sourceRef });
```

Now when editing a synced transaction, the source_ref is preserved, maintaining the link to the Google Sheet row.

---

## How to Test

### Test Issue 1 Fix: Duplicate Inbox Entries

1. **Create duplicate inbox entries manually:**
   ```sql
   INSERT INTO sheet_inbox (date, kind, category, note, amount, payment, source_ref)
   VALUES 
     ('2026-09-07', 'expense', 'Food', 'Lunch', 500, 'card', 'sheet:Test:row_5'),
     ('2026-09-08', 'expense', 'Food', 'Lunch updated', 600, 'card', 'sheet:Test:row_5');
   ```

2. **Trigger a sync** (open the app or click "Sync now")

3. **Expected result:**
   - No PostgreSQL error
   - Only one transaction created/updated with source_ref = 'sheet:Test:row_5'
   - Both inbox rows deleted after processing

### Test Issue 2 Fix: Edit Synced Transaction

1. **Sync a transaction from Google Sheet** with source_ref

2. **Edit the transaction in Sprout UI:**
   - Change the note
   - Change the category
   - Change the amount

3. **Check the database:**
   ```sql
   SELECT id, note, category_id, source_ref FROM transactions WHERE id = 'your-tx-id';
   ```

4. **Expected result:**
   - `source_ref` is still present (not NULL)
   - Other fields updated correctly
   - Next sync will update this transaction instead of creating a duplicate

---

## Code Changes

### File: `src/cloud.ts`

**Lines ~388-467:** Added inbox deduplication
```typescript
// Before processing, deduplicate by source_ref
const dedupedInbox = new Map<string, typeof inboxRows[0]>();
for (const r of inboxRows) {
  const key = r.source_ref ?? `no_source_${r.id}`;
  dedupedInbox.set(key, r);
}

// Then iterate through dedupedInbox.values() instead of inboxRows
for (const r of dedupedInbox.values()) {
  // ... existing processing logic
}
```

### File: `src/components/modals.tsx`

**Line 115:** Preserve sourceRef on update
```typescript
// Before:
if (initial) updateTransaction({ ...payload, id: initial.id });

// After:
if (initial) updateTransaction({ ...payload, id: initial.id, sourceRef: initial.sourceRef });
```

---

## Edge Cases Handled

### 1. Inbox rows without source_ref
Transactions created manually (not from sheets) have `source_ref = NULL`. The deduplication logic handles this:
```typescript
const key = r.source_ref ?? `no_source_${r.id}`;
```
Rows without source_ref use their inbox ID as the key, so they're still deduplicated correctly.

### 2. Multiple edits to the same transaction
Each edit preserves source_ref, so the transaction can be synced back to the sheet multiple times without losing its identity.

### 3. Inbox rows with different data but same source_ref
If the Google Sheet has the same row synced multiple times with different data (e.g., user corrected a typo), the deduplication keeps only the latest entry (last one in the inbox, ordered by ID).

---

## Migration Notes

No database migration required for these fixes. The existing schema already supports:
- Multiple inbox rows with the same source_ref (now handled by deduplication)
- source_ref field on transactions (now preserved on UI edits)

---

## Prevention Tips

### For Users:
1. **Avoid duplicate entries in Google Sheet:** Each row should have a unique position (row number)
2. **Don't copy-paste rows:** If you need to duplicate a transaction, create a new row
3. **Wait for sync before editing:** After adding a row to the sheet, wait for it to sync before editing it in Sprout

### For Developers:
1. **Always preserve source_ref:** When updating transactions programmatically, always include sourceRef from the original transaction
2. **Test with duplicate inbox entries:** Before deploying sync changes, test with duplicate source_refs in sheet_inbox
3. **Monitor PostgreSQL logs:** Watch for "ON CONFLICT DO UPDATE" errors which indicate duplicate processing

---

## Related Documentation

- [Source-Based Deduplication Migration](./MIGRATION_SOURCE_REF.md)
- [Main Guide](./GUIDE.md) - Section 6: Google Sheets Integration
