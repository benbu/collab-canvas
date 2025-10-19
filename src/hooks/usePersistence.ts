import { useEffect, useRef, useState } from 'react'
import { rtdb as database, isFirebaseEnabled } from '../services/firebase'
import { ref, get, serverTimestamp, set } from 'firebase/database'
import type { Shape } from './useCanvasState'

type CanvasState = { byId: Record<string, Shape>; allIds: string[] }

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
      if (!isFirebaseEnabled || !database) {
        setHydrated(true)
        return
      }
      try {
        const snapRef = ref(database!, `rooms/${roomId}/meta/snapshot`)
        const snap = await get(snapRef)
        if (snap.exists()) {
          const data = snap.val() as any
          const shapesById = (data?.shapesById ?? {}) as Record<string, any>
          const allIds = (data?.allIds ?? []) as string[]
          // restore order
          for (const id of allIds) {
            const s = shapesById[id]
            if (!s) continue
            addShape({ id, type: s.type, x: s.x, y: s.y, width: s.width, height: s.height, radius: s.radius, fill: s.fill, text: s.text, fontSize: s.fontSize, rotation: s.rotation })
          }
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [roomId, addShape, state.allIds.length])

  useEffect(() => {
    if (!isFirebaseEnabled || !database) return
    const writeSnapshot = async () => {
      if (writing.current) return
      writing.current = true
      try {
        const snapRef = ref(database!, `rooms/${roomId}/meta/snapshot`)
        const shapesById: Record<string, any> = {}
        for (const id of state.allIds) {
          const s = state.byId[id]
          if (!s) continue
          shapesById[id] = {
            type: s.type,
            x: s.x,
            y: s.y,
            width: s.width ?? null,
            height: s.height ?? null,
            radius: s.radius ?? null,
            fill: s.fill ?? null,
            text: s.text ?? null,
            fontSize: s.fontSize ?? null,
            rotation: s.rotation ?? null,
          }
        }
        await set(snapRef, { shapesById, allIds: state.allIds, updatedAt: serverTimestamp() })
      } finally {
        writing.current = false
      }
    }
    const onVis = () => { if (document.visibilityState === 'hidden') void writeSnapshot() }
    const onUnload = () => { void writeSnapshot() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [roomId, state.allIds, state.byId])

  return { hydrated }
}


