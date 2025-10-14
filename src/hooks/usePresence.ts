import { useEffect, useMemo, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

export type Presence = { id: string; name?: string; color?: string; lastSeen: number }

export function isActive(lastSeen: number, now: number) {
  return now - lastSeen <= 10000
}

export function usePresence(roomId: string, selfId: string, name?: string, color?: string) {
  const [presenceById, setPresenceById] = useState<Record<string, Presence>>({})

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const colRef = collection(db, 'rooms', roomId, 'presence')
    const unsub = onSnapshot(colRef, (snap) => {
      const next = { ...presenceById }
      snap.docChanges().forEach((c) => {
        if (c.type === 'removed') delete next[c.doc.id]
        else {
          const d = c.doc.data() as any
          next[c.doc.id] = {
            id: c.doc.id,
            name: d.name,
            color: d.color,
            lastSeen: d.lastSeen?.toMillis?.() ?? Date.now(),
          }
        }
      })
      setPresenceById(next)
    })
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const ref = doc(db, 'rooms', roomId, 'presence', selfId)
    const writeBeat = () => setDoc(ref, { name: name ?? 'Anon', color: color ?? '#888', lastSeen: serverTimestamp() }, { merge: true })
    const timer = setInterval(writeBeat, 5000)
    // write immediately
    void writeBeat()
    const onUnload = () => {
      // best-effort cleanup
      void deleteDoc(ref)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', onUnload)
      void deleteDoc(ref)
    }
  }, [roomId, selfId, name, color])

  const active = useMemo(() => {
    const now = Date.now()
    return Object.values(presenceById).filter((p) => p.id !== selfId && isActive(p.lastSeen, now))
  }, [presenceById, selfId])

  return { presence: active }
}


