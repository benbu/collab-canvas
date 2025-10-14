import { useEffect, useRef, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
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
      if (!isFirebaseEnabled || !db) {
        setHydrated(true)
        return
      }
      try {
        const ref = doc(db, 'rooms', roomId, 'meta', 'snapshot')
        const snap = await getDoc(ref)
        if (snap.exists()) {
          const data = snap.data() as any
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
  }, [roomId, addShape])

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const writeSnapshot = async () => {
      if (writing.current) return
      writing.current = true
      try {
        const ref = doc(db, 'rooms', roomId, 'meta', 'snapshot')
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
        await setDoc(ref, { shapesById, allIds: state.allIds, updatedAt: serverTimestamp() }, { merge: true })
      } finally {
        writing.current = false
      }
    }
    const interval = setInterval(() => { void writeSnapshot() }, 5000)
    const onVis = () => { if (document.visibilityState === 'hidden') void writeSnapshot() }
    const onUnload = () => { void writeSnapshot() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [roomId, state])

  return { hydrated }
}


