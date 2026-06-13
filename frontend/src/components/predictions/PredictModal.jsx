import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { api } from '../../services/api'

function calcPoints(ph, pa, rh, ra) {
  if (rh === null || ra === null) return null
  const rDiff = rh - ra
  const pDiff = ph - pa
  if (ph === rh && pa === ra) return 5
  const rWinner = rDiff > 0 ? 'home' : rDiff < 0 ? 'away' : 'draw'
  const pWinner = pDiff > 0 ? 'home' : pDiff < 0 ? 'away' : 'draw'
  if (rWinner !== pWinner) return 0
  if (rDiff === pDiff) return 3
  return 2
}

export default function PredictModal({ match, existingPrediction, onSave, onClose }) {
  const [homeScore, setHomeScore] = useState(
    existingPrediction?.predicted_home ?? 0
  )
  const [awayScore, setAwayScore] = useState(
    existingPrediction?.predicted_away ?? 0
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const matchDate = new Date(match.match_datetime)

  function clamp(val) {
    const n = parseInt(val, 10)
    if (isNaN(n)) return 0
    return Math.max(0, Math.min(20, n))
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      await api.savePrediction(match.id, homeScore, awayScore)
      onSave && onSave({ predicted_home: homeScore, predicted_away: awayScore })
      onClose()
    } catch (err) {
      setError(err.message || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const possiblePoints = calcPoints(
    homeScore,
    awayScore,
    match.home_score ?? null,
    match.away_score ?? null
  )

  const homeFlag = match.home_flag || ''
  const awayFlag = match.away_flag || ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-pitch-800 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading font-black text-lg text-white">Voorspel</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Match teams */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 text-center">
            <div className="text-4xl mb-1">{homeFlag}</div>
            <div className="font-heading font-bold text-sm text-white">{match.home_team}</div>
            {match.home_rank != null && (
              <div className="text-white/30 text-[10px] font-heading mt-0.5">FIFA #{match.home_rank}</div>
            )}
          </div>
          <div className="text-white/30 font-heading font-bold text-xl px-4">VS</div>
          <div className="flex-1 text-center">
            <div className="text-4xl mb-1">{awayFlag}</div>
            <div className="font-heading font-bold text-sm text-white">{match.away_team}</div>
            {match.away_rank != null && (
              <div className="text-white/30 text-[10px] font-heading mt-0.5">FIFA #{match.away_rank}</div>
            )}
          </div>
        </div>

        {/* Score inputs */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {/* Home score */}
          <div className="flex flex-col items-center gap-2">
            <button
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl font-heading font-bold text-xl transition-all active:scale-95"
              onClick={() => setHomeScore((v) => clamp(v + 1))}
            >
              +
            </button>
            <input
              type="number"
              className="score-input"
              value={homeScore}
              onChange={(e) => setHomeScore(clamp(e.target.value))}
              min={0}
              max={20}
            />
            <button
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl font-heading font-bold text-xl transition-all active:scale-95"
              onClick={() => setHomeScore((v) => clamp(v - 1))}
            >
              −
            </button>
          </div>

          <span className="text-3xl font-heading font-black text-white/40">-</span>

          {/* Away score */}
          <div className="flex flex-col items-center gap-2">
            <button
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl font-heading font-bold text-xl transition-all active:scale-95"
              onClick={() => setAwayScore((v) => clamp(v + 1))}
            >
              +
            </button>
            <input
              type="number"
              className="score-input"
              value={awayScore}
              onChange={(e) => setAwayScore(clamp(e.target.value))}
              min={0}
              max={20}
            />
            <button
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl font-heading font-bold text-xl transition-all active:scale-95"
              onClick={() => setAwayScore((v) => clamp(v - 1))}
            >
              −
            </button>
          </div>
        </div>

        {/* Points preview (only if match already has result) */}
        {match.status === 'finished' && possiblePoints !== null ? (
          <div className="text-center text-white/50 text-sm mb-4">
            Dit zou <span className="text-gold-400 font-bold">{possiblePoints} punten</span> hebben opgeleverd
          </div>
        ) : (
          <div className="text-center text-white/40 text-sm mb-4">
            Voorspelling: <span className="text-white font-heading font-bold">{homeScore} - {awayScore}</span>
            {' '} · maximaal 5 punten
          </div>
        )}

        {/* Point system reminder */}
        <div className="glass rounded-xl p-3 mb-4 text-xs text-white/50 grid grid-cols-3 gap-2 text-center">
          <div><span className="text-green-400 font-bold">5 pt</span><br />Exact goed</div>
          <div><span className="text-teal-400 font-bold">3 pt</span><br />Zelfde verschil</div>
          <div><span className="text-blue-400 font-bold">2 pt</span><br />Juiste winnaar</div>
        </div>

        {/* Deadline */}
        <div className="text-center text-white/30 text-xs mb-4">
          Deadline: {format(matchDate, "EEEE d MMMM 'om' HH:mm", { locale: nl })}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-2 text-red-300 text-sm mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Annuleren</button>
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="animate-bounce-ball">⚽</span> : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
