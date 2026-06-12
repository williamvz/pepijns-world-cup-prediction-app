import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { api } from '../services/api'
import PredictModal from '../components/predictions/PredictModal'

const FILTERS = [
  { key: 'all', label: 'Alles' },
  { key: 'todo', label: 'Nog in te vullen' },
  { key: 'filled', label: 'Ingevuld' },
  { key: 'finished', label: 'Afgelopen' },
]

function statusIcon(pred, match) {
  if (!match) return '⚪'
  if (match.status === 'finished') {
    if (!pred) return '🔴'
    return '⚪'
  }
  if (pred) return '🟢'
  const diff = new Date(match.match_datetime) - new Date()
  if (diff < 24 * 3600 * 1000 && diff > 0) return '🟡'
  if (diff <= 0) return '🔴'
  return '🟢'
}

function pointsBadge(points) {
  if (points === null || points === undefined) return null
  if (points >= 5) return { label: `+${points} exact`, cls: 'bg-green-600' }
  if (points >= 3) return { label: `+${points} goed`, cls: 'bg-teal-600' }
  if (points >= 2) return { label: `+${points} winnaar`, cls: 'bg-blue-600' }
  if (points === 1) return { label: '+1 pt', cls: 'bg-indigo-600' }
  return { label: '0 pt', cls: 'bg-gray-600' }
}

export default function Predictions() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [predictModal, setPredictModal] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [mData, pData] = await Promise.allSettled([
        api.getMatches(),
        api.getPredictions(),
      ])
      if (mData.status === 'fulfilled') {
        const m = mData.value
        setMatches(m.matches || m || [])
      }
      if (pData.status === 'fulfilled') {
        const p = pData.value
        setPredictions(p.predictions || p || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function getPrediction(matchId) {
    return predictions.find((p) => p.match_id === matchId || p.match?.id === matchId) || null
  }

  // Build combined items
  const items = matches.map((m) => ({
    match: m,
    prediction: getPrediction(m.id),
  }))

  const filtered = items.filter(({ match, prediction }) => {
    const isFinished = match.status === 'finished'
    const hasPred = prediction !== null && prediction !== undefined

    if (filter === 'todo') return !hasPred && !isFinished
    if (filter === 'filled') return hasPred && !isFinished
    if (filter === 'finished') return isFinished
    return true
  })

  const sortedFiltered = [...filtered].sort(
    (a, b) =>
      new Date(a.match?.match_datetime) -
      new Date(b.match?.match_datetime)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-white mb-4">Mijn Voorspellingen</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl font-heading font-bold text-sm transition-all ${
              filter === f.key ? 'bg-gold-500 text-pitch-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-heading font-bold text-white/70">Geen wedstrijden gevonden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFiltered.map(({ match, prediction }) => {
            const isFinished = match.status === 'finished'
            const isLocked = match.is_locked || match.locked
            const hasPred = prediction !== null && prediction !== undefined
            const matchDate = new Date(match.match_datetime)
            const badge = isFinished && hasPred ? pointsBadge(prediction.points) : null
            const icon = statusIcon(prediction, match)

            return (
              <div key={match.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">{icon}</span>

                  <div className="flex-1 min-w-0">
                    {/* Teams */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{match.home_flag || ''}</span>
                      <span className="font-heading font-bold text-sm text-white">
                        {match.home_team}
                      </span>
                      {isFinished ? (
                        <span className="font-heading font-black text-gold-400 text-sm">
                          {match.home_score} - {match.away_score}
                        </span>
                      ) : (
                        <span className="text-white/30 font-heading text-xs">VS</span>
                      )}
                      <span className="font-heading font-bold text-sm text-white">
                        {match.away_team}
                      </span>
                      <span className="text-lg">{match.away_flag || ''}</span>
                    </div>

                    {/* Date */}
                    <div className="text-white/40 text-xs font-heading mb-2">
                      {format(matchDate, "EEE d MMM 'om' HH:mm", { locale: nl })}
                      {match.phase ? ` · ${match.phase}` : ''}
                    </div>

                    {/* Prediction row */}
                    {hasPred ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white/50 text-xs font-heading">Voorspelling:</span>
                        <span className="font-heading font-bold text-sm text-white">
                          {prediction.predicted_home} - {prediction.predicted_away}
                        </span>
                        {badge && (
                          <span className={`text-xs font-heading font-bold px-2 py-0.5 rounded-full text-white ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                    ) : isFinished ? (
                      <span className="text-red-400 text-xs font-heading">❌ Geen voorspelling gedaan</span>
                    ) : isLocked ? (
                      <span className="text-white/30 text-xs font-heading">🔒 Gesloten - geen voorspelling</span>
                    ) : (
                      <span className="text-white/40 text-xs font-heading">Nog geen voorspelling</span>
                    )}
                  </div>

                  {/* Edit button */}
                  {!isLocked && !isFinished && (
                    <button
                      className="flex-shrink-0 btn-primary text-xs py-1.5 px-3"
                      onClick={() => setPredictModal(match)}
                    >
                      {hasPred ? 'Aanpassen' : 'Voorspel'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="h-4" />

      {predictModal && (
        <PredictModal
          match={predictModal}
          existingPrediction={getPrediction(predictModal.id)}
          onSave={() => fetchData()}
          onClose={() => setPredictModal(null)}
        />
      )}
    </div>
  )
}
