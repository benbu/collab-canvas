import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function UsernameClaim() {
  const { needsUsernameClaim, claimUsernameForCurrentUser } = useAuth()
  const [username, setUsername] = useState('')
  if (!needsUsernameClaim) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, minWidth: 320 }}>
        <h2>Choose a username</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input aria-label="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button
            onClick={async () => {
              try {
                await claimUsernameForCurrentUser(username)
              } catch (err: any) {
                alert(err?.message || 'Unable to claim username')
              }
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}


