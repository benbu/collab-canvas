import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb as database, isFirebaseEnabled } from '../services/firebase'
import {
  ref,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue,
  serverTimestamp,
  set,
  update,
  remove,
} from 'firebase/database'
import type { Shape } from './useCanvasState'
import { markStart, markEnd, incrementCounter } from '../utils/performance'

type Writer = {
  add: (shape: Shape) => Promise<void>
  update: (shape: Shape) => Promise<void>
  updateImmediate: (shape: Shape) => Promise<void>
  batchUpdate: (shapes: Shape[]) => Promise<void>
  remove: (id: string) => Promise<void>
  updateDebounced?: (shape: Shape, delayMs?: number) => Promise<void>
  cancelPending?: (id: string) => void
}

export function useFirestoreSync(
  roomId: string,
  onRemoteUpsert: (s: Shape) => void,
  onRemoteRemove: (id: string) => void,
): Writer & { ready: boolean; flushAllPending?: () => Promise<void> } {
  // Per-shape throttle state to smooth live updates
  const lastWriteMs = useRef<Record<string, number>>({})
  const [ready, setReady] = useState(!isFirebaseEnabled)
  const upsertRef = useRef(onRemoteUpsert)
  const removeRef = useRef(onRemoteRemove)
  useEffect(() => { upsertRef.current = onRemoteUpsert }, [onRemoteUpsert])
  useEffect(() => { removeRef.current = onRemoteRemove }, [onRemoteRemove])

  // Debounce state per-shape
  const pendingTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({})
  const pendingPayloads = useRef<Record<string, Shape | undefined>>({})
  // Track latest payloads that were skipped due to per-shape throttling
  const pendingThrottlePayloads = useRef<Record<string, Shape | undefined>>({})
  // Snapshot of last written values per shape for epsilon filtering
  const lastWrittenState = useRef<Record<string, {
    x?: number
    y?: number
    width?: number
    height?: number
    radius?: number
    rotation?: number
    text?: string
    fontSize?: number
    fontFamily?: string
  }>>({})

  const isSignificantChange = (id: string, next: Shape): boolean => {
    const prev = lastWrittenState.current[id]
    if (!prev) return true
    const posEps = 0.5
    const sizeEps = 0.5
    const rotEps = 1
    if (typeof next.x === 'number' && typeof prev.x === 'number' && Math.abs(next.x - prev.x) > posEps) return true
    if (typeof next.y === 'number' && typeof prev.y === 'number' && Math.abs(next.y - prev.y) > posEps) return true
    if (typeof next.width === 'number' && typeof prev.width === 'number' && Math.abs((next.width ?? 0) - (prev.width ?? 0)) > sizeEps) return true
    if (typeof next.height === 'number' && typeof prev.height === 'number' && Math.abs((next.height ?? 0) - (prev.height ?? 0)) > sizeEps) return true
    if (typeof next.radius === 'number' && typeof prev.radius === 'number' && Math.abs((next.radius ?? 0) - (prev.radius ?? 0)) > sizeEps) return true
    if (typeof next.rotation === 'number' && typeof prev.rotation === 'number' && Math.abs((next.rotation ?? 0) - (prev.rotation ?? 0)) > rotEps) return true
    if ((next.text ?? '') !== (prev.text ?? '')) return true
    if (typeof next.fontSize === 'number' && typeof prev.fontSize === 'number' && Math.abs((next.fontSize ?? 0) - (prev.fontSize ?? 0)) > sizeEps) return true
    if ((next.fontFamily ?? '') !== (prev.fontFamily ?? '')) return true
    return false
  }

  const snapshotWritten = (s: Shape) => {
    lastWrittenState.current[s.id] = {
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      radius: s.radius,
      rotation: s.rotation,
      text: s.text,
      fontSize: s.fontSize,
      fontFamily: (s as any).fontFamily,
    }
  }

  // Helper to convert a Shape to RTDB payload
  const shapeToPayload = (shape: Shape): Record<string, unknown> => ({
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width ?? null,
    height: shape.height ?? null,
    radius: shape.radius ?? null,
    fill: shape.fill ?? null,
    text: shape.text ?? null,
    fontSize: shape.fontSize ?? null,
    fontFamily: (shape as any).fontFamily ?? null,
    rotation: shape.rotation ?? null,
    zIndex: shape.zIndex ?? null,
    updatedAt: serverTimestamp(),
    ...(shape.selectedBy !== undefined ? { selectedBy: shape.selectedBy } : {}),
  })

  const writers = useMemo<Writer>(() => ({
    add: async (shape: Shape) => {
      if (!isFirebaseEnabled || !database) return
      const shapeRef = ref(database!, `rooms/${roomId}/shapes/${shape.id}`)
      {
        const marker = markStart(`fs-add-${shape.id}`)
        const payload: Record<string, unknown> = {
          type: shape.type,
          x: shape.x,
          y: shape.y,
          width: shape.width ?? null,
          height: shape.height ?? null,
          radius: shape.radius ?? null,
          fill: shape.fill ?? null,
          text: shape.text ?? null,
          fontSize: shape.fontSize ?? null,
          fontFamily: (shape as any).fontFamily ?? null,
          rotation: shape.rotation ?? null,
          zIndex: shape.zIndex ?? null,
          updatedAt: serverTimestamp(),
        }
        if (shape.selectedBy !== undefined) payload.selectedBy = shape.selectedBy
        await set(shapeRef, payload)
        markEnd(marker, 'firestore-write', 'add')
      }
    },
    update: async (shape: Shape) => {
      if (!isFirebaseEnabled || !database) return
      // throttle per-shape to ~30ms
      const key = shape.id
      const now = Date.now()
      const last = lastWriteMs.current[key] ?? 0
      const interval = 30
      const remaining = interval - (now - last)

      if (remaining > 0) {
        incrementCounter('rtdb-throttled', 'update')
        // retain the most recent payload for potential flush
        pendingThrottlePayloads.current[key] = shape
        return
      }

      const marker = markStart(`fs-update-${shape.id}`)
      const shapeRef = ref(database!, `rooms/${roomId}/shapes/${shape.id}`)
      const payload: Record<string, unknown> = shapeToPayload(shape)
      await update(shapeRef, payload)
      lastWriteMs.current[key] = Date.now()
      // clear any throttled pending for this id since we just wrote
      pendingThrottlePayloads.current[key] = undefined
      snapshotWritten(shape)
      markEnd(marker, 'firestore-write', 'update')
    },
    updateImmediate: async (shape: Shape) => {
      if (!isFirebaseEnabled || !database) return
      const marker = markStart(`fs-update-imm-${shape.id}`)
      const shapeRef = ref(database!, `rooms/${roomId}/shapes/${shape.id}`)
      const payload: Record<string, unknown> = shapeToPayload(shape)
      await update(shapeRef, payload)
      // Update throttle marker so immediate write doesn't cause an immediate trailing throttled write
      lastWriteMs.current[shape.id] = Date.now()
      // Cancel any pending debounced write for this shape and snapshot
      const t = pendingTimers.current[shape.id]
      if (t) {
        clearTimeout(t)
        pendingTimers.current[shape.id] = undefined
      }
      pendingPayloads.current[shape.id] = undefined
      // clear any throttled pending for this id since we just wrote
      pendingThrottlePayloads.current[shape.id] = undefined
      snapshotWritten(shape)
      markEnd(marker, 'firestore-write', 'updateImmediate')
    },
    batchUpdate: async (shapes: Shape[]) => {
      if (!isFirebaseEnabled || !database) return
      if (shapes.length === 0) return
      const marker = markStart(`fs-batch-update-${shapes.length}`)
      const now = Date.now()
      const parentRef = ref(database!, `rooms/${roomId}/shapes`)
      const updatesObj: Record<string, any> = {}
      
      shapes.forEach((shape) => {
        const payload: Record<string, unknown> = shapeToPayload(shape)
        updatesObj[shape.id] = { ...(updatesObj[shape.id] || {}), ...payload }
        
        // Update throttle markers for all shapes in batch
        lastWriteMs.current[shape.id] = now
        // Cancel any pending debounced write and snapshot
        const t = pendingTimers.current[shape.id]
        if (t) {
          clearTimeout(t)
          pendingTimers.current[shape.id] = undefined
        }
        pendingPayloads.current[shape.id] = undefined
        // clear any throttled pending for this id since we are writing
        pendingThrottlePayloads.current[shape.id] = undefined
        snapshotWritten(shape)
      })
      
      await update(parentRef, updatesObj)
      markEnd(marker, 'firestore-write', `batchUpdate-${shapes.length}-shapes`)
    },
    remove: async (id: string) => {
      if (!isFirebaseEnabled || !database) return
      const marker = markStart(`fs-remove-${id}`)
      const shapeRef = ref(database!, `rooms/${roomId}/shapes/${id}`)
      await remove(shapeRef)
      markEnd(marker, 'firestore-write', 'remove')
    },
    updateDebounced: async (shape: Shape, delayMs = 150) => {
      if (!isFirebaseEnabled || !database) return
      const id = shape.id
      // Filter out micro-changes relative to last written state
      if (!isSignificantChange(id, shape)) {
        return
      }
      pendingPayloads.current[id] = shape
      const existing = pendingTimers.current[id]
      if (existing) {
        clearTimeout(existing)
      }
      pendingTimers.current[id] = setTimeout(async () => {
        const latest = pendingPayloads.current[id]
        pendingTimers.current[id] = undefined
        pendingPayloads.current[id] = undefined
        if (!latest) return
        const marker = markStart(`fs-update-debounced-${id}`)
        const shapeRef = ref(database!, `rooms/${roomId}/shapes/${id}`)
        const payload: Record<string, unknown> = {
          type: latest.type,
          x: latest.x,
          y: latest.y,
          width: latest.width ?? null,
          height: latest.height ?? null,
          radius: latest.radius ?? null,
          fill: latest.fill ?? null,
          text: latest.text ?? null,
          fontSize: latest.fontSize ?? null,
          fontFamily: (latest as any).fontFamily ?? null,
          rotation: latest.rotation ?? null,
          zIndex: latest.zIndex ?? null,
          updatedAt: serverTimestamp(),
        }
        if (latest.selectedBy !== undefined) payload.selectedBy = latest.selectedBy
        await update(shapeRef, payload)
        lastWriteMs.current[id] = Date.now()
        snapshotWritten(latest)
        markEnd(marker, 'firestore-write', 'updateDebounced')
      }, delayMs)
    },
    cancelPending: (id: string) => {
      const t = pendingTimers.current[id]
      if (t) {
        clearTimeout(t)
        pendingTimers.current[id] = undefined
      }
      pendingPayloads.current[id] = undefined
    },
  }), [roomId])

  // Flush any pending debounced or throttled updates immediately
  const flushAllPending = async () => {
    if (!isFirebaseEnabled || !database) return
    const parentRef = ref(database!, `rooms/${roomId}/shapes`)
    const updatesObj: Record<string, any> = {}

    // Cancel all debounce timers and collect latest pending debounced payloads
    Object.keys(pendingTimers.current).forEach((id) => {
      const t = pendingTimers.current[id]
      if (t) clearTimeout(t)
      pendingTimers.current[id] = undefined
      const pending = pendingPayloads.current[id]
      if (pending) {
        updatesObj[id] = { ...(updatesObj[id] || {}), ...shapeToPayload(pending) }
      }
      pendingPayloads.current[id] = undefined
    })

    // Collect latest payloads that were skipped due to throttling
    Object.entries(pendingThrottlePayloads.current).forEach(([id, s]) => {
      if (s) {
        updatesObj[id] = { ...(updatesObj[id] || {}), ...shapeToPayload(s) }
      }
      pendingThrottlePayloads.current[id] = undefined
    })

    const keys = Object.keys(updatesObj)
    if (keys.length === 0) return

    await update(parentRef, updatesObj)
    const now = Date.now()
    keys.forEach((id) => {
      lastWriteMs.current[id] = now
      // Construct a minimal shape to snapshot lastWritten
      const u = updatesObj[id]
      snapshotWritten({
        id,
        type: u.type,
        x: u.x,
        y: u.y,
        width: u.width ?? undefined,
        height: u.height ?? undefined,
        radius: u.radius ?? undefined,
        fill: u.fill ?? undefined,
        text: u.text ?? undefined,
        fontSize: u.fontSize ?? undefined,
        fontFamily: u.fontFamily ?? undefined,
        rotation: u.rotation ?? undefined,
        zIndex: u.zIndex ?? undefined,
      } as any)
    })
  }

  useEffect(() => {
    if (!isFirebaseEnabled || !database) return
    const listRef = ref(database!, `rooms/${roomId}/shapes`)
    // Set ready after first value event (including empty lists)
    let initialized = false
    const readyUnsub = onValue(listRef, () => {
      if (!initialized) {
        initialized = true
        if (!ready) setReady(true)
        readyUnsub()
      }
    })

    const unsubAdds = onChildAdded(listRef, (snap) => {
      const data = snap.val() as Record<string, unknown>
      const shape: Shape = {
        id: snap.key as string,
        type: data.type as any,
        x: (data.x as number) ?? 0,
        y: (data.y as number) ?? 0,
        width: (data.width as number) ?? undefined,
        height: (data.height as number) ?? undefined,
        radius: (data.radius as number) ?? undefined,
        fill: (data.fill as string) ?? undefined,
        text: (data.text as string) ?? undefined,
        fontSize: (data.fontSize as number) ?? undefined,
        fontFamily: (data.fontFamily as string) ?? undefined,
        rotation: (data.rotation as number) ?? undefined,
        zIndex: (data.zIndex as number) ?? undefined,
        selectedBy: (data.selectedBy as any) ?? undefined,
      }
      upsertRef.current(shape)
    })
    const unsubChanges = onChildChanged(listRef, (snap) => {
      const data = snap.val() as Record<string, unknown>
      const shape: Shape = {
        id: snap.key as string,
        type: data.type as any,
        x: (data.x as number) ?? 0,
        y: (data.y as number) ?? 0,
        width: (data.width as number) ?? undefined,
        height: (data.height as number) ?? undefined,
        radius: (data.radius as number) ?? undefined,
        fill: (data.fill as string) ?? undefined,
        text: (data.text as string) ?? undefined,
        fontSize: (data.fontSize as number) ?? undefined,
        fontFamily: (data.fontFamily as string) ?? undefined,
        rotation: (data.rotation as number) ?? undefined,
        zIndex: (data.zIndex as number) ?? undefined,
        selectedBy: (data.selectedBy as any) ?? undefined,
      }
      upsertRef.current(shape)
    })
    const unsubRemoves = onChildRemoved(listRef, (snap) => {
      removeRef.current(snap.key as string)
    })

    return () => {
      unsubAdds()
      unsubChanges()
      unsubRemoves()
    }
  }, [roomId, ready])

  return { ...writers, ready, flushAllPending }
}


