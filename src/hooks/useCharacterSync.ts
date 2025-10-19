import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb as database, isFirebaseEnabled } from '../services/firebase'
import { ref, onChildAdded, onChildChanged, onChildRemoved, serverTimestamp, update, onDisconnect, remove as rtdbRemove } from 'firebase/database'
import type { Character } from './useCharacterState'
import { markStart, markEnd, incrementCounter } from '../utils/performance'
import { logger } from '../utils/logger'

function nowMs() {
  return Date.now()
}

export function useCharacterSync(
  roomId: string,
  selfId: string,
  localCharacter: Character | null,
) {
  const [characters, setCharacters] = useState<Record<string, Character>>({})
  const lastWrite = useRef(0)
  const lastWrittenPosition = useRef<{ x: number; y: number } | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  // Subscribe to characters collection
  useEffect(() => {
    if (!isFirebaseEnabled || !database) {
      logger.debug('[CharacterSync] Firebase not enabled')
      return
    }

    logger.debug('[CharacterSync] Subscribing to characters in room:', roomId)
    const listRef = ref(database!, `rooms/${roomId}/characters`)
    const next: Record<string, Character> = {}
    const unsubAdd = onChildAdded(listRef, (s) => {
      const d = s.val() as any
      next[s.key as string] = {
        userId: s.key as string,
        x: d.x ?? 0,
        y: d.y ?? 0,
        vx: d.vx ?? 0,
        vy: d.vy ?? 0,
        onGround: d.onGround ?? false,
        color: d.color ?? '#888',
        name: d.name,
        state: d.state ?? 'alive',
        deathTimer: d.deathTimer,
      }
      setCharacters({ ...next })
    })
    const unsubChange = onChildChanged(listRef, (s) => {
      const d = s.val() as any
      next[s.key as string] = {
        userId: s.key as string,
        x: d.x ?? 0,
        y: d.y ?? 0,
        vx: d.vx ?? 0,
        vy: d.vy ?? 0,
        onGround: d.onGround ?? false,
        color: d.color ?? '#888',
        name: d.name,
        state: d.state ?? 'alive',
        deathTimer: d.deathTimer,
      }
      setCharacters({ ...next })
    })
    const unsubRemove = onChildRemoved(listRef, (s) => {
      delete next[s.key as string]
      setCharacters({ ...next })
    })

    unsubRef.current = () => { unsubAdd(); unsubChange(); unsubRemove() }
    return () => {
      unsubAdd(); unsubChange(); unsubRemove()
      unsubRef.current = null
    }
  }, [roomId])

  // Sync local character to RTDB
  useEffect(() => {
    if (!isFirebaseEnabled || !database) return
    if (!localCharacter) {
      // Delete character document if no local character
      const charRef = ref(database!, `rooms/${roomId}/characters/${selfId}`)
      void rtdbRemove(charRef)
      return
    }

    // Don't sync dead characters
    if (localCharacter.state === 'dead') {
      const charRef = ref(database!, `rooms/${roomId}/characters/${selfId}`)
      void rtdbRemove(charRef)
      return
    }

    const charRef = ref(database!, `rooms/${roomId}/characters/${selfId}`)

    const writeCharacter = async () => {
      const t = nowMs()
      if (t - lastWrite.current < 50) {
        incrementCounter('character-sync', 'write-throttled')
        return // ~20 FPS (reduced from 30 FPS for better network performance)
      }

      // Check if character has moved since last write (with small threshold for floating point)
      const positionThreshold = 0.1 // pixels
      if (lastWrittenPosition.current) {
        const dx = Math.abs(localCharacter.x - lastWrittenPosition.current.x)
        const dy = Math.abs(localCharacter.y - lastWrittenPosition.current.y)
        
        if (dx < positionThreshold && dy < positionThreshold) {
          // Character hasn't moved, skip write
          incrementCounter('character-sync', 'write-skipped-idle')
          return
        }
      }

      lastWrite.current = t

      const marker = markStart('char-sync-write')
      // Remove undefined values for Firebase (Firebase doesn't accept undefined)
      const data: any = {
        x: localCharacter.x,
        y: localCharacter.y,
        vx: localCharacter.vx,
        vy: localCharacter.vy,
        onGround: localCharacter.onGround,
        color: localCharacter.color,
        state: localCharacter.state,
        updatedAt: serverTimestamp(),
      }

      // Only include optional fields if they're defined
      if (localCharacter.name !== undefined) {
        data.name = localCharacter.name
      }
      if (localCharacter.deathTimer !== undefined) {
        data.deathTimer = localCharacter.deathTimer
      }

      await update(charRef, data)
      
      // Update last written position
      lastWrittenPosition.current = { x: localCharacter.x, y: localCharacter.y }
      
      markEnd(marker, 'character-sync', 'write')
    }

    // Write immediately
    void writeCharacter()

    // Setup interval for periodic updates
    const intervalId = window.setInterval(() => {
      void writeCharacter()
    }, 50) // ~20 FPS (reduced for better network performance)

    // Cleanup on unmount
    const onUnload = () => { /* rely on onDisconnect */ }
    window.addEventListener('beforeunload', onUnload)
    try { onDisconnect(charRef).remove() } catch {}

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('beforeunload', onUnload)
      try { onDisconnect(charRef).cancel() } catch {}
    }
  }, [roomId, selfId, localCharacter])

  const visibleCharacters = useMemo(() => {
    // Return all characters except self (we render local character separately)
    const out: Character[] = []
    for (const id in characters) {
      if (id === selfId) {
        logger.debug('[CharacterSync] Skipping self character:', id)
        continue
      }
      logger.debug('[CharacterSync] Adding remote character:', id)
      out.push(characters[id])
    }
    logger.debug('[CharacterSync] visibleCharacters:', out)
    return out
  }, [characters, selfId])

  return { characters: visibleCharacters }
}

