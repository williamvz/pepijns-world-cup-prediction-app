import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import ConfirmDialog from '../common/ConfirmDialog'

const TYPE_META = {
  champion: { label: 'Wereldkampioen', icon: '🏆', points: 10, placeholder: 'bv. Brazilië' },
  topscorer: { label: 'Topscorer', icon: '⚽', points: 5, placeholder: 'bv. Mbappé' },
}

function BonusTypeCard({ type, data, lastCorrectValue, onEvaluate }) {
  const meta = TYPE_META[type]
  const [value, setValue] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const predictions = data?.predictions || []
  const tally = data?.tally || []
  const evaluated = data?.evaluated || false
  const derivedCorrect = predictions.find((p) => p.is_correct === 1)?.predicted_value
  const correctValue = lastCorrectValue || derivedCorrect

  async function handleConfirm() {
    setConfirming(false)
    setSaving(true)
    try {
      await onEvaluate(type, value.trim())
    } finally {
      setSaving(false)
    }
  }

  if (predictions.length === 0) {
    return (
      <div className="card p-4">
        <h3 className="font-heading font-bold text-white mb-1">{meta.icon} {meta.label}</h3>
        <p className="text-white/40 text-sm font-heading">Nog geen voorspellingen ingevoerd door spelers.</p>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-bold text-white">{meta.icon} {meta.label}</h3>
        <span className="text-gold-400 text-xs font-heading">{meta.points} pt bij juist</span>
      </div>

      {evaluated && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-3 py-2 text-green-300 text-sm font-heading mb-3">
          ✓ Geëvalueerd{correctValue ? ` — correct antwoord: ${correctValue}` : ' (niemand had het juist)'}
        </div>
      )}

      {/* What players guessed, tap to fill the input */}
      <div className="flex flex-wrap gap-2 mb-3">
        {tally.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setValue(t.value)}
            className="text-xs font-heading bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 text-white/70 transition-all"
          >
            {t.value} · {t.count}
          </button>
        ))}
      </div>

      {/* Per-player breakdown */}
      <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
        {predictions.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-white/80 font-heading truncate">{p.username}</span>
            <span className="text-white/50 font-heading truncate">{p.predicted_value}</span>
            {p.is_correct === 1 && <span className="text-green-400 flex-shrink-0">✓ +{p.points_earned}</span>}
            {p.is_correct === 0 && <span className="text-white/20 flex-shrink-0">✗</span>}
            {p.is_correct === null && <span className="text-white/20 text-xs flex-shrink-0">—</span>}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="input text-sm"
          placeholder={meta.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="btn-primary flex-shrink-0 py-2 px-4 text-sm"
          onClick={() => setConfirming(true)}
          disabled={!value.trim() || saving}
        >
          {saving ? '...' : evaluated ? 'Opnieuw evalueren' : 'Evalueer'}
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          message={`${predictions.length} bonusvoorspelling(en) voor "${meta.label}" evalueren met "${value.trim()}" als juist antwoord? Spelers met een juiste gok krijgen ${meta.points} punten en een melding.`}
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}

export default function BonusPanel() {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [correctValues, setCorrectValues] = useState({})
  const [msg, setMsg] = useState('')

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.adminBonusOverview()
      setOverview(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  async function handleEvaluate(type, correctValue) {
    try {
      const res = await api.adminEvaluateBonus(type, correctValue)
      setCorrectValues((prev) => ({ ...prev, [type]: correctValue }))
      setMsg(res.message || 'Geëvalueerd')
      await fetchOverview()
    } catch (err) {
      setMsg(err.message || 'Evalueren mislukt')
    } finally {
      setTimeout(() => setMsg(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="text-4xl animate-bounce-ball">⚽</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="font-heading font-bold text-white mb-2">Bonusvoorspellingen evalueren</h2>
      <p className="text-white/40 text-xs font-heading -mt-2 mb-2">
        Vul de echte wereldkampioen en topscorer in om punten toe te kennen aan iedereen die het goed had.
      </p>

      {msg && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-3 text-green-300 text-sm font-heading">
          {msg}
        </div>
      )}

      <BonusTypeCard type="champion" data={overview?.champion} lastCorrectValue={correctValues.champion} onEvaluate={handleEvaluate} />
      <BonusTypeCard type="topscorer" data={overview?.topscorer} lastCorrectValue={correctValues.topscorer} onEvaluate={handleEvaluate} />
    </div>
  )
}
