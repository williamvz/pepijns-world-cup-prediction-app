import React, { useState } from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { api } from '../../services/api'

export default function ScoreInput({ match, onSave }) {
  const [home, setHome] = useState(match.home_score ?? '')
  const [away, setAway] = useState(match.away_score ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const matchDate = new Date(match.match_datetime || match.match_date || match.datetime)
  const homeFlag = match.home_flag || ''
  const awayFlag = match.away_flag || ''

  async function handleSave() {
    if (home === '' || away === '') {
      setError('Vul beide scores in.')
      return
    }
    if (!confirming) {
      setConfirming(true)
      return
    }
    setError('')
    setSaving(true)
    setConfirming(false)
    try {
      await api.adminSetResult(match.id, parseInt(home), parseInt(away))
      setSuccess(true)
      onSave && onSave(match.id, parseInt(home), parseInt(away))
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const statusColors = {
    finished: 'bg-green-600/20 text-green-400 border-green-600/30',
    live: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
    scheduled: 'bg-white/10 text-white/50 border-white/10',
    gepland: 'bg-white/10 text-white/50 border-white/10',
    bezig: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
    afgelopen: 'bg-green-600/20 text-green-400 border-green-600/30',
  }
  const statusLabels = {
    finished: 'Afgelopen',
    live: 'Live',
    scheduled: 'Gepland',
    gepland: 'Gepland',
    bezig: 'Bezig',
    afgelopen: 'Afgelopen',
  }
  const statusClass = statusColors[match.status] || 'bg-white/10 text-white/50 border-white/10'
  const statusLabel = statusLabels[match.status] || match.status || 'Gepland'

  return (
    <div className="card p-4">
      {/* Match info */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-white/40 font-heading">
          {format(matchDate, 'EEE d MMM · HH:mm', { locale: nl })}
          {match.venue ? ` · ${match.venue}` : ''}
        </div>
        <span className={`text-xs font-heading font-bold px-2 py-0.5 rounded-full border ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-2xl">{homeFlag}</span>
          <span className="font-heading font-bold text-sm text-white">{match.home_team}</span>
        </div>
        <span className="text-white/30 font-heading">-</span>
        <div className="flex-1 flex items-center gap-2 justify-end">
          <span className="font-heading font-bold text-sm text-white">{match.away_team}</span>
          <span className="text-2xl">{awayFlag}</span>
        </div>
      </div>

      {/* Score inputs */}
      <div className="flex items-center gap-3 mb-3">
        <input
          type="number"
          className="score-input flex-1"
          value={home}
          onChange={(e) => { setHome(e.target.value); setConfirming(false); setSuccess(false) }}
          min={0}
          max={20}
          placeholder="—"
        />
        <span className="text-white/40 font-heading font-bold text-xl">-</span>
        <input
          type="number"
          className="score-input flex-1"
          value={away}
          onChange={(e) => { setAway(e.target.value); setConfirming(false); setSuccess(false) }}
          min={0}
          max={20}
          placeholder="—"
        />
        <button
          className={`${confirming ? 'btn-danger' : 'btn-primary'} py-2 px-4 text-sm flex items-center gap-1`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '...' : confirming ? 'Bevestig!' : success ? '✓ Opgeslagen' : 'Sla op'}
        </button>
      </div>

      {confirming && (
        <div className="text-xs text-orange-400 font-heading text-center">
          Weet je zeker dat de uitslag {home} - {away} is? Klik opnieuw om te bevestigen.
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 font-heading text-center">{error}</div>
      )}

      {success && (
        <div className="text-xs text-green-400 font-heading text-center">
          Uitslag opgeslagen! Punten worden herberekend.
        </div>
      )}
    </div>
  )
}
