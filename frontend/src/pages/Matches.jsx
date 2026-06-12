import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import MatchCard from '../components/matches/MatchCard'
import PredictModal from '../components/predictions/PredictModal'

const PHASES = [
  { key: 'group', label: 'Groepsfase' },
  { key: 'round_of_32', label: '1/32 Finale' },
  { key: 'round_of_16', label: '1/16 Finale' },
  { key: 'quarter', label: 'Kwartfinale' },
  { key: 'semi', label: 'Halve Finale' },
  { key: 'third_place', label: '3e Plaats' },
  { key: 'final', label: 'Finale' },
]

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function phaseKey(match) {
  const phase = (match.phase || match.round || '').toLowerCase()
  if (phase.includes('group') || phase.includes('groep') || phase === 'group stage') return 'group'
  if (phase.includes('32')) return 'round_of_32'
  if (phase.includes('16') || phase.includes('achtste')) return 'round_of_16'
  if (phase.includes('kwart') || phase.includes('quarter')) return 'quarter'
  if (phase.includes('halve') || phase.includes('semi')) return 'semi'
  if (phase.includes('derde') || phase.includes('third') || phase.includes('3e')) return 'third_place'
  if (phase.includes('final') || phase.includes('finale')) return 'final'
  return 'group'
}

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePhase, setActivePhase] = useState('group')
  const [activeGroup, setActiveGroup] = useState('A')
  const [predictModal, setPredictModal] = useState(null)
  const [error, setError] = useState('')

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
    return predictions.find((p) => p.match_id === matchId || p.match?.id === matchId)
  }

  const phaseMatches = matches.filter((m) => phaseKey(m) === activePhase)
  const availableGroups = GROUPS.filter((g) =>
    phaseMatches.some((m) => (m.group || '').toUpperCase() === g)
  )

  const displayedMatches =
    activePhase === 'group'
      ? phaseMatches.filter((m) => (m.group || '').toUpperCase() === activeGroup)
      : phaseMatches

  const availablePhases = PHASES.filter((ph) => matches.some((m) => phaseKey(m) === ph.key))

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

      {/* Phase tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {(availablePhases.length > 0 ? availablePhases : PHASES).map((ph) => {
          const hasMatches = matches.some((m) => phaseKey(m) === ph.key)
          return (
            <button
              key={ph.key}
              onClick={() => { setActivePhase(ph.key); setActiveGroup('A') }}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-heading font-bold text-sm transition-all ${
                activePhase === ph.key
                  ? 'bg-gold-500 text-pitch-900'
                  : hasMatches
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
              disabled={!hasMatches}
            >
              {ph.label}
            </button>
          )
        })}
      </div>

      {/* Group tabs (group phase only) */}
      {activePhase === 'group' && availableGroups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {availableGroups.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`flex-shrink-0 w-10 h-10 rounded-xl font-heading font-bold text-sm transition-all ${
                activeGroup === g
                  ? 'bg-pitch-700 text-white border-2 border-gold-400'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Matches list */}
      {displayedMatches.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="font-heading font-bold text-white/70 mb-1">
            {activePhase === 'group'
              ? `Geen wedstrijden in groep ${activeGroup}`
              : 'Nog niet ontgrendeld'}
          </p>
          <p className="text-white/40 text-sm">
            {activePhase !== 'group' && 'Wordt ontgrendeld door de admin zodra de fase begint.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={getPrediction(match.id)}
              onPredict={(m) => setPredictModal(m)}
            />
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
