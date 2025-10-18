import { useEffect, useMemo, useRef, useState } from 'react'
import { db, isFirebaseEnabled } from '../services/firebase'
import { collection, doc, onSnapshot, serverTimestamp, setDoc, deleteDoc, type Unsubscribe } from 'firebase/firestore'
import type { Character } from './useCharacterState'

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
  const unsubRef = useRef<Unsubscribe | null>(null)

  // Subscribe to characters collection
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return

    const colRef = collection(db, 'rooms', roomId, 'characters')
    const unsub = onSnapshot(colRef, (snap) => {
      const next: Record<string, Character> = {}
      snap.forEach((docSnap) => {
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
      setCharacters(next)
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
      if (t - lastWrite.current < 33) return // ~30 FPS
      lastWrite.current = t

      await setDoc(
        charRef,
        {
          x: localCharacter.x,
          y: localCharacter.y,
          vx: localCharacter.vx,
          vy: localCharacter.vy,
          onGround: localCharacter.onGround,
          color: localCharacter.color,
          name: localCharacter.name,
          state: localCharacter.state,
          deathTimer: localCharacter.deathTimer,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }

    // Write immediately
    void writeCharacter()

    // Setup interval for periodic updates
    const intervalId = window.setInterval(() => {
      void writeCharacter()
    }, 33) // ~30 FPS

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
      if (id === selfId) continue
      out.push(characters[id])
    }
    return out
  }, [characters, selfId])

  return { characters: visibleCharacters }
}

