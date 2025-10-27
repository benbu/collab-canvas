import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb as database, isFirebaseEnabled } from '../services/firebase'
import { ref, onChildAdded, onChildChanged, onChildRemoved, serverTimestamp, update, onDisconnect } from 'firebase/database'
import type { Character } from './useCharacterState'
import { markStart, markEnd, incrementCounter } from '../utils/performance'
import { logger } from '../utils/logger'

export type RemoteCursor = { id: string; x: number; y: number; color: string; name?: string; updatedAt: number }

type PresenceData = {
  cursor?: { x: number; y: number }
  character?: Character
  color: string
  name?: string
  updatedAt: any
}

type RemotePresence = {
  id: string
  cursor?: { x: number; y: number }
  character?: Character
  color: string
  name?: string
  updatedAt: number
}

function nowMs() {
  return Date.now()
}

export function usePresenceSync(
  roomId: string,
  selfId: string,
  getPointer: () => { x: number; y: number } | null,
  localCharacter: Character | null,
  selfName?: string,
  selfColor?: string,
) {
  const [presence, setPresence] = useState<Record<string, RemotePresence>>({})
  const lastWrite = useRef(0)
  const lastWrittenCursor = useRef<{ x: number; y: number } | null>(null)
  const lastWrittenCharacter = useRef<{ x: number; y: number } | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const localCharacterRef = useRef<Character | null>(localCharacter)
  const selfNameRef = useRef(selfName)
  const selfColorRef = useRef(selfColor)
  const getPointerRef = useRef(getPointer)

  // Keep refs up to date
  useEffect(() => {
    getPointerRef.current = getPointer
  }, [getPointer])

  // Keep refs up to date
  useEffect(() => {
    localCharacterRef.current = localCharacter
  }, [localCharacter])

  useEffect(() => {
    selfNameRef.current = selfName
  }, [selfName])

  useEffect(() => {
    selfColorRef.current = selfColor
  }, [selfColor])

  // Subscribe to presence collection
  useEffect(() => {
    if (!isFirebaseEnabled || !database) {
      logger.debug('[PresenceSync] Firebase not enabled')
      return
    }

    logger.debug('[PresenceSync] Subscribing to presence in room:', roomId)
    const listRef = ref(database!, `rooms/${roomId}/presence`)
    const next: Record<string, RemotePresence> = {}
    const unsubAdd = onChildAdded(listRef, (s) => {
      const d = s.val() as any
      if (s.key === selfId) return
      next[s.key as string] = {
        id: s.key as string,
        cursor: d.cursor,
        character: d.character ? {
          userId: s.key as string,
          x: d.character.x ?? 0,
          y: d.character.y ?? 0,
          vx: d.character.vx ?? 0,
          vy: d.character.vy ?? 0,
          onGround: d.character.onGround ?? false,
          color: d.character.color ?? d.color ?? '#888',
          name: d.character.name ?? d.name,
          state: d.character.state ?? 'alive',
          deathTimer: d.character.deathTimer,
        } : undefined,
        color: d.color ?? '#888',
        name: d.name,
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : nowMs(),
      }
      setPresence({ ...next })
    })
    const unsubChange = onChildChanged(listRef, (s) => {
      const d = s.val() as any
      if (s.key === selfId) return
      next[s.key as string] = {
        id: s.key as string,
        cursor: d.cursor,
        character: d.character ? {
          userId: s.key as string,
          x: d.character.x ?? 0,
          y: d.character.y ?? 0,
          vx: d.character.vx ?? 0,
          vy: d.character.vy ?? 0,
          onGround: d.character.onGround ?? false,
          color: d.character.color ?? d.color ?? '#888',
          name: d.character.name ?? d.name,
          state: d.character.state ?? 'alive',
          deathTimer: d.character.deathTimer,
        } : undefined,
        color: d.color ?? '#888',
        name: d.name,
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : nowMs(),
      }
      setPresence({ ...next })
    })
    const unsubRemove = onChildRemoved(listRef, (s) => {
      delete next[s.key as string]
      setPresence({ ...next })
    })

    unsubRef.current = () => { unsubAdd(); unsubChange(); unsubRemove() }
    return () => {
      unsubAdd(); unsubChange(); unsubRemove()
      unsubRef.current = null
    }
  }, [roomId])

  // Sync local presence (cursor + character) to RTDB
  useEffect(() => {
    if (!isFirebaseEnabled || !database) return

    const presenceRef = ref(database!, `rooms/${roomId}/presence/${selfId}`)

    const writePresence = async () => {
      const t = nowMs()
      
      // Throttle to 50ms (~20 FPS)
      if (t - lastWrite.current < 50) {
        incrementCounter('presence-sync', 'write-throttled')
        return
      }

      const cursor = getPointerRef.current()
      
      // Check if anything has changed
      let hasChanges = false
      
      // Check cursor movement
      if (cursor) {
        const cursorThreshold = 0.1
        if (!lastWrittenCursor.current || 
            Math.abs(cursor.x - lastWrittenCursor.current.x) > cursorThreshold ||
            Math.abs(cursor.y - lastWrittenCursor.current.y) > cursorThreshold) {
          hasChanges = true
        }
      }
      
      const currentCharacter = localCharacterRef.current
      
      // Check character movement
      if (currentCharacter && currentCharacter.state !== 'dead') {
        const positionThreshold = 0.1
        if (!lastWrittenCharacter.current ||
            Math.abs(currentCharacter.x - lastWrittenCharacter.current.x) > positionThreshold ||
            Math.abs(currentCharacter.y - lastWrittenCharacter.current.y) > positionThreshold) {
          hasChanges = true
        }
      }
      
      // If nothing changed, skip write
      if (!hasChanges) {
        incrementCounter('presence-sync', 'write-skipped-idle')
        return
      }

      lastWrite.current = t

      const marker = markStart('presence-sync-write')
      
      // Build presence data
      const data: PresenceData = {
        color: selfColorRef.current ?? '#888',
        updatedAt: serverTimestamp(),
      }
      
      if (selfNameRef.current) {
        data.name = selfNameRef.current
      }
      
      if (cursor) {
        data.cursor = { x: cursor.x, y: cursor.y }
        lastWrittenCursor.current = { x: cursor.x, y: cursor.y }
      }
      
      if (currentCharacter && currentCharacter.state !== 'dead') {
        data.character = {
          userId: currentCharacter.userId,
          x: currentCharacter.x,
          y: currentCharacter.y,
          vx: currentCharacter.vx,
          vy: currentCharacter.vy,
          onGround: currentCharacter.onGround,
          color: currentCharacter.color,
          state: currentCharacter.state,
        }
        
        // Only include optional fields if they're defined (Firebase doesn't accept undefined)
        if (currentCharacter.name !== undefined) {
          data.character.name = currentCharacter.name
        }
        if (currentCharacter.deathTimer !== undefined) {
          data.character.deathTimer = currentCharacter.deathTimer
        }
        
        lastWrittenCharacter.current = { x: currentCharacter.x, y: currentCharacter.y }
      }

      await update(presenceRef, data as any)
      
      markEnd(marker, 'presence-sync', 'write')
    }

    // Setup mousemove listener for cursor tracking
    const onMove = () => {
      void writePresence()
    }
    window.addEventListener('mousemove', onMove)

    // Write immediately
    void writePresence()

    // Setup interval for periodic updates (for character movement)
    const intervalId = window.setInterval(() => {
      void writePresence()
    }, 50) // ~20 FPS

    // Cleanup on unmount
    const onUnload = () => { /* rely on onDisconnect */ }
    window.addEventListener('beforeunload', onUnload)
    try { onDisconnect(presenceRef).remove() } catch {}

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('beforeunload', onUnload)
      try { onDisconnect(presenceRef).cancel() } catch {}
    }
  }, [roomId, selfId]) // Using refs for all frequently-changing props to avoid effect churn

  // Extract cursors from presence
  const visibleCursors = useMemo(() => {
    const cutoff = nowMs() - 2000
    const out: RemoteCursor[] = []
    for (const id in presence) {
      if (id === selfId) continue
      const p = presence[id]
      if (p.updatedAt >= cutoff && p.cursor) {
        out.push({
          id,
          x: p.cursor.x,
          y: p.cursor.y,
          color: p.color,
          name: p.name,
          updatedAt: p.updatedAt,
        })
      }
    }
    return out
  }, [presence, selfId])

  // Extract characters from presence
  const visibleCharacters = useMemo(() => {
    const out: Character[] = []
    for (const id in presence) {
      if (id === selfId) continue
      const p = presence[id]
      if (p.character) {
        logger.debug('[PresenceSync] Adding remote character:', id)
        out.push(p.character)
      }
    }
    logger.debug('[PresenceSync] visibleCharacters:', out)
    return out
  }, [presence, selfId])

  return {
    cursors: visibleCursors,
    characters: visibleCharacters,
    allPresence: presence,
  }
}

