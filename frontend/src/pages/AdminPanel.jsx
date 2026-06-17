import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { api } from '../services/api'
import ScoresPanel from '../components/admin/ScoresPanel'
import Avatar from '../components/common/Avatar'

const TABS = [
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'scores', label: '⚽ Uitslagen' },
  { key: 'phases', label: '🔓 Fases' },
  { key: 'users', label: '👥 Gebruikers' },
  { key: 'matches', label: '📅 Wedstrijden' },
]

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-pitch-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-up">
        <p className="font-heading font-bold text-white mb-6 text-center">{message}</p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onCancel}>Annuleren</button>
          <button className="btn-danger flex-1" onClick={onConfirm}>Bevestigen</button>
        </div>
      </div>
    </div>
  )
}

function EditMatchModal({ match, onSave, onClose }) {
  const [datetime, setDatetime] = useState(
    (match.match_datetime || match.match_date) ? new Date(match.match_datetime || match.match_date).toISOString().slice(0, 16) : ''
  )
  const [venue, setVenue] = useState(match.venue || '')
  const [status, setStatus] = useState(match.status || 'scheduled')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await api.adminUpdateMatch(match.id, {
        match_date: datetime ? new Date(datetime).toISOString() : undefined,
        venue: venue || undefined,
        status,
      })
      onSave()
      onClose()
    } catch (err) {
      setError(err.message || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-pitch-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-white">Wedstrijd aanpassen</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">×</button>
        </div>
        <div className="font-heading font-bold text-gold-400 text-sm mb-4 text-center">
          {match.home_team} vs {match.away_team}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-white/70 text-sm font-heading mb-1">Datum & tijd</label>
            <input
              type="datetime-local"
              className="input"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-white/70 text-sm font-heading mb-1">Stadion</label>
            <input
              type="text"
              className="input"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="bv. MetLife Stadium"
            />
          </div>
          <div>
            <label className="block text-white/70 text-sm font-heading mb-1">Status</label>
            <select
              className="input appearance-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="scheduled" style={{ background: '#166534' }}>Gepland</option>
              <option value="live" style={{ background: '#166534' }}>Bezig</option>
              <option value="finished" style={{ background: '#166534' }}>Afgelopen</option>
              <option value="locked" style={{ background: '#166534' }}>Gesloten</option>
            </select>
          </div>
        </div>

        {error && <div className="text-red-400 text-sm font-heading mt-3">{error}</div>}

        <div className="flex gap-3 mt-5">
          <button className="btn-secondary flex-1" onClick={onClose}>Annuleren</button>
          <button
            className="btn-primary flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AVATARS = [
  { value: 'ball1', label: '⚽ Ball 1' },
  { value: 'ball2', label: '⚽ Ball 2' },
  { value: 'trophy', label: '🏆 Trofee' },
  { value: 'flag_nl', label: '🇳🇱 Nederland' },
  { value: 'flag_de', label: '🇩🇪 Duitsland' },
  { value: 'flag_fr', label: '🇫🇷 Frankrijk' },
  { value: 'flag_es', label: '🇪🇸 Spanje' },
  { value: 'flag_pt', label: '🇵🇹 Portugal' },
  { value: 'flag_ar', label: '🇦🇷 Argentinië' },
  { value: 'flag_br', label: '🇧🇷 Brazilië' },
  { value: 'captain', label: '🦁 Aanvoerder' },
  { value: 'goalkeeper', label: '🧤 Keeper' },
  { value: 'referee', label: '🟨 Scheidsrechter' },
]

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [users, setUsers] = useState([])
  const [matches, setMatches] = useState([])
  const [phases, setPhases] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [editMatch, setEditMatch] = useState(null)
  const [actionMsg, setActionMsg] = useState('')

  // New user form state
  const [newUser, setNewUser] = useState({ username: '', password: '', avatar: 'ball1', favorite_team: '', role: 'player' })
  const [newUserError, setNewUserError] = useState('')
  const [newUserLoading, setNewUserLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      api.adminDashboard(),
      api.adminUsers(),
      api.getMatches(),
      api.adminPhases(),
    ])
    if (results[0].status === 'fulfilled') setDashboard(results[0].value)
    if (results[1].status === 'fulfilled') {
      const u = results[1].value
      setUsers(u.users || u || [])
    }
    if (results[2].status === 'fulfilled') {
      const m = results[2].value
      setMatches(m.matches || m || [])
    }
    if (results[3].status === 'fulfilled') {
      const p = results[3].value
      setPhases(p.phases || p || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function showMsg(msg) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 3000)
  }

  async function handleDeleteUser(userId) {
    setConfirm({
      message: 'Weet je zeker dat je deze gebruiker wilt verwijderen?',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await api.adminDeleteUser(userId)
          showMsg('Gebruiker verwijderd')
          fetchAll()
        } catch (err) {
          showMsg(err.message || 'Verwijderen mislukt')
        }
      },
      onCancel: () => setConfirm(null),
    })
  }

  async function handleResetPassword(userId) {
    const newPwd = window.prompt('Nieuw wachtwoord (min. 6 tekens):')
    if (!newPwd || newPwd.length < 6) {
      showMsg('Wachtwoord te kort')
      return
    }
    try {
      await api.adminUpdateUser(userId, { password: newPwd })
      showMsg('Wachtwoord opgeslagen')
    } catch (err) {
      showMsg(err.message || 'Mislukt')
    }
  }

  async function handleToggleRole(user) {
    const newRole = user.role === 'admin' ? 'player' : 'admin'
    // The game always needs at least one admin — block demoting the last one.
    if (newRole === 'player') {
      const adminCount = users.filter((u) => u.role === 'admin').length
      if (adminCount <= 1) {
        showMsg('Er moet altijd minstens één admin zijn')
        return
      }
    }
    setConfirm({
      message: `${user.username} ${newRole === 'admin' ? 'admin maken' : 'terugzetten naar speler'}?`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await api.adminUpdateUser(user.id, { role: newRole })
          showMsg(`Rol gewijzigd naar ${newRole}`)
          fetchAll()
        } catch (err) {
          showMsg(err.message || 'Mislukt')
        }
      },
      onCancel: () => setConfirm(null),
    })
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setNewUserError('')
    if (!newUser.username.trim() || !newUser.password) {
      setNewUserError('Gebruikersnaam en wachtwoord zijn verplicht')
      return
    }
    setNewUserLoading(true)
    try {
      await api.adminCreateUser({
        username: newUser.username.trim(),
        password: newUser.password,
        avatar: newUser.avatar,
        favorite_team: newUser.favorite_team,
        role: newUser.role,
      })
      setNewUser({ username: '', password: '', avatar: 'ball1', favorite_team: '', role: 'player' })
      showMsg('Gebruiker aangemaakt!')
      fetchAll()
    } catch (err) {
      setNewUserError(err.message || 'Aanmaken mislukt')
    } finally {
      setNewUserLoading(false)
    }
  }

  async function handleUnlockPhase(phase) {
    setConfirm({
      message: `Fase "${phase.name || phase.phase}" ontgrendelen? Dit kan niet ongedaan gemaakt worden.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await api.adminUnlockPhase(phase.id)
          showMsg('Fase ontgrendeld!')
          fetchAll()
        } catch (err) {
          showMsg(err.message || 'Ontgrendelen mislukt')
        }
      },
      onCancel: () => setConfirm(null),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  // Sort purely chronologically so results can be entered in the order matches
  // are played, rather than grouped per pool.
  const sortedMatches = [...matches].sort((a, b) => {
    const dtA = new Date(a.match_datetime || a.match_date || a.datetime)
    const dtB = new Date(b.match_datetime || b.match_date || b.datetime)
    return dtA - dtB
  })

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-white mb-4">⚙️ Admin Paneel</h1>

      {actionMsg && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-3 text-green-300 text-sm font-heading mb-4">
          {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl font-heading font-bold text-sm transition-all ${
              activeTab === tab.key ? 'bg-gold-500 text-pitch-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Spelers', value: dashboard?.stats?.total_users ?? users.length, icon: '👥' },
              { label: 'Wedstrijden', value: dashboard?.stats?.total_matches ?? matches.length, icon: '⚽' },
              { label: 'Voorspellingen', value: dashboard?.stats?.total_predictions ?? '—', icon: '📝' },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <div className="text-3xl mb-1">{s.icon}</div>
                <div className="font-heading font-black text-2xl text-gold-400">{s.value}</div>
                <div className="text-white/50 text-xs font-heading">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Match coverage */}
          {dashboard?.match_coverage && dashboard.match_coverage.length > 0 && (
            <div className="card p-4">
              <h2 className="font-heading font-bold text-white mb-3">Dekkingsgraad aankomende wedstrijden</h2>
              <div className="space-y-2">
                {dashboard.match_coverage.map((mc) => (
                  <div key={mc.match_id} className="flex items-center gap-3">
                    <div className="flex-1 text-sm font-heading text-white">
                      {mc.home_team} vs {mc.away_team}
                    </div>
                    <div className="text-white/50 text-xs font-heading">
                      {mc.prediction_count}/{mc.total_users} spelers
                    </div>
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500 rounded-full"
                        style={{ width: mc.total_users ? `${(mc.prediction_count / mc.total_users) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scores tab */}
      {activeTab === 'scores' && (
        <ScoresPanel matches={matches} onSaved={fetchAll} />
      )}

      {/* Phases tab */}
      {activeTab === 'phases' && (
        <div className="space-y-3">
          <h2 className="font-heading font-bold text-white mb-2">Fases ontgrendelen</h2>
          {phases.length === 0 ? (
            <div className="card p-8 text-center text-white/40 font-heading">Geen fases gevonden</div>
          ) : (
            phases.map((phase) => {
              const isLocked = !phase.is_unlocked
              return (
                <div key={phase.id} className="card p-4 flex items-center gap-4">
                  <div className="text-3xl">{isLocked ? '🔒' : '🔓'}</div>
                  <div className="flex-1">
                    <div className="font-heading font-bold text-white">{phase.name || phase.phase}</div>
                    <div className="text-white/40 text-xs font-heading">
                      {isLocked ? 'Gesloten' : 'Ontgrendeld'}
                      {phase.unlocked_at && ` op ${format(new Date(phase.unlocked_at), 'd MMM yyyy', { locale: nl })}`}
                    </div>
                  </div>
                  {isLocked && (
                    <button
                      className="btn-primary text-sm py-2 px-4"
                      onClick={() => handleUnlockPhase(phase)}
                    >
                      🔓 Ontgrendel
                    </button>
                  )}
                  {!isLocked && (
                    <span className="text-green-400 font-heading font-bold text-sm">✓ Actief</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          <h2 className="font-heading font-bold text-white mb-2">Gebruikers beheren</h2>

          {/* Create new user form */}
          <div className="card p-4">
            <h3 className="font-heading font-bold text-white text-sm mb-3">➕ Nieuwe gebruiker aanmaken</h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 text-xs font-heading mb-1">Gebruikersnaam</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="gebruikersnaam"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-xs font-heading mb-1">Wachtwoord</label>
                  <input
                    type="password"
                    className="input text-sm"
                    placeholder="••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 text-xs font-heading mb-1">Avatar</label>
                  <select
                    className="input text-sm appearance-none"
                    value={newUser.avatar}
                    onChange={(e) => setNewUser({ ...newUser, avatar: e.target.value })}
                  >
                    {AVATARS.map((a) => (
                      <option key={a.value} value={a.value} style={{ background: '#166534' }}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/70 text-xs font-heading mb-1">Favoriet land</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="bv. Nederland"
                    value={newUser.favorite_team}
                    onChange={(e) => setNewUser({ ...newUser, favorite_team: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/70 text-xs font-heading mb-1">Rol</label>
                <select
                  className="input text-sm appearance-none"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="player" style={{ background: '#166534' }}>Speler</option>
                  <option value="admin" style={{ background: '#166534' }}>Admin</option>
                </select>
              </div>
              {newUserError && (
                <div className="text-red-400 text-xs font-heading">{newUserError}</div>
              )}
              <button
                type="submit"
                className="btn-primary w-full text-sm py-2"
                disabled={newUserLoading}
              >
                {newUserLoading ? '...' : 'Aanmaken'}
              </button>
            </form>
          </div>

          {users.length === 0 ? (
            <div className="card p-8 text-center text-white/40 font-heading">Geen gebruikers gevonden</div>
          ) : (
            users.map((u) => {
            const isLastAdmin = u.role === 'admin' && users.filter((x) => x.role === 'admin').length <= 1
            return (
              <div key={u.id} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar avatar={u.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-white text-sm">{u.username}</div>
                    <div className="text-white/40 text-xs font-heading">
                      {u.role === 'admin' ? '⭐ Admin' : 'Speler'}
                      {u.total_points !== undefined && ` · ${u.total_points} pt`}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary text-xs py-1.5 px-3"
                    onClick={() => handleResetPassword(u.id)}
                  >
                    🔑 Wachtwoord
                  </button>
                  <button
                    className={`text-xs py-1.5 px-3 rounded-xl font-heading font-bold transition-all active:scale-95 ${
                      isLastAdmin
                        ? 'bg-white/10 text-white/30 cursor-not-allowed'
                        : u.role === 'admin'
                        ? 'bg-orange-600 hover:bg-orange-500 text-white'
                        : 'bg-blue-700 hover:bg-blue-600 text-white'
                    }`}
                    onClick={() => handleToggleRole(u)}
                    disabled={isLastAdmin}
                    title={isLastAdmin ? 'Er moet altijd minstens één admin zijn' : ''}
                  >
                    {u.role === 'admin' ? '⬇️ Naar speler' : '⭐ Maak admin'}
                  </button>
                  <button
                    className="btn-danger text-xs py-1.5 px-3"
                    onClick={() => handleDeleteUser(u.id)}
                  >
                    🗑️ Verwijder
                  </button>
                </div>
              </div>
            )
            })
          )}
        </div>
      )}

      {/* Matches tab */}
      {activeTab === 'matches' && (
        <div className="space-y-3">
          <h2 className="font-heading font-bold text-white mb-2">Wedstrijden aanpassen</h2>
          {sortedMatches.length === 0 ? (
            <div className="card p-8 text-center text-white/40 font-heading">Geen wedstrijden gevonden</div>
          ) : (
            sortedMatches.map((m) => {
              const matchDate = new Date(m.match_datetime || m.match_date || m.datetime)
              const statusColors = {
                finished: 'text-green-400',
                live: 'text-gold-400 animate-pulse',
                scheduled: 'text-white/40',
                locked: 'text-white/30',
              }
              return (
                <div key={m.id} className="card p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-white text-sm">
                      {m.home_flag || ''} {m.home_team} vs {m.away_team} {m.away_flag || ''}
                    </div>
                    <div className="text-white/40 text-xs font-heading mt-0.5">
                      {format(matchDate, "EEE d MMM 'om' HH:mm", { locale: nl })}
                      {m.venue ? ` · ${m.venue}` : ''}
                    </div>
                    <div className={`text-xs font-heading mt-0.5 ${statusColors[m.status] || 'text-white/40'}`}>
                      {m.status || 'gepland'}
                    </div>
                  </div>
                  <button
                    className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                    onClick={() => setEditMatch(m)}
                  >
                    ✏️ Bewerken
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      <div className="h-4" />

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}

      {editMatch && (
        <EditMatchModal
          match={editMatch}
          onSave={fetchAll}
          onClose={() => setEditMatch(null)}
        />
      )}
    </div>
  )
}
