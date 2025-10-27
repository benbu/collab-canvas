import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb as database, isFirebaseEnabled } from '../services/firebase'
import { ref, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, serverTimestamp, update } from 'firebase/database'

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
    if (!isFirebaseEnabled || !database) return
    const listRef = ref(database!, `rooms/${roomId}/cursors`)
    const next = { ...cursors }
    const unsubAdd = onChildAdded(listRef, (s) => {
      const d = s.val() as any
      next[s.key as string] = {
        id: s.key as string,
        x: d.x,
        y: d.y,
        color: d.color ?? '#888',
        name: d.name,
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : nowMs(),
      }
      setCursors({ ...next })
    })
    const unsubChange = onChildChanged(listRef, (s) => {
      const d = s.val() as any
      next[s.key as string] = {
        id: s.key as string,
        x: d.x,
        y: d.y,
        color: d.color ?? '#888',
        name: d.name,
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : nowMs(),
      }
      setCursors({ ...next })
    })
    const unsubRemove = onChildRemoved(listRef, (s) => {
      delete next[s.key as string]
      setCursors({ ...next })
    })
    return () => { unsubAdd(); unsubChange(); unsubRemove() }
  }, [roomId, setCursors])

  useEffect(() => {
    if (!isFirebaseEnabled || !database) return
    const onMove = () => {
      const p = getPointer()
      const t = nowMs()
      if (!p) return
      if (t - lastWrite.current < 80) return // ~12.5 fps
      lastWrite.current = t
      const selfRef = ref(database!, `rooms/${roomId}/cursors/${selfId}`)
      void update(selfRef, { x: p.x, y: p.y, updatedAt: serverTimestamp(), name: selfName, color: selfColor })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [roomId, selfId, getPointer, selfName, selfColor])

  // Ensure ephemeral cursor is removed on disconnect
  useEffect(() => {
    if (!isFirebaseEnabled || !database) return
    const selfRef = ref(database!, `rooms/${roomId}/cursors/${selfId}`)
    try { onDisconnect(selfRef).remove() } catch {}
  }, [roomId, selfId])

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

  return { cursors: visibleCursors, allCursors: cursors }
}


