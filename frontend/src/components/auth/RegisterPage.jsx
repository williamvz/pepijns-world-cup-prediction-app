import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AVATARS } from '../common/Avatar'

const WK_COUNTRIES = [
  'Nederland', 'Duitsland', 'Frankrijk', 'Spanje', 'Portugal', 'Argentinië',
  'Brazilië', 'Engeland', 'België', 'Italië', 'Uruguay', 'Mexico',
  'VS', 'Canada', 'Japan', 'Zuid-Korea', 'Australië', 'Marokko',
  'Senegal', 'Nigeria', 'Ghana', 'Ivoorkust', 'Colombia', 'Ecuador',
  'Peru', 'Chili', 'Polen', 'Kroatië', 'Zwitserland', 'Denemarken',
  'Zweden', 'Noorwegen', 'Oostenrijk', 'Tsjechië', 'Hongarije',
  'Schotland', 'Wales', 'Ierland', 'Griekenland', 'Turkije',
  'Iran', 'Saoedi-Arabië', 'Qatar', 'Egypte', 'Algerije',
  'Tunesië', 'Kameroen', 'DR Congo', 'Mali', 'Zambia',
  'Anders',
]

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState('ball1')
  const [favoriteTeam, setFavoriteTeam] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (username.trim().length < 3) {
      setError('Gebruikersnaam moet minimaal 3 tekens zijn.')
      return
    }
    if (username.trim().length > 20) {
      setError('Gebruikersnaam mag maximaal 20 tekens zijn.')
      return
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn.')
      return
    }

    setLoading(true)
    try {
      await register({ username: username.trim(), password, avatar, favorite_team: favoriteTeam || null })
      navigate('/')
    } catch (err) {
      setError(err.message || 'Registratie mislukt. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  const avatarKeys = Object.keys(AVATARS)

  return (
    <div className="min-h-screen bg-pitch-900 field-bg flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">⚽</div>
          <h1 className="text-2xl font-heading font-black text-white">WK Pool 2026</h1>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <h2 className="text-xl font-heading font-bold text-white text-center">Maak je account aan</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-white/70 text-sm font-heading mb-1.5">
              Gebruikersnaam <span className="text-white/30">(3-20 tekens)</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="kies een naam"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-white/70 text-sm font-heading mb-1.5">
              Wachtwoord <span className="text-white/30">(min. 6 tekens)</span>
            </label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Avatar selector */}
          <div>
            <label className="block text-white/70 text-sm font-heading mb-2">Kies je avatar</label>
            <div className="grid grid-cols-7 gap-2">
              {avatarKeys.map((key) => {
                const av = AVATARS[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAvatar(key)}
                    className={`w-10 h-10 ${av.bg} rounded-full flex items-center justify-center text-lg transition-all ${
                      avatar === key
                        ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-pitch-800 scale-110'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    title={key}
                  >
                    <span className="leading-none">{av.emoji}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Favorite team */}
          <div>
            <label className="block text-white/70 text-sm font-heading mb-1.5">
              Favoriet land <span className="text-white/30">(optioneel)</span>
            </label>
            <select
              className="input appearance-none cursor-pointer"
              value={favoriteTeam}
              onChange={(e) => setFavoriteTeam(e.target.value)}
            >
              <option value="" style={{ background: '#166534' }}>— Kies een land —</option>
              {WK_COUNTRIES.map((c) => (
                <option key={c} value={c} style={{ background: '#166534' }}>{c}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-bounce-ball text-lg">⚽</span>
            ) : (
              'Aanmelden'
            )}
          </button>
        </form>

        <p className="text-center text-white/50 text-sm mt-4">
          Al een account?{' '}
          <Link to="/login" className="text-gold-400 font-heading font-bold hover:text-gold-300 transition-colors">
            Log hier in
          </Link>
        </p>
      </div>
    </div>
  )
}
