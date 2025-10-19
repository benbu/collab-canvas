import { useEffect, useMemo, useRef, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc, type Unsubscribe } from 'firebase/firestore'
import type { Character } from './useCharacterState'
import { markStart, markEnd, incrementCounter } from '../utils/performance'

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
  const unsubRef = useRef<Unsubscribe | null>(null)
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
    if (!isFirebaseEnabled || !db) {
      console.log('[PresenceSync] Firebase not enabled')
      return
    }

    console.log('[PresenceSync] Subscribing to presence in room:', roomId)
    const colRef = collection(db, 'rooms', roomId, 'presence')
    const unsub = onSnapshot(colRef, (snap) => {
      markStart('presence-sync-snapshot')
      console.log('[PresenceSync] Received snapshot, size:', snap.size)
      const next: Record<string, RemotePresence> = {}
      snap.forEach((docSnap) => {
        // Skip own presence to avoid flickering from Firestore echoing our writes
        if (docSnap.id === selfId) {
          console.log('[PresenceSync] Skipping own presence:', docSnap.id)
          return
        }
        
        const d = docSnap.data() as any
        next[docSnap.id] = {
          id: docSnap.id,
          cursor: d.cursor,
          character: d.character ? {
            userId: docSnap.id,
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
          updatedAt: d.updatedAt?.toMillis?.() ?? nowMs(),
        }
      })
      console.log('[PresenceSync] Setting presence (excluding self):', next)
      setPresence(next)
      markEnd('presence-sync-snapshot', 'presence-sync', `read-${snap.size}-presence`)
    })

    unsubRef.current = unsub
    return () => {
      unsub()
      unsubRef.current = null
    }
  }, [roomId])

  // Sync local presence (cursor + character) to Firestore
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return

    const database = db!
    const presenceRef = doc(database, 'rooms', roomId, 'presence', selfId)

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

      markStart('presence-sync-write')
      
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

      await setDoc(presenceRef, data, { merge: true })
      
      markEnd('presence-sync-write', 'presence-sync', 'write')
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
    const onUnload = () => {
      void deleteDoc(presenceRef)
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('beforeunload', onUnload)
      void deleteDoc(presenceRef)
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
        console.log('[PresenceSync] Adding remote character:', id)
        out.push(p.character)
      }
    }
    console.log('[PresenceSync] visibleCharacters:', out)
    return out
  }, [presence, selfId])

  return {
    cursors: visibleCursors,
    characters: visibleCharacters,
    allPresence: presence,
  }
}

