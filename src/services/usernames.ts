import { rtdb as database, isFirebaseEnabled } from './firebase'
import { ref, get, runTransaction, serverTimestamp } from 'firebase/database'

export type UserProfile = {
  username: string
  createdAt?: unknown
  updatedAt?: unknown
}

export type UsernameDoc = {
  uid: string
  createdAt?: unknown
}

export function normalizeUsername(username: string): string {
  return (username || '').trim().toLowerCase()
}

/**
 * Checks if a username is available (case-insensitive) using Firestore mapping `usernames/{lcUsername}`.
 * In environments without Firebase configured, returns true.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const lc = normalizeUsername(username)
  if (!lc) return false
  if (!isFirebaseEnabled || !database) return true
  const usernameRef = ref(database!, `usernames/${lc}`)
  const snap = await get(usernameRef)
  return !snap.exists()
}

export async function claimUsername(params: { uid: string; username: string }): Promise<{ ok: boolean; code?: string }> {
  const { uid } = params
  const raw = params.username
  const lc = normalizeUsername(raw)
  if (!lc || !uid) return { ok: false, code: 'invalid' }
  if (!isFirebaseEnabled || !database) return { ok: true }

  try {
    // Atomic claim: create username if absent, otherwise abort (unavailable)
    const usernameRef = ref(database!, `usernames/${lc}`)
    const result = await runTransaction(usernameRef, (current) => {
      if (current && current.uid && current.uid !== uid) {
        return; // abort by returning undefined
      }
      return { uid, createdAt: serverTimestamp() }
    })
    if (!result.committed) return { ok: false, code: 'unavailable' }
    const profileRef = ref(database!, `userProfiles/${uid}`)
    await runTransaction(profileRef, (current) => ({
      ...(current || {}),
      username: raw,
      updatedAt: serverTimestamp(),
      createdAt: (current && (current as any).createdAt) ? (current as any).createdAt : serverTimestamp(),
    }))
    return { ok: true }
  } catch (e: any) {
    if (e?.message === 'unavailable') return { ok: false, code: 'unavailable' }
    return { ok: false, code: 'unknown' }
  }
}


