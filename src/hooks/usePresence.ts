import { useEffect, useMemo, useRef, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc, type Unsubscribe } from 'firebase/firestore'

export type PresenceUser = {
  id: string
  name?: string
  color?: string
  lastSeenMs?: number
  loggedIn?: boolean
}

export function usePresence(
  roomId: string,
  selfId: string,
  selfName?: string,
  selfColor?: string,
) {
  const [presenceById, setPresenceById] = useState<Record<string, PresenceUser>>({})
  const intervalRef = useRef<number | null>(null)
  const unsubRef = useRef<Unsubscribe | null>(null)

  // Subscribe to presence collection
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const colRef = collection(db, 'rooms', roomId, 'presence')
    const unsub = onSnapshot(colRef, (snap) => {
      const next: Record<string, PresenceUser> = {}
      snap.forEach((docSnap) => {
        const d = docSnap.data() as any
        next[docSnap.id] = {
          id: docSnap.id,
          name: d.name as string | undefined,
          color: d.color as string | undefined,
          lastSeenMs: (d.lastSeen && typeof d.lastSeen.toMillis === 'function') ? d.lastSeen.toMillis() : undefined,
          loggedIn: (d.loggedIn as boolean | undefined) ?? undefined,
        }
      })
      setPresenceById(next)
    })
    unsubRef.current = unsub
    return () => {
      unsub()
      unsubRef.current = null
    }
  }, [roomId])

  // Upsert self on mount and start heartbeat
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    const database = db!
    const selfRef = doc(database, 'rooms', roomId, 'presence', selfId)

    const writeHeartbeat = async () => {
      await setDoc(
        selfRef,
        { name: selfName, color: selfColor, loggedIn: true, lastSeen: serverTimestamp() },
        { merge: true },
      )
    }

    void writeHeartbeat()

    const id = window.setInterval(() => { void writeHeartbeat() }, 15000)
    intervalRef.current = id

    const onUnload = () => {
      // Best-effort delete of presence on disconnect
      void deleteDoc(selfRef)
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      window.removeEventListener('beforeunload', onUnload)
      void deleteDoc(selfRef)
    }
  }, [roomId, selfId, selfName, selfColor])

  const visiblePresence = useMemo(() => {
    // Consumers may filter further; provide raw map and a convenience filtered map if needed later
    return presenceById
  }, [presenceById])

  return { presenceById: visiblePresence }
}


