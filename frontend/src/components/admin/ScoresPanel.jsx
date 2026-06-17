import React, { useMemo, useState } from 'react'
import ScoreInput from './ScoreInput'
import { PillGroup, TogglePill, ControlLabel, GroupHeader } from '../common/FilterControls'
import { GROUP_OPTIONS, sortByDate, groupMatchItems } from '../../utils/matchFilters'

const STATUS_FILTERS = [
  { key: 'all', label: 'Alles' },
  { key: 'todo', label: 'In te vullen' },
  { key: 'done', label: 'Ingevuld' },
]

function isFilled(match) {
  return match.status === 'finished'
}

export default function ScoresPanel({ matches, onSaved }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupBy, setGroupBy] = useState('none')
  const [sortDir, setSortDir] = useState('asc')
  const [hideFilled, setHideFilled] = useState(false)
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    return matches.reduce(
      (acc, m) => {
        acc.all += 1
        if (isFilled(m)) acc.done += 1
        else acc.todo += 1
        return acc
      },
      { all: 0, todo: 0, done: 0 }
    )
  }, [matches])

  const query = search.trim().toLowerCase()

  const filtered = matches.filter((m) => {
    const filled = isFilled(m)
    if (hideFilled && filled) return false
    if (statusFilter === 'todo' && filled) return false
    if (statusFilter === 'done' && !filled) return false
    if (query) {
      const haystack = `${m.home_team || ''} ${m.away_team || ''} ${m.venue || ''}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })

  const sorted = sortByDate(filtered, sortDir)
  const sections = groupMatchItems(sorted, groupBy)

  const statusOptions = STATUS_FILTERS.map((f) => ({ ...f, count: counts[f.key] }))
  const pct = counts.all ? Math.round((counts.done / counts.all) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading font-bold text-white">Uitslagen invoeren</h2>
        <span className="text-white/50 text-xs font-heading">
          {counts.done} / {counts.all} ingevuld
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-gold-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Search */}
      <input
        type="text"
        className="input text-sm"
        placeholder="🔍 Zoek op land of stadion…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Status filter */}
      <PillGroup options={statusOptions} value={statusFilter} onChange={setStatusFilter} />

      {/* Group / sort / hide controls */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <ControlLabel>Groeperen</ControlLabel>
        <PillGroup options={GROUP_OPTIONS} value={groupBy} onChange={setGroupBy} size="sm" />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <TogglePill active={hideFilled} onClick={() => setHideFilled((v) => !v)}>
          {hideFilled ? '🙈' : '👁️'} Verberg ingevulde
        </TogglePill>
        <TogglePill active={false} onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
          {sortDir === 'asc' ? '↑ Datum (vroeg → laat)' : '↓ Datum (laat → vroeg)'}
        </TogglePill>
      </div>

      {sorted.length === 0 ? (
        <div className="card p-8 text-center text-white/40 font-heading">
          Geen wedstrijden gevonden
        </div>
      ) : (
        <div>
          {sections.map((section) => (
            <div key={section.key}>
              {section.label && <GroupHeader label={section.label} count={section.count} />}
              <div className="space-y-3">
                {section.items.map((m) => (
                  <ScoreInput key={m.id} match={m} onSave={() => onSaved()} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
