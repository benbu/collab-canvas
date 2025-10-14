import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, displayName, setDisplayName } = useAuth()
  const [name, setName] = useState(displayName ?? '')
  const navigate = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await setDisplayName(name.trim() || 'Anon')
    navigate('/room/default')
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" />
        <button type="submit">Continue</button>
      </form>
    </div>
  )
}


