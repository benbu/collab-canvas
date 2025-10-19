import { useEffect, useMemo, useRef, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc, type Unsubscribe } from 'firebase/firestore'
import type { Character } from './useCharacterState'
import { markStart, markEnd, incrementCounter } from '../utils/performance'

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
  const unsubRef = useRef<Unsubscribe | null>(null)

  // Subscribe to characters collection
  useEffect(() => {
    if (!isFirebaseEnabled || !db) {
      console.log('[CharacterSync] Firebase not enabled')
      return
    }

    console.log('[CharacterSync] Subscribing to characters in room:', roomId)
    const colRef = collection(db, 'rooms', roomId, 'characters')
    const unsub = onSnapshot(colRef, (snap) => {
      markStart('char-sync-snapshot')
      console.log('[CharacterSync] Received snapshot, size:', snap.size)
      const next: Record<string, Character> = {}
      snap.forEach((docSnap) => {
        console.log('[CharacterSync] Character doc:', docSnap.id, docSnap.data())
        const d = docSnap.data() as any
        next[docSnap.id] = {
          userId: docSnap.id,
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
      })
      console.log('[CharacterSync] Setting characters:', next)
      setCharacters(next)
      markEnd('char-sync-snapshot', 'character-sync', `read-${snap.size}-characters`)
    })

    unsubRef.current = unsub
    return () => {
      unsub()
      unsubRef.current = null
    }
  }, [roomId])

  // Sync local character to Firestore
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return
    if (!localCharacter) {
      // Delete character document if no local character
      const database = db!
      const charRef = doc(database, 'rooms', roomId, 'characters', selfId)
      void deleteDoc(charRef)
      return
    }

    // Don't sync dead characters
    if (localCharacter.state === 'dead') {
      const database = db!
      const charRef = doc(database, 'rooms', roomId, 'characters', selfId)
      void deleteDoc(charRef)
      return
    }

    const database = db!
    const charRef = doc(database, 'rooms', roomId, 'characters', selfId)

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

      markStart('char-sync-write')
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

      await setDoc(charRef, data, { merge: true })
      
      // Update last written position
      lastWrittenPosition.current = { x: localCharacter.x, y: localCharacter.y }
      
      markEnd('char-sync-write', 'character-sync', 'write')
    }

    // Write immediately
    void writeCharacter()

    // Setup interval for periodic updates
    const intervalId = window.setInterval(() => {
      void writeCharacter()
    }, 50) // ~20 FPS (reduced for better network performance)

    // Cleanup on unmount
    const onUnload = () => {
      void deleteDoc(charRef)
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('beforeunload', onUnload)
      void deleteDoc(charRef)
    }
  }, [roomId, selfId, localCharacter])

  const visibleCharacters = useMemo(() => {
    // Return all characters except self (we render local character separately)
    const out: Character[] = []
    for (const id in characters) {
      if (id === selfId) {
        console.log('[CharacterSync] Skipping self character:', id)
        continue
      }
      console.log('[CharacterSync] Adding remote character:', id)
      out.push(characters[id])
    }
    console.log('[CharacterSync] visibleCharacters:', out)
    return out
  }, [characters, selfId])

  return { characters: visibleCharacters }
}

