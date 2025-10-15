import { db, isFirebaseEnabled } from './firebase'
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'

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
  if (!isFirebaseEnabled || !db) return true
  const ref = doc(db!, 'usernames', lc)
  const snap = await getDoc(ref)
  return !snap.exists()
}

export async function claimUsername(params: { uid: string; username: string }): Promise<{ ok: boolean; code?: string }> {
  const { uid } = params
  const raw = params.username
  const lc = normalizeUsername(raw)
  if (!lc || !uid) return { ok: false, code: 'invalid' }
  if (!isFirebaseEnabled || !db) return { ok: true }

  try {
    await runTransaction(db!, async (tx) => {
      const usernameRef = doc(db!, 'usernames', lc)
      const profileRef = doc(db!, 'userProfiles', uid)

      const existing = await tx.get(usernameRef)
      if (existing.exists() && (existing.data() as any)?.uid !== uid) {
        throw new Error('unavailable')
      }

      tx.set(usernameRef, { uid, createdAt: serverTimestamp() })
      tx.set(
        profileRef,
        { username: raw, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
        { merge: true },
      )
    })
    return { ok: true }
  } catch (e: any) {
    if (e?.message === 'unavailable') return { ok: false, code: 'unavailable' }
    return { ok: false, code: 'unknown' }
  }
}


