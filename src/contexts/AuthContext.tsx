import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { auth, db, isFirebaseEnabled } from '../services/firebase'
import { onAuthStateChanged, updateProfile, type User, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { claimUsername, normalizeUsername } from '../services/usernames'

type AuthValue = {
  user: User | null
  displayName: string | null
  setDisplayName: (name: string) => Promise<void>
  loginWithPassword: (username: string, password: string) => Promise<void>
  signup: (username: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  needsUsernameClaim: boolean
  claimUsernameForCurrentUser: (username: string) => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayNameState] = useState<string | null>(
    () => localStorage.getItem('displayName') || null,
  )
  const [needsUsernameClaim, setNeedsUsernameClaim] = useState(false)

  useEffect(() => {
    if (!isFirebaseEnabled || !auth) return
    const a = auth
    const unsub = onAuthStateChanged(a, async (u) => {
      setUser(u)
      if (u && db) {
        try {
          const isGoogle = Array.isArray(u.providerData) && u.providerData.some((p) => p.providerId === 'google.com')
          const profileRef = doc(db, 'userProfiles', u.uid)
          const snap = await getDoc(profileRef)
          const existingUsername = (snap.exists() ? (snap.data() as any)?.username : null) as string | null
          if (existingUsername) {
            setDisplayNameState(existingUsername)
            localStorage.setItem('displayName', existingUsername)
            setNeedsUsernameClaim(false)
          } else if (isGoogle) {
            setNeedsUsernameClaim(true)
          } else {
            const localPart = (u.email || '').split('@')[0]
            const derived = localPart || (u.displayName ?? '') || 'user'
            const res = await claimUsername({ uid: u.uid, username: derived })
            if (res.ok) {
              setDisplayNameState(derived)
              localStorage.setItem('displayName', derived)
              try { await updateProfile(u, { displayName: derived }) } catch {}
            } else {
              setDisplayNameState(derived)
              localStorage.setItem('displayName', derived)
            }
            setNeedsUsernameClaim(false)
          }
        } catch {}
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (displayName) localStorage.setItem('displayName', displayName)
  }, [displayName])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      displayName,
      setDisplayName: async (name: string) => {
        setDisplayNameState(name)
        if (user && isFirebaseEnabled) {
          try {
            await updateProfile(user, { displayName: name })
          } catch {}
        }
      },
      loginWithPassword: async (username: string, password: string) => {
        if (!isFirebaseEnabled || !auth) return
        const email = `${normalizeUsername(username)}@users.local`
        await signInWithEmailAndPassword(auth, email, password)
      },
      signup: async (username: string, password: string) => {
        if (!isFirebaseEnabled || !auth) return
        const lc = normalizeUsername(username)
        const email = `${lc}@users.local`
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        const res = await claimUsername({ uid: cred.user.uid, username })
        if (!res.ok) throw new Error(res.code || 'claim_failed')
        setDisplayNameState(username)
        localStorage.setItem('displayName', username)
        try { await updateProfile(cred.user, { displayName: username }) } catch {}
      },
      loginWithGoogle: async () => {
        if (!isFirebaseEnabled || !auth) return
        const provider = new GoogleAuthProvider()
        await signInWithPopup(auth, provider)
      },
      logout: async () => {
        if (!isFirebaseEnabled || !auth) return
        await signOut(auth)
        setDisplayNameState(null)
        localStorage.removeItem('displayName')
      },
      needsUsernameClaim,
      claimUsernameForCurrentUser: async (username: string) => {
        if (!user || !isFirebaseEnabled) return
        const res = await claimUsername({ uid: user.uid, username })
        if (!res.ok) throw new Error(res.code || 'claim_failed')
        setDisplayNameState(username)
        localStorage.setItem('displayName', username)
        try { await updateProfile(user, { displayName: username }) } catch {}
        setNeedsUsernameClaim(false)
      },
    }),
    [user, displayName, needsUsernameClaim],
  )

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider missing')
  return v
}


