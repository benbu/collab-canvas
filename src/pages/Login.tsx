import { useState } from 'react'
import { FiUser, FiLock } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { loginWithPassword, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    ;(async () => {
      try {
        await loginWithPassword(username, password)
        const last = localStorage.getItem('lastRoomId') || 'default'
        navigate(`/room/${last}`)
      } catch (err: any) {
        alert(err?.message || 'Login failed')
      }
    })()
  }

  return (
    <div className="px-6 py-10 flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:bg-neutral-900 dark:border-neutral-800">
        <h1 className="text-3xl font-semibold leading-tight">Login</h1>
        <p className="mt-2 text-gray-500">Welcome back. Enter your details to continue.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium text-gray-900 dark:text-white">Username</label>
            <div className="mt-2 flex items-center gap-2">
              <FiUser aria-hidden className="text-gray-500" />
              <input
                id="login-username"
                aria-label="username"
                aria-describedby="username-help"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-400 focus:ring-0"
              />
            </div>
            <small id="username-help" className="mt-1 block text-sm text-gray-500">Use the username you signed up with.</small>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-900 dark:text-white">Password</label>
            <div className="mt-2 flex items-center gap-2">
              <FiLock aria-hidden className="text-gray-500" />
              <input
                id="login-password"
                aria-label="password"
                aria-describedby="password-help"
                placeholder="Your password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-gray-400 focus:ring-0"
              />
            </div>
            <small id="password-help" className="mt-1 block text-sm text-gray-500">At least 8 characters recommended.</small>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-white text-base hover:opacity-95"
          >
            Log in
          </button>
        </form>

        <button
          onClick={async () => {
            try {
              await loginWithGoogle()
              const last = localStorage.getItem('lastRoomId') || 'default'
              navigate(`/room/${last}`)
            } catch (err: any) {
              alert(err?.message || 'Google login failed')
            }
          }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-3 flex items-center justify-center gap-2 hover:bg-gray-50 dark:text-white dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
        >
          <FcGoogle aria-hidden />
          Continue with Google
        </button>

        <div className="mt-6 text-center">
          <Link to="/signup" className="text-gray-900 underline">Create an account</Link>
        </div>
      </div>
    </div>
  )
}


