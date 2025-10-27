<!-- eccf9da3-78e2-4345-ad66-fcc71ddbe7fe 21a4ff79-6931-4dae-aa17-41df97c52047 -->
# Remove Snapshot/Hydrate Logic (with flushAllPending)

### Summary

- Delete `usePersistence` and remove all snapshot read/write logic. Rely on realtime RTDB listeners (`useFirestoreSync`) for initial load. Gate the loader only on `writers.ready`.
- Add `flushAllPending()` to `useFirestoreSync` to write any throttled/debounced in-flight edits before the tab is hidden/unloaded.

### Files to Change

- `src/hooks/usePersistence.ts`
- `src/components/Canvas/Canvas.tsx`
- `src/hooks/useFirestoreSync.ts`

### Edits

- Remove the `usePersistence` hook file entirely.
- In `Canvas.tsx`:
  - Remove `usePersistence` import and usage.
  - Replace loader gate `!(hydrated && writers.ready)` with `!writers.ready`.
  - Remove the post-delete snapshot write to `rooms/{roomId}/meta/snapshot`.
  - Add unload/visibility handlers that call `writers.flushAllPending?.()` (await when possible on visibilitychange).
- In `useFirestoreSync.ts`:
  - Track two pending queues:
    - `pendingPayloads` (existing) for debounced updates.
    - `pendingThrottlePayloads` (new) for updates dropped due to throttling.
  - In `update(shape)`: if throttled, store the latest `shape` in `pendingThrottlePayloads[id]` and return. On successful write, clear that entry.
  - In `updateImmediate` and `batchUpdate`: clear corresponding `pendingThrottlePayloads` entries.
  - Implement `flushAllPending(): Promise<void>`:
    - Cancel all debounce timers, collect latest from `pendingPayloads` and `pendingThrottlePayloads` into one map (debounced wins if both present).
    - If non-empty, `update(parentRef, updatesObj)` once; update `lastWriteMs` and `snapshotWritten` for flushed ids.

### Key Locations

- Loader gate to change:
```739:746:src/components/Canvas/Canvas.tsx
      {!(hydrated && (writers as any).ready) && (
        <div className="loaderOverlay" aria-busy>
          <div className="spinner" />
        </div>
      )}
```

- Delete-confirm flow snapshot write to remove:
```798:827:src/components/Canvas/Canvas.tsx
            if (isFirebaseEnabled && database) {
              try {
                const snapRef = dbRef(database, `rooms/${roomId}/meta/snapshot`)
                const shapesById: Record<string, any> = {}
                const remainingIds: string[] = []
                // ...build remainingIds and shapesById...
                void dbSet(snapRef, { shapesById, allIds: remainingIds, updatedAt: serverTimestamp() })
              } catch {}
            }
```

- `usePersistence` usage to remove:
```190:192:src/components/Canvas/Canvas.tsx
  const { hydrated } = usePersistence(roomId, state, addShape)
```

- New unload/visibility handlers (concise sketch):
```tsx
useEffect(() => {
  const onVis = async () => {
    if (document.visibilityState === 'hidden') {
      try { await (writers as any).flushAllPending?.() } catch {}
    }
  }
  const onUnload = () => { try { (writers as any).flushAllPending?.() } catch {} }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('beforeunload', onUnload)
  return () => {
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('beforeunload', onUnload)
  }
}, [writers])
```

- `useFirestoreSync` flush implementation (essentials only):
```ts
const pendingThrottlePayloads = useRef<Record<string, Shape | undefined>>({})

update: async (shape) => {
  // if throttled
  if (remaining > 0) {
    pendingThrottlePayloads.current[shape.id] = shape
    return
  }
  // ...perform update...
  pendingThrottlePayloads.current[shape.id] = undefined
}

const flushAllPending = async () => {
  const updatesObj: Record<string, any> = {}
  // cancel debounce timers and collect latest
  Object.keys(pendingTimers.current).forEach((id) => {
    const t = pendingTimers.current[id]
    if (t) clearTimeout(t)
    pendingTimers.current[id] = undefined
    const p = pendingPayloads.current[id]
    if (p) { updatesObj[id] = shapeToPayload(p) }
    pendingPayloads.current[id] = undefined
  })
  // collect throttled payloads
  Object.entries(pendingThrottlePayloads.current).forEach(([id, s]) => {
    if (s) { updatesObj[id] = shapeToPayload(s) }
    pendingThrottlePayloads.current[id] = undefined
  })
  if (Object.keys(updatesObj).length > 0) {
    await update(ref(database!, `rooms/${roomId}/shapes`), updatesObj)
    const now = Date.now()
    Object.keys(updatesObj).forEach((id) => {
      lastWriteMs.current[id] = now
      snapshotWritten({ id, ...(updatesObj[id] as any) } as Shape)
    })
  }
}

return { ...writers, ready, flushAllPending }
```


### Notes

- This avoids snapshot reads/writes while still minimizing potential loss on abrupt tab close.
- Worst-case loss is reduced to near-zero for both debounced and throttled paths.

### To-dos

- [ ] Delete src/hooks/usePersistence.ts and references
- [ ] Remove usePersistence import/usage, gate loader on writers.ready
- [ ] Delete post-delete snapshot write in Canvas.tsx
- [ ] Clean imports/types; ensure build passes