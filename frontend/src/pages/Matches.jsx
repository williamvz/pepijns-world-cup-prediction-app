import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import MatchCard from '../components/matches/MatchCard'
import PredictModal from '../components/predictions/PredictModal'
import { PillGroup, TogglePill, ControlLabel, GroupHeader } from '../components/common/FilterControls'
import { GROUP_OPTIONS, sortByDate, groupMatchItems } from '../utils/matchFilters'

const STATUS_FILTERS = [
  { key: 'all', label: 'Alles' },
  { key: 'todo', label: 'Nog in te vullen' },
  { key: 'filled', label: 'Ingevuld' },
  { key: 'finished', label: 'Afgelopen' },
]

function hasPrediction(prediction) {
  return (
    !!prediction &&
    prediction.predicted_home !== null &&
    prediction.predicted_home !== undefined
  )
}

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [groupBy, setGroupBy] = useState('none')
  const [sortDir, setSortDir] = useState('asc')
  const [hidePredicted, setHidePredicted] = useState(false)
  const [search, setSearch] = useState('')
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
    } catch (e) {
      setError('Wedstrijden laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function getPrediction(matchId) {
    return predictions.find((p) => p.match_id === matchId || p.match?.id === matchId) || null
  }

  const items = matches.map((m) => ({ match: m, prediction: getPrediction(m.id) }))

  // Counts per status filter (independent of search / hide-predicted).
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

  const query = search.trim().toLowerCase()

  const filtered = items.filter(({ match, prediction }) => {
    const isFinished = match.status === 'finished'
    const has = hasPrediction(prediction)

    if (hidePredicted && has) return false
    if (filter === 'todo' && (has || isFinished)) return false
    if (filter === 'filled' && (!has || isFinished)) return false
    if (filter === 'finished' && !isFinished) return false

    if (query) {
      const hay = `${match.home_team || ''} ${match.away_team || ''} ${match.venue || ''}`.toLowerCase()
      if (!hay.includes(query)) return false
    }
    return true
  })

  const sorted = sortByDate(filtered, sortDir, (x) => x.match)
  const sections = groupMatchItems(sorted, groupBy, (x) => x.match)
  const statusOptions = STATUS_FILTERS.map((f) => ({ ...f, count: counts[f.key] }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-5xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-white mb-4">Wedstrijden</h1>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Status filter */}
      <PillGroup options={statusOptions} value={filter} onChange={setFilter} className="mb-3" />

      {/* Search */}
      <input
        type="text"
        className="input text-sm mb-3"
        placeholder="🔍 Zoek op land of stadion…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

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
          <TogglePill active={false} onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
            {sortDir === 'asc' ? '↑ Datum (vroeg → laat)' : '↓ Datum (laat → vroeg)'}
          </TogglePill>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-heading font-bold text-white/70">Geen wedstrijden gevonden</p>
          {(hidePredicted || query || filter !== 'all') && (
            <p className="text-white/40 text-sm mt-1 font-heading">
              Pas je filters of zoekopdracht aan om meer te zien.
            </p>
          )}
        </div>
      ) : (
        <div>
          {sections.map((section) => (
            <div key={section.key}>
              {section.label && <GroupHeader label={section.label} count={section.count} />}
              <div className="space-y-3">
                {section.items.map(({ match, prediction }) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={prediction}
                    onPredict={(m) => setPredictModal(m)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom spacer */}
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
