import { useEffect, useMemo, useRef, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

export type RemoteCursor = { id: string; x: number; y: number; color: string; name?: string; updatedAt: number }

function nowMs() { return Date.now() }

export function useCursorSync(
  roomId: string,
  selfId: string,
  getPointer: () => { x: number; y: number } | null,
  selfName?: string,
  selfColor?: string,
) {
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
  const lastWrite = useRef(0)

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const colRef = collection(db, 'rooms', roomId, 'cursors')
    const unsub = onSnapshot(colRef, (snap) => {
      const next = { ...cursors }
      snap.docChanges().forEach((c) => {
        if (c.type === 'removed') delete next[c.doc.id]
        else {
          const d = c.doc.data() as any
          next[c.doc.id] = {
            id: c.doc.id,
            x: d.x,
            y: d.y,
            color: d.color ?? '#888',
            name: d.name,
            updatedAt: d.updatedAt?.toMillis?.() ?? nowMs(),
          }
        }
      })
      setCursors(next)
    })
    return () => unsub()
  }, [roomId, setCursors])

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const onMove = () => {
      const p = getPointer()
      const t = nowMs()
      if (!p) return
      if (t - lastWrite.current < 80) return // ~12.5 fps
      lastWrite.current = t
      const database = db!
      const ref = doc(database, 'rooms', roomId, 'cursors', selfId)
      void setDoc(
        ref,
        { x: p.x, y: p.y, updatedAt: serverTimestamp(), name: selfName, color: selfColor },
        { merge: true },
      )
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [roomId, selfId, getPointer, selfName, selfColor])

  const visibleCursors = useMemo(() => {
    const cutoff = nowMs() - 2000
    const out: RemoteCursor[] = []
    for (const id in cursors) {
      if (id === selfId) continue
      const c = cursors[id]
      if (c.updatedAt >= cutoff) out.push(c)
    }
    return out
  }, [cursors, selfId])

  return { cursors: visibleCursors }
}


