import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { auth, isFirebaseEnabled } from '../services/firebase'
import { onAuthStateChanged, signInAnonymously, updateProfile, type User } from 'firebase/auth'

type AuthValue = {
  user: User | null
  displayName: string | null
  setDisplayName: (name: string) => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayNameState] = useState<string | null>(
    () => localStorage.getItem('displayName') || null,
  )

  useEffect(() => {
    if (!isFirebaseEnabled || !auth) return
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        await signInAnonymously(auth)
        return
      }
      setUser(u)
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
    }),
    [user, displayName],
  )

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider missing')
  return v
}


