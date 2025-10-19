<!-- bbd7c578-63f6-47c2-ba20-63a4d5b906ea c71a8fcc-6acb-4337-aee6-018355c80783 -->
# Batch Firestore Writes Optimization

## 1. Create Unified Presence Hook

Replace separate cursor and character syncs with a single presence document per user.

**Create `src/hooks/usePresenceSync.ts`:**

- Merge `useCursorSync` and `useCharacterSync` logic
- Single document: `rooms/{roomId}/presence/{userId}`
- Data model: `{ cursor: {x, y}, character: {x, y, vx, vy, onGround, state, ...}, color, name, updatedAt }`
- Single write operation combining both cursor and character updates
- Throttle: 50ms (20 FPS) - balances character physics needs with network efficiency
- Include idle detection: skip writes when character is idle AND cursor hasn't moved

**Update `src/components/Canvas/Canvas.tsx`:**

- Remove `useCursorSync` and `useCharacterSync` imports
- Import and use new `usePresenceSync` hook
- Extract cursor and character data from unified presence state
- Pass character data to CharacterRenderer, cursor data to CursorLayer

## 2. Add Batch Write Support to Firestore Sync

Enable batching for group shape operations.

**Update `src/hooks/useFirestoreSync.ts`:**

- Import `writeBatch` from firebase/firestore
- Add new `batchUpdate` method to Writer interface
- Implementation: accepts array of shapes, creates batch, commits atomically
- Maintains same payload structure as individual updates
- Add performance markers for batch operations

## 3. Use Batch Writes for Group Operations

Apply batching to multi-shape updates.

**Update group drag in `src/components/Canvas/Canvas.tsx`:**

```850-862
// In onDragEnd for group operations
if (groupDragRef.current.active && selectedIds.length > 1) {
  const shapesToUpdate = selectedIds.map(id => state.byId[id]).filter(Boolean)
  writers.batchUpdate && writers.batchUpdate(shapesToUpdate)
}
```

**Update text panel edits in `src/components/Canvas/Canvas.tsx`:**

```746-754
// When editing multiple text shapes
if (selectedIds.length > 1) {
  const updatedShapes = selectedIds.map(id => ({ ...state.byId[id], text: newText, fontFamily }))
  writers.batchUpdate && writers.batchUpdate(updatedShapes)
}
```

**Update z-index operations in `src/hooks/useShapeOperations.ts`:**

- `handleBringToFront`, `handleSendToBack`, etc.
- Replace multiple individual writes with single batch write
- Example: `writers.batchUpdate(selectedShapes)`

## 4. Update Performance Monitoring

Track new metrics for batching efficiency.

**Update `PERFORMANCE_MONITORING.md`:**

- Document new presence write metrics (reduced by ~50%)
- Add batch write metrics: batch size, frequency
- Update optimization notes with savings calculations

## Key Benefits

- **50% reduction** in presence-related writes (cursor + character → single write)
- **Significant reduction** in shape writes during group operations (N writes → 1 batch)
- **Maintains responsiveness** with conservative 50ms throttle
- **Backward compatible** - old presence documents naturally expire after 2 seconds

### To-dos

- [ ] Create unified usePresenceSync hook merging cursor and character sync logic
- [ ] Add batchUpdate method to useFirestoreSync Writer interface
- [ ] Update Canvas.tsx to use unified presence sync instead of separate hooks
- [ ] Apply batch writes to group drag, text edits, and z-index operations
- [ ] Update performance documentation with new metrics