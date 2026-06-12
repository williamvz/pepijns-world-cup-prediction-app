import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Vul je gebruikersnaam en wachtwoord in.')
      return
    }
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Inloggen mislukt. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-pitch-900 field-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative bouncing balls */}
      <div className="absolute top-10 left-8 text-5xl opacity-10 animate-bounce-ball" style={{ animationDelay: '0s' }}>⚽</div>
      <div className="absolute top-32 right-10 text-4xl opacity-10 animate-bounce-ball" style={{ animationDelay: '0.3s' }}>⚽</div>
      <div className="absolute bottom-24 left-16 text-6xl opacity-10 animate-bounce-ball" style={{ animationDelay: '0.6s' }}>⚽</div>
      <div className="absolute bottom-16 right-8 text-3xl opacity-10 animate-bounce-ball" style={{ animationDelay: '0.9s' }}>⚽</div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">⚽</div>
          <h1 className="text-3xl font-heading font-black text-white">WK Pool 2026</h1>
          <p className="text-white/50 text-sm mt-1">FIFA Wereldkampioenschap</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="text-xl font-heading font-bold text-white text-center mb-2">Inloggen</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-white/70 text-sm font-heading mb-1.5">Gebruikersnaam</label>
            <input
              type="text"
              className="input"
              placeholder="jouw gebruikersnaam"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm font-heading mb-1.5">Wachtwoord</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-gold-500 rounded"
            />
            <label htmlFor="remember" className="text-white/60 text-sm cursor-pointer select-none">
              Onthoud mij
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-bounce-ball text-lg">⚽</span>
            ) : (
              'Inloggen'
            )}
          </button>
        </form>

      </div>
    </div>
  )
}
