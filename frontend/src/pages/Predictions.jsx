import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { api } from '../services/api'
import PredictModal from '../components/predictions/PredictModal'
import { PillGroup, TogglePill, ControlLabel, GroupHeader } from '../components/common/FilterControls'
import { GROUP_OPTIONS, sortByDate, groupMatchItems } from '../utils/matchFilters'

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

function hasPrediction(prediction) {
  return prediction !== null && prediction !== undefined
}

export default function Predictions() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [groupBy, setGroupBy] = useState('none')
  const [sortDir, setSortDir] = useState('asc')
  const [hidePredicted, setHidePredicted] = useState(false)
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

  // Counts per status filter (independent of the hide-predicted toggle).
  const counts = items.reduce(
    (acc, { match, prediction }) => {
      const isFinished = match.status === 'finished'
      const has = hasPrediction(prediction)
      acc.all += 1
      if (!has && !isFinished) acc.todo += 1
      if (has && !isFinished) acc.filled += 1
      if (isFinished) acc.finished += 1
      return acc
    },
    { all: 0, todo: 0, filled: 0, finished: 0 }
  )

  const filtered = items.filter(({ match, prediction }) => {
    const isFinished = match.status === 'finished'
    const has = hasPrediction(prediction)

    if (hidePredicted && has) return false

    if (filter === 'todo') return !has && !isFinished
    if (filter === 'filled') return has && !isFinished
    if (filter === 'finished') return isFinished
    return true
  })

  const sortedFiltered = sortByDate(filtered, sortDir, (x) => x.match)
  const sections = groupMatchItems(sortedFiltered, groupBy, (x) => x.match)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  function renderCard({ match, prediction }) {
    const isFinished = match.status === 'finished'
    const isLocked = match.is_locked || match.locked
    const has = hasPrediction(prediction)
    const matchDate = new Date(match.match_datetime)
    const badge = isFinished && has ? pointsBadge(prediction.points) : null
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
              {match.group ? ` · Groep ${match.group}` : ''}
            </div>

            {/* Prediction row */}
            {has ? (
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
              {has ? 'Aanpassen' : 'Voorspel'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const statusOptions = FILTERS.map((f) => ({ ...f, count: counts[f.key] }))

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-white mb-4">Mijn Voorspellingen</h1>

      {/* Status filter tabs */}
      <PillGroup options={statusOptions} value={filter} onChange={setFilter} className="mb-3" />

      {/* Group / sort / hide controls */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <ControlLabel>Groeperen</ControlLabel>
          <PillGroup options={GROUP_OPTIONS} value={groupBy} onChange={setGroupBy} size="sm" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <TogglePill active={hidePredicted} onClick={() => setHidePredicted((v) => !v)}>
            {hidePredicted ? '🙈' : '👁️'} Verberg voorspelde
          </TogglePill>
          <TogglePill
            active={false}
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDir === 'asc' ? '↑ Datum (vroeg → laat)' : '↓ Datum (laat → vroeg)'}
          </TogglePill>
        </div>
      </div>

      {sortedFiltered.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-heading font-bold text-white/70">Geen wedstrijden gevonden</p>
          {hidePredicted && (
            <p className="text-white/40 text-sm mt-1 font-heading">
              Tip: zet "Verberg voorspelde" uit om alles te zien.
            </p>
          )}
        </div>
      ) : (
        <div>
          {sections.map((section) => (
            <div key={section.key}>
              {section.label && <GroupHeader label={section.label} count={section.count} />}
              <div className="space-y-3">
                {section.items.map(renderCard)}
              </div>
            </div>
          ))}
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
