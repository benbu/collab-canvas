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
import { markStart, markEnd, incrementCounter } from '../utils/performance'

type Writer = {
  add: (shape: Shape) => Promise<void>
  update: (shape: Shape) => Promise<void>
  updateImmediate: (shape: Shape) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useFirestoreSync(
  roomId: string,
  onRemoteUpsert: (s: Shape) => void,
  onRemoteRemove: (id: string) => void,
): Writer & { ready: boolean } {
  // Per-shape throttle state to smooth live updates similar to cursor sync (~12.5 fps)
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
        markStart(`fs-add-${shape.id}`)
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
        await setDoc(ref, payload, { merge: true })
        markEnd(`fs-add-${shape.id}`, 'firestore-write', 'add')
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

      if (remaining > 0) {
        incrementCounter('firestore-throttled', 'update')
        return
      }

      markStart(`fs-update-${shape.id}`)
      const ref = doc(database, 'rooms', roomId, 'shapes', shape.id)
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
      // Only include selectedBy if explicitly provided; otherwise preserve existing
      if (shape.selectedBy !== undefined) payload.selectedBy = shape.selectedBy
      await setDoc(ref, payload, { merge: true })
      lastWriteMs.current[key] = Date.now()
      markEnd(`fs-update-${shape.id}`, 'firestore-write', 'update')
    },
    updateImmediate: async (shape: Shape) => {
      if (!isFirebaseEnabled || !db) return
      const database = db!
      markStart(`fs-update-imm-${shape.id}`)
      const ref = doc(database, 'rooms', roomId, 'shapes', shape.id)
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
      await setDoc(ref, payload, { merge: true })
      // Update throttle marker so immediate write doesn't cause an immediate trailing throttled write
      lastWriteMs.current[shape.id] = Date.now()
      markEnd(`fs-update-imm-${shape.id}`, 'firestore-write', 'updateImmediate')
    },
    remove: async (id: string) => {
      if (!isFirebaseEnabled || !db) return
      const database = db!
      markStart(`fs-remove-${id}`)
      const ref = doc(database, 'rooms', roomId, 'shapes', id)
      await deleteDoc(ref)
      markEnd(`fs-remove-${id}`, 'firestore-write', 'remove')
    },
  }), [roomId])

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const colRef = collection(db, 'rooms', roomId, 'shapes')
    const unsub: Unsubscribe = onSnapshot(colRef, (snap) => {
      markStart('fs-snapshot')
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
            fontFamily: (data.fontFamily as string) ?? undefined,
            rotation: (data.rotation as number) ?? undefined,
            zIndex: (data.zIndex as number) ?? undefined,
            selectedBy: (data.selectedBy as any) ?? undefined,
          }
          upsertRef.current(shape)
        }
      })
      markEnd('fs-snapshot', 'firestore-read', `snapshot-${snap.docChanges().length}-changes`)
      if (!ready) setReady(true)
    })
    return () => unsub()
  }, [roomId, ready])

  return { ...writers, ready }
}


