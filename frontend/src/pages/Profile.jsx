import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import Avatar, { AVATARS } from '../components/common/Avatar'

const WK_COUNTRIES = [
  'Nederland', 'Duitsland', 'Frankrijk', 'Spanje', 'Portugal', 'Argentinië',
  'Brazilië', 'Engeland', 'België', 'Italië', 'Uruguay', 'Mexico',
  'VS', 'Canada', 'Japan', 'Zuid-Korea', 'Australië', 'Marokko',
  'Senegal', 'Nigeria', 'Ghana', 'Ivoorkust', 'Colombia', 'Ecuador',
  'Peru', 'Chili', 'Polen', 'Kroatië', 'Zwitserland', 'Denemarken',
  'Anders',
]

const RARITY_LABELS = { common: 'Gewoon', uncommon: 'Ongewoon', rare: 'Zeldzaam', legendary: 'Legendarisch' }
const RARITY_CLASSES = { common: 'badge-common', uncommon: 'badge-uncommon', rare: 'badge-rare', legendary: 'badge-legendary' }

export default function Profile() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()

  const [achievements, setAchievements] = useState([])
  const [myAchievements, setMyAchievements] = useState([])
  const [bonus, setBonus] = useState([])
  const [summary, setSummary] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [editAvatar, setEditAvatar] = useState(user?.avatar || 'ball1')
  const [editTeam, setEditTeam] = useState(user?.favorite_team || '')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [bonusChampion, setBonusChampion] = useState('')
  const [bonusScorer, setBonusScorer] = useState('')
  const [bonusSaving, setBonusSaving] = useState('')
  const [bonusMsg, setBonusMsg] = useState('')
  const [editingScorer, setEditingScorer] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [achData, myAchData, bonusData, sumData, predData] = await Promise.allSettled([
        api.getAchievements(),
        api.getMyAchievements(),
        api.getBonus(),
        api.getPredictionSummary(),
        api.getPredictions(),
      ])
      if (achData.status === 'fulfilled') {
        const a = achData.value
        setAchievements(a.achievements || a || [])
      }
      if (myAchData.status === 'fulfilled') {
        const a = myAchData.value
        setMyAchievements(a.achievements || a || [])
      }
      if (bonusData.status === 'fulfilled') {
        const b = bonusData.value
        setBonus(b.bonus_predictions || b.bonus || (Array.isArray(b) ? b : []))
      }
      if (sumData.status === 'fulfilled') {
        setSummary(sumData.value)
      }
      if (predData.status === 'fulfilled') {
        const p = predData.value
        setPredictions(p.predictions || p || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Build chart data from predictions
  const chartData = predictions
    .filter((p) => p.match?.status === 'finished' || p.status === 'finished')
    .sort((a, b) => new Date(a.match?.match_date || a.match?.datetime || 0) - new Date(b.match?.match_date || b.match?.datetime || 0))
    .reduce((acc, pred, i) => {
      const prev = acc[i - 1]?.total || 0
      acc.push({ name: `W${i + 1}`, total: prev + (pred.points || 0) })
      return acc
    }, [])

  const championBonus = bonus.find((b) => b.type === 'champion')
  const scorerBonus = bonus.find((b) => b.type === 'topscorer')

  async function handleSaveProfile() {
    setEditError('')
    setSaving(true)
    try {
      await updateUser({ avatar: editAvatar, favorite_team: editTeam || null })
      setEditing(false)
    } catch (err) {
      setEditError(err.message || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBonus(type, value) {
    if (!value.trim()) return
    setBonusSaving(type)
    setBonusMsg('')
    try {
      await api.saveBonus(type, value.trim())
      setBonusMsg(`${type === 'champion' ? 'Kampioen' : 'Topscorer'} opgeslagen!`)
      if (type === 'topscorer') setEditingScorer(false)
      fetchData()
    } catch (err) {
      setBonusMsg(err.message || 'Opslaan mislukt')
    } finally {
      setBonusSaving('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  const totalPoints = summary?.total_points ?? user?.total_points ?? 0
  const exactCount = summary?.exact_count ?? 0
  const winnerCount = summary?.winner_count ?? 0
  const totalPredictions = summary?.total_predictions ?? predictions.length ?? 0

  const unlockedIds = new Set(myAchievements.map((a) => a.id || a.achievement_id))
  const recentAchievements = myAchievements.slice(0, 6)

  return (
    <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
      {/* Avatar + info */}
      <div className="card p-6 flex flex-col items-center text-center">
        {editing ? (
          <div className="w-full">
            <h3 className="font-heading font-bold text-white mb-3">Kies je avatar</h3>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {Object.keys(AVATARS).map((key) => {
                const av = AVATARS[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditAvatar(key)}
                    className={`w-10 h-10 ${av.bg} rounded-full flex items-center justify-center text-lg transition-all ${
                      editAvatar === key ? 'ring-2 ring-gold-400 ring-offset-1 ring-offset-pitch-800 scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className="leading-none">{av.emoji}</span>
                  </button>
                )
              })}
            </div>
            <div className="mb-4">
              <label className="block text-white/70 text-sm font-heading mb-1.5">Favoriet land</label>
              <select
                className="input appearance-none"
                value={editTeam}
                onChange={(e) => setEditTeam(e.target.value)}
              >
                <option value="" style={{ background: '#166534' }}>— Kies een land —</option>
                {WK_COUNTRIES.map((c) => (
                  <option key={c} value={c} style={{ background: '#166534' }}>{c}</option>
                ))}
              </select>
            </div>
            {editError && (
              <div className="text-red-400 text-sm font-heading mb-3">{editError}</div>
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setEditing(false)}>Annuleren</button>
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? <span className="animate-bounce-ball">⚽</span> : 'Opslaan'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Avatar avatar={user?.avatar} size="xl" className="mb-4" />
            <h1 className="font-heading font-black text-2xl text-white">{user?.username}</h1>
            {user?.favorite_team && (
              <p className="text-white/50 text-sm mt-1">🌍 {user.favorite_team}</p>
            )}
            <button
              className="btn-secondary text-sm py-2 px-4 mt-4"
              onClick={() => { setEditAvatar(user?.avatar || 'ball1'); setEditTeam(user?.favorite_team || ''); setEditing(true) }}
            >
              ✏️ Profiel bewerken
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Punten', value: totalPoints, icon: '⭐' },
          { label: 'Exact goed', value: exactCount, icon: '🎯' },
          { label: 'Winnaar goed', value: winnerCount, icon: '✅' },
          { label: 'Voorspellingen', value: totalPredictions, icon: '📝' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="font-heading font-black text-2xl text-gold-400">{s.value}</div>
            <div className="text-white/50 text-xs font-heading">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Points chart */}
      {chartData.length > 1 && (
        <div className="card p-4">
          <h2 className="font-heading font-bold text-white mb-3">Puntverloop</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#166534', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
                labelStyle={{ color: '#fff', fontFamily: 'Montserrat', fontWeight: 700 }}
                itemStyle={{ color: '#f59e0b' }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bonus predictions */}
      <div className="card p-4">
        <h2 className="font-heading font-bold text-white mb-4">Bonusvoorspellingen</h2>

        {bonusMsg && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-2 text-green-300 text-sm font-heading mb-3">
            {bonusMsg}
          </div>
        )}

        <div className="space-y-3">
          {/* Champion */}
          <div>
            <label className="block text-white/70 text-sm font-heading mb-1.5">🏆 Wereldkampioen</label>
            {championBonus ? (
              <div className="flex items-center gap-3 glass rounded-xl p-3">
                <span className="font-heading font-bold text-gold-400">{championBonus.predicted_value}</span>
                <span className="text-white/30 text-xs font-heading">
                  {championBonus.points !== null && championBonus.points !== undefined
                    ? `${championBonus.points} pt`
                    : 'Nog geen uitslag'}
                </span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input"
                  placeholder="bv. Nederland"
                  value={bonusChampion}
                  onChange={(e) => setBonusChampion(e.target.value)}
                />
                <button
                  className="btn-primary flex-shrink-0 py-2 px-4 text-sm"
                  onClick={() => handleSaveBonus('champion', bonusChampion)}
                  disabled={bonusSaving === 'champion'}
                >
                  {bonusSaving === 'champion' ? '...' : 'Opslaan'}
                </button>
              </div>
            )}
          </div>

          {/* Top scorer — editable during the group stage */}
          <div>
            <label className="block text-white/70 text-sm font-heading mb-1.5">⚽ Topscorer</label>
            {scorerBonus && !editingScorer ? (
              <div className="flex items-center gap-3 glass rounded-xl p-3">
                <span className="font-heading font-bold text-gold-400">{scorerBonus.predicted_value}</span>
                <span className="text-white/30 text-xs font-heading">
                  {scorerBonus.points !== null && scorerBonus.points !== undefined
                    ? `${scorerBonus.points} pt`
                    : 'Nog geen uitslag'}
                </span>
                <button
                  className="btn-secondary text-xs py-1 px-3 ml-auto flex-shrink-0"
                  onClick={() => { setBonusScorer(scorerBonus.predicted_value); setBonusMsg(''); setEditingScorer(true) }}
                >
                  ✏️ Wijzig
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="bv. Mbappé"
                    value={bonusScorer}
                    onChange={(e) => setBonusScorer(e.target.value)}
                  />
                  <button
                    className="btn-primary flex-shrink-0 py-2 px-4 text-sm"
                    onClick={() => handleSaveBonus('topscorer', bonusScorer)}
                    disabled={bonusSaving === 'topscorer'}
                  >
                    {bonusSaving === 'topscorer' ? '...' : 'Opslaan'}
                  </button>
                  {scorerBonus && (
                    <button
                      className="btn-secondary flex-shrink-0 py-2 px-3 text-sm"
                      onClick={() => { setEditingScorer(false); setBonusMsg('') }}
                    >
                      Annuleer
                    </button>
                  )}
                </div>
                {scorerBonus && (
                  <p className="text-white/30 text-xs font-heading mt-1.5">
                    Je topscorer kan tijdens de groepsfase nog worden aangepast.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent achievements */}
      {recentAchievements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-white">Recente prestaties</h2>
            <button
              className="text-gold-400 text-sm font-heading hover:underline"
              onClick={() => navigate('/prestaties')}
            >
              Alles zien →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentAchievements.map((ach) => {
              const rarity = ach.rarity || 'common'
              return (
                <div key={ach.id || ach.achievement_id} className="card p-3 text-center">
                  <div className="text-3xl mb-2">{ach.icon || '🏅'}</div>
                  <div className="font-heading font-bold text-xs text-white mb-1">{ach.name}</div>
                  <span className={`text-xs font-heading font-bold px-2 py-0.5 rounded-full text-white ${RARITY_CLASSES[rarity]}`}>
                    {RARITY_LABELS[rarity]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
