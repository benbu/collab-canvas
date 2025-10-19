<!-- 725d7c7d-a0b3-4380-a0e9-a55764e6a85a e30729df-0d5c-42d3-9451-d09f0caf7259 -->
# Drop Intermediate Shape Edit Writes (Coalesce updates)

## Root cause (brief)

- Shape edits call `onWriterUpdate` every frame; this invokes `writers.update`.
- `useFirestoreSync.update` is leading-only throttled (~80ms), still emitting many writes while dragging; these continue flushing after you stop.

Key call sites today:

```72:90:src/components/Canvas/ShapeRenderer.tsx
onDragMove: (evt) => {
  // ...
  onUpdateShape(id, { x: nextX, y: nextY })
  onWriterUpdate({ ...s, x: nextX, y: nextY, selectedBy: stateById[id]?.selectedBy })
}
```

```64:101:src/hooks/useFirestoreSync.ts

update: async (shape) => {

// throttle per-shape to ~80ms, with trailing (none)

const remaining = 80 - (now - last)

if (remaining > 0) return

await setDoc(ref, payload, { merge: true })

lastWriteMs.current[key] = Date.now()

}

```

## Proposed changes

1. Add per-shape debounced trailing writer in `useFirestoreSync.ts`:

   - Maintain `pendingTimers: Record<string, number>` and `pendingPayload: Record<string, Shape>`.
   - New method `updateDebounced(shape: Shape, delayMs = 150)`:
     - Store latest payload by `shape.id`, clear any existing timer, set a new timeout to write once with the latest state.
     - On flush: `setDoc` once, update `lastWriteMs`.
   - Add `cancelPending(id: string)` to drop scheduled writes.
   - Keep `updateImmediate` for end-of-gesture commits (already present).

2. Wire debounced writes at edit-time:

   - In `src/components/Canvas/ShapeRenderer.tsx`:
     - Replace `onWriterUpdate(...)` calls with `updateDebounced(...)`.
     - On `onDragEnd` and `onCommit`, first call `cancelPending(id)` then `updateImmediate(...)` to emit final state and prevent a trailing duplicate.
   - For group drag end, after `batchUpdate(...)`, cancel pending for all involved ids.

3. Add small change thresholds to reduce noise:

   - In `updateDebounced`, drop writes if the new payload changed by less than epsilons: position < 0.5px, rotation < 1°, size < 0.5px.

4. Keep selection ownership writes as-is, but ensure they use `updateImmediate` when claiming/releasing ownership to avoid delays.

5. Optional: expose `debounceDelayMs` via env or constant for quick tuning.

## Acceptance checks

- While dragging, writes are at most ~1 every 150ms (or fewer), not at frame rate.
- After releasing, only a single immediate write fires; no lingering stream of writes follows.
- Group drags do a single `batchUpdate` and do not emit extra per-shape trailing writes.
- Remote collaborators still see smooth-enough updates at the debounced cadence.

## Small code pointers

- `src/hooks/useFirestoreSync.ts`: add `updateDebounced` and `cancelPending` alongside existing writers.
- `src/components/Canvas/ShapeRenderer.tsx`: switch edit-time calls to debounced; cancel+immediate on commit/end.
- `src/components/Canvas/Canvas.tsx`: group drag end already batches; just ensure pending cancellations for selected ids.

### To-dos

- [ ] Add per-shape updateDebounced and cancelPending in useFirestoreSync.ts
- [ ] Use updateDebounced in ShapeRenderer edit paths; cancel+immediate on end
- [ ] Cancel pending debounced writes for all selected ids after group drag end
- [ ] Add position/size/rotation change thresholds to drop micro-updates
- [ ] Verify write frequency and no trailing writes; adjust debounce delay if needed