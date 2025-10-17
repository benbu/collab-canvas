import { useEffect, useMemo, useRef, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import type { Shape } from './useCanvasState'

type Writer = {
  add: (shape: Shape) => Promise<void>
  update: (shape: Shape) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useFirestoreSync(
  roomId: string,
  onRemoteUpsert: (s: Shape) => void,
  onRemoteRemove: (id: string) => void,
): Writer & { ready: boolean } {
  // Per-shape throttle state to smooth live updates similar to cursor sync (~12.5 fps)
  const pendingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastWriteMs = useRef<Record<string, number>>({})
  const [ready, setReady] = useState(!isFirebaseEnabled)
  const upsertRef = useRef(onRemoteUpsert)
  const removeRef = useRef(onRemoteRemove)
  useEffect(() => { upsertRef.current = onRemoteUpsert }, [onRemoteUpsert])
  useEffect(() => { removeRef.current = onRemoteRemove }, [onRemoteRemove])

  const writers = useMemo<Writer>(() => ({
    add: async (shape: Shape) => {
      if (!isFirebaseEnabled || !db) return
      const database = db!
      const ref = doc(database, 'rooms', roomId, 'shapes', shape.id)
      {
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
          rotation: shape.rotation ?? null,
          updatedAt: serverTimestamp(),
        }
        if (shape.selectedBy !== undefined) payload.selectedBy = shape.selectedBy
        await setDoc(ref, payload, { merge: true })
      }
    },
    update: async (shape: Shape) => {
      if (!isFirebaseEnabled || !db) return
      const database = db!
      // throttle per-shape to ~80ms, with trailing
      const key = shape.id
      const now = Date.now()
      const last = lastWriteMs.current[key] ?? 0
      const interval = 80
      const remaining = interval - (now - last)

      const write = async (s: Shape) => {
        const ref = doc(database, 'rooms', roomId, 'shapes', s.id)
        const payload: Record<string, unknown> = {
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
          updatedAt: serverTimestamp(),
        }
        // Only include selectedBy if explicitly provided; otherwise preserve existing
        if (s.selectedBy !== undefined) payload.selectedBy = s.selectedBy
        await setDoc(ref, payload, { merge: true })
        lastWriteMs.current[key] = Date.now()
      }

      if (remaining <= 0) {
        // write immediately
        await write(shape)
        // clear any trailing timer since we just wrote
        if (pendingTimers.current[key]) {
          clearTimeout(pendingTimers.current[key])
          delete pendingTimers.current[key]
        }
        return
      }

      // schedule trailing write with the latest shape
      if (pendingTimers.current[key]) {
        clearTimeout(pendingTimers.current[key])
      }
      pendingTimers.current[key] = setTimeout(() => {
        void write(shape)
        delete pendingTimers.current[key]
      }, remaining)
    },
    remove: async (id: string) => {
      if (!isFirebaseEnabled || !db) return
      const database = db!
      const ref = doc(database, 'rooms', roomId, 'shapes', id)
      await deleteDoc(ref)
    },
  }), [roomId])

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const colRef = collection(db, 'rooms', roomId, 'shapes')
    const unsub: Unsubscribe = onSnapshot(colRef, (snap) => {
      snap.docChanges().forEach((change) => {
        const data = change.doc.data() as Record<string, unknown>
        if (change.type === 'removed') {
          removeRef.current(change.doc.id)
        } else {
          const shape: Shape = {
            id: change.doc.id,
            type: data.type as any,
            x: data.x as number,
            y: data.y as number,
            width: (data.width as number) ?? undefined,
            height: (data.height as number) ?? undefined,
            radius: (data.radius as number) ?? undefined,
            fill: (data.fill as string) ?? undefined,
            text: (data.text as string) ?? undefined,
            fontSize: (data.fontSize as number) ?? undefined,
            rotation: (data.rotation as number) ?? undefined,
            selectedBy: (data.selectedBy as any) ?? undefined,
          }
          upsertRef.current(shape)
        }
      })
      if (!ready) setReady(true)
    })
    return () => unsub()
  }, [roomId, ready])

  return { ...writers, ready }
}


