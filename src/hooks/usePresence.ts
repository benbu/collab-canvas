import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb as database, isFirebaseEnabled } from '../services/firebase'
import { ref, onChildAdded, onChildChanged, onChildRemoved, serverTimestamp, update, onDisconnect } from 'firebase/database'

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
  const unsubRef = useRef<(() => void) | null>(null)

  // Subscribe to presence collection
  useEffect(() => {
    if (!isFirebaseEnabled || !database) return
    const listRef = ref(database!, `rooms/${roomId}/presence`)
    const next: Record<string, PresenceUser> = {}
    const unsubAdd = onChildAdded(listRef, (s) => {
      const d = s.val() as any
      next[s.key as string] = {
        id: s.key as string,
        name: d.name as string | undefined,
        color: d.color as string | undefined,
        lastSeenMs: typeof d.lastSeen === 'number' ? d.lastSeen : undefined,
        loggedIn: (d.loggedIn as boolean | undefined) ?? undefined,
      }
      setPresenceById({ ...next })
    })
    const unsubChange = onChildChanged(listRef, (s) => {
      const d = s.val() as any
      next[s.key as string] = {
        id: s.key as string,
        name: d.name as string | undefined,
        color: d.color as string | undefined,
        lastSeenMs: typeof d.lastSeen === 'number' ? d.lastSeen : undefined,
        loggedIn: (d.loggedIn as boolean | undefined) ?? undefined,
      }
      setPresenceById({ ...next })
    })
    const unsubRemove = onChildRemoved(listRef, (s) => {
      delete next[s.key as string]
      setPresenceById({ ...next })
    })
    unsubRef.current = () => { unsubAdd(); unsubChange(); unsubRemove() }
    return () => {
      unsubAdd(); unsubChange(); unsubRemove()
      unsubRef.current = null
    }
  }, [roomId])

  // Upsert self on mount and start heartbeat
  useEffect(() => {
    if (!isFirebaseEnabled || !database) return
    const selfRef = ref(database!, `rooms/${roomId}/presence/${selfId}`)

    const writeHeartbeat = async () => {
      await update(selfRef, { name: selfName, color: selfColor, loggedIn: true, lastSeen: serverTimestamp() } as any)
    }

    void writeHeartbeat()

    const id = window.setInterval(() => { void writeHeartbeat() }, 15000)
    intervalRef.current = id

    try { onDisconnect(selfRef).remove() } catch {}

    const onUnload = () => { /* onDisconnect handles cleanup */ }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      window.removeEventListener('beforeunload', onUnload)
      try { onDisconnect(selfRef).cancel() } catch {}
    }
  }, [roomId, selfId, selfName, selfColor])

  const visiblePresence = useMemo(() => {
    // Consumers may filter further; provide raw map and a convenience filtered map if needed later
    return presenceById
  }, [presenceById])

  return { presenceById: visiblePresence }
}


