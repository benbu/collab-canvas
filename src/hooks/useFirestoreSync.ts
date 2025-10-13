import { useEffect, useMemo, useRef } from 'react'
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

export function useFirestoreSync(roomId: string, onRemoteUpsert: (s: Shape) => void, onRemoteRemove: (id: string) => void): Writer {
  const pendingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const writers = useMemo<Writer>(() => ({
    add: async (shape: Shape) => {
      if (!isFirebaseEnabled || !db) return
      const ref = doc(db, 'rooms', roomId, 'shapes', shape.id)
      await setDoc(
        ref,
        {
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
        },
        { merge: true },
      )
    },
    update: async (shape: Shape) => {
      if (!isFirebaseEnabled || !db) return
      // debounce per-shape to ~30ms
      const key = shape.id
      if (pendingTimers.current[key]) {
        clearTimeout(pendingTimers.current[key])
      }
      await new Promise<void>((resolve) => {
        pendingTimers.current[key] = setTimeout(async () => {
          const ref = doc(db, 'rooms', roomId, 'shapes', shape.id)
          await setDoc(
            ref,
            {
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
            },
            { merge: true },
          )
          resolve()
        }, 30)
      })
    },
    remove: async (id: string) => {
      if (!isFirebaseEnabled || !db) return
      const ref = doc(db, 'rooms', roomId, 'shapes', id)
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
          onRemoteRemove(change.doc.id)
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
          }
          onRemoteUpsert(shape)
        }
      })
    })
    return () => unsub()
  }, [roomId, onRemoteUpsert, onRemoteRemove])

  return writers
}


