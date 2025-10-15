import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { signup } = useAuth()
  const navigate = useNavigate()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    ;(async () => {
      try {
        await signup(username, password)
        const last = localStorage.getItem('lastRoomId') || 'default'
        navigate(`/room/${last}`)
      } catch (err: any) {
        alert(err?.message || 'Sign up failed')
      }
    })()
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          aria-label="username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          aria-label="password"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Create Account</button>
      </form>
      <div style={{ marginTop: 12 }}>
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  )
}


