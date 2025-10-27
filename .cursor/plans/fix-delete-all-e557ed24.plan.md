<!-- e557ed24-24a9-42d6-b178-14284fbeb65b 11d4b9c0-dc29-4320-9174-77756d043942 -->
# Fix Delete All - Prevent Re-hydration

## Root Cause

The hydration effect in `usePersistence.ts` has `state.allIds.length` in its dependency array (line 48). When "Delete All" is clicked:

1. All shapes removed → `state.allIds.length` changes from N to 0
2. useEffect re-runs due to dependency change
3. Check `if (state.allIds.length > 0)` is now false
4. Early return is skipped, hydration proceeds
5. Snapshot (not yet updated) still has all shapes → all shapes restored!

## Solution

Use a ref to track whether hydration has been attempted, so it only runs once on mount regardless of `state.allIds.length` changes.

## File to Change

### `src/hooks/usePersistence.ts` (lines 8-48)

Change from:

```typescript
export function usePersistence(
  roomId: string,
  state: CanvasState,
  addShape: (shape: Shape) => void,
) {
  const [hydrated, setHydrated] = useState(!isFirebaseEnabled)
  const writing = useRef(false)

  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      // If live sync has already populated shapes, skip hydration
      if (state.allIds.length > 0) {
        setHydrated(true)
        return
      }
      // ... rest of hydration logic
    }
    void hydrate()
    return () => { cancelled = true }
  }, [roomId, addShape, state.allIds.length])  // ← Remove state.allIds.length
```

To:

```typescript
export function usePersistence(
  roomId: string,
  state: CanvasState,
  addShape: (shape: Shape) => void,
) {
  const [hydrated, setHydrated] = useState(!isFirebaseEnabled)
  const writing = useRef(false)
  const hydrationAttempted = useRef(false)  // ← Add this ref

  useEffect(() => {
    // Only hydrate once per room
    if (hydrationAttempted.current) return
    hydrationAttempted.current = true
    
    let cancelled = false
    const hydrate = async () => {
      // If live sync has already populated shapes, skip hydration
      if (state.allIds.length > 0) {
        setHydrated(true)
        return
      }
      // ... rest of hydration logic (unchanged)
    }
    void hydrate()
    return () => { cancelled = true }
  }, [roomId, addShape])  // ← Remove state.allIds.length from deps

  // ... rest of file unchanged
```

Key changes:

1. Add `hydrationAttempted` ref to track if hydration has run
2. Early return if hydration already attempted
3. Remove `state.allIds.length` from dependency array
4. Keep `roomId` so hydration re-runs when switching rooms

## Why This Works

Hydration only runs once when the component mounts or when `roomId` changes. Deleting all shapes no longer triggers re-hydration because `state.allIds.length` is no longer a dependency.