<!-- 1fa3c7fe-8ed2-42d3-bb59-57a0d63316af 31623302-11b2-43eb-aab1-0e7725ddca25 -->
# Presence heartbeat, idle indicator, and disconnect cleanup

## Goals

- Per-room presence docs: `{ name, color, lastSeen, loggedIn }`
- Heartbeat every 15s; update `lastSeen` and keep `loggedIn: true`
- UI shows users; adds small sleep icon when idle >30s
- Hide user entirely when `lastSeen > 60s` or doc deleted
- Local user label shows "(you)"
- On disconnect: delete presence doc immediately and clear any `selectedBy`

## Files to Add/Change

- Add: `src/hooks/usePresence.ts`
- Edit: `src/components/Presence/PresenceList.tsx`
- Edit: `src/components/Canvas/Canvas.tsx`
- Edit: `src/components/Presence/__tests__/PresenceList.test.tsx`
- Optional: `firestore.rules` (ensure presence subcollection allowed)

## Data Model

```ts
// rooms/{roomId}/presence/{userId}
{
  name: string,
  color: string,
  lastSeen: Timestamp, // serverTimestamp on writes
  loggedIn: boolean
}
```

## Implementation Steps

1. Create `usePresence` hook

   - Subscribe to `rooms/{roomId}/presence` and expose `presenceById: Record<string, PresenceUser>`.
   - On mount: upsert self doc with `{ name, color, loggedIn: true, lastSeen: serverTimestamp() }`.
   - Heartbeat: `setInterval(15_000)` to update `lastSeen` and ensure `loggedIn: true`.
   - Cleanup: on `beforeunload` and effect cleanup, delete self presence doc.

2. Clear selections on disconnect

   - In `Canvas.tsx`, on cleanup (and `beforeunload`), iterate shapes where `selectedBy.userId === selfId` and call `writers.updateImmediate({ ...shape, selectedBy: null })`.

3. Wire hook in `Canvas.tsx`

   - Get `roomId`, `selfId`, `displayName`, `color` (reuse cursor color).
   - Call `usePresence` and pass down `presenceById` and `selfId` to the Presence UI.

4. Update `PresenceList.tsx`

   - Change props to `{ selfId: string; presence: Record<string, { name?: string; color?: string; lastSeen?: number; loggedIn?: boolean }> }`.
   - Filter: hide entries where `now - lastSeen > 60000`.
   - Mark idle: if `now - lastSeen > 30000`, render a small sleep icon before the name.
   - Append `(you)` to local user name.
   - Keep sorting and overflow behavior as before.

5. Tests

   - Update `PresenceList` tests:
     - hides entries stale >60s
     - shows z-icon for entries idle >30s
     - appends (you) for local user

6. Firestore rules

   - Ensure rules allow CRUD on `rooms/{roomId}/presence/{userId}` for authenticated users.

## Key Insertion Points

```167:191:src/components/Canvas/Canvas.tsx
// Manage selection ownership cleanup exists; add disconnect cleanup similar to this block
```

```1:36:src/components/Presence/PresenceList.tsx

// Replace cursor-based source with presence-based items and idle/z logic

```

## Notes

- Keep existing cursor sync for cursors; presence list no longer depends on cursor activity.
- For hard shutdowns, other clients hide users once `lastSeen` exceeds 60s.

### To-dos

- [ ] Create usePresence hook with snapshot subscribe & 15s heartbeat
- [ ] Wire usePresence in Canvas and pass presence to UI
- [ ] On unmount/beforeunload, clear selectedBy and delete presence
- [ ] Update PresenceList to show idle icon, (you), and 60s hide
- [ ] Update PresenceList tests for idle/hidden/self cases
- [ ] Verify Firestore rules allow presence subcollection read/write