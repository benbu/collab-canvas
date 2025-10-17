import { useState } from 'react'
import { FiUser, FiLock } from 'react-icons/fi'
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
    <div className="px-6 py-10 flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:bg-neutral-900 dark:border-neutral-800">
        <h1 className="text-3xl font-semibold leading-tight">Sign up</h1>
        <p className="mt-2 text-gray-500">Get started by choosing a username and password.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <div>
            <label htmlFor="signup-username" className="block text-sm font-medium text-gray-900 dark:text-white">Username</label>
            <div className="mt-2 flex items-center gap-2">
              <FiUser aria-hidden className="text-gray-500" />
              <input
                id="signup-username"
                aria-label="username"
                aria-describedby="signup-username-help"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-400 focus:ring-0"
              />
            </div>
            <small id="signup-username-help" className="mt-1 block text-sm text-gray-500">3–20 characters, letters and numbers only.</small>
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-gray-900 dark:text-white">Password</label>
            <div className="mt-2 flex items-center gap-2">
              <FiLock aria-hidden className="text-gray-500" />
              <input
                id="signup-password"
                aria-label="password"
                aria-describedby="signup-password-help"
                placeholder="Create a password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-400 focus:ring-0"
              />
            </div>
            <small id="signup-password-help" className="mt-1 block text-sm text-gray-500">Use at least 8 characters, with a mix of letters and numbers.</small>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-white text-base hover:opacity-95"
          >
            Create account
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-gray-900 underline">Back to login</Link>
        </div>
      </div>
    </div>
  )
}


