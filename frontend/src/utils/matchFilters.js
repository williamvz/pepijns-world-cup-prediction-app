// Shared helpers for grouping, sorting and filtering match lists.
// Used by the player Predictions page and the admin Scores tab so both
// surfaces behave consistently.
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

// Canonical phase ordering (mirrors the bracket order on the Matches page).
export const PHASE_ORDER = [
  { key: 'group', label: 'Groepsfase' },
  { key: 'round_of_32', label: 'Ronde van 32' },
  { key: 'round_of_16', label: 'Ronde van 16' },
  { key: 'quarter', label: 'Kwartfinale' },
  { key: 'semi', label: 'Halve finale' },
  { key: 'third_place', label: 'Troostfinale' },
  { key: 'final', label: 'Finale' },
]

export const GROUP_OPTIONS = [
  { key: 'none', label: 'Geen' },
  { key: 'phase', label: 'Fase' },
  { key: 'group', label: 'Groep' },
  { key: 'day', label: 'Dag' },
]

// Map a match's free-text phase name onto a canonical phase key.
export function phaseKey(match) {
  const phase = (match?.phase || match?.round || '').toLowerCase()
  if (phase.includes('group') || phase.includes('groep')) return 'group'
  if (phase.includes('32')) return 'round_of_32'
  if (phase.includes('16') || phase.includes('achtste')) return 'round_of_16'
  if (phase.includes('kwart') || phase.includes('quarter')) return 'quarter'
  if (phase.includes('halve') || phase.includes('semi')) return 'semi'
  if (phase.includes('troost') || phase.includes('derde') || phase.includes('third') || phase.includes('3e')) return 'third_place'
  if (phase.includes('final') || phase.includes('finale')) return 'final'
  return 'group'
}

export function phaseLabel(key) {
  return PHASE_ORDER.find((p) => p.key === key)?.label || 'Overig'
}

export function getMatchDate(match) {
  return new Date(match?.match_datetime || match?.match_date || match?.datetime)
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str
}

// Sort a list of items by their match date. `getMatch` extracts the match
// object from each item (defaults to identity for plain match arrays).
export function sortByDate(items, dir = 'asc', getMatch = (x) => x) {
  const sorted = [...items].sort(
    (a, b) => getMatchDate(getMatch(a)) - getMatchDate(getMatch(b))
  )
  return dir === 'desc' ? sorted.reverse() : sorted
}

// Group items into ordered sections. Returns an array of
// { key, label, count, items }. With groupBy === 'none' a single
// label-less section containing every item is returned, so callers can render
// the same way regardless of grouping. Item order within each section is
// preserved, so pre-sorting the input controls within-section ordering.
export function groupMatchItems(items, groupBy, getMatch = (x) => x) {
  if (!groupBy || groupBy === 'none') {
    return [{ key: 'all', label: null, count: items.length, items }]
  }

  const buckets = new Map()
  items.forEach((item) => {
    const m = getMatch(item)
    let key
    let label
    let sortIndex

    if (groupBy === 'phase') {
      key = phaseKey(m)
      label = phaseLabel(key)
      sortIndex = PHASE_ORDER.findIndex((p) => p.key === key)
    } else if (groupBy === 'group') {
      const g = (m?.group || '').toUpperCase()
      if (g) {
        key = `g-${g}`
        label = `Groep ${g}`
        sortIndex = g.charCodeAt(0) - 65 // A -> 0, B -> 1, ...
      } else {
        // Knockout matches have no group: bucket them by phase, after the groups.
        const pk = phaseKey(m)
        key = `p-${pk}`
        label = phaseLabel(pk)
        sortIndex = 100 + PHASE_ORDER.findIndex((p) => p.key === pk)
      }
    } else {
      // groupBy === 'day'
      const d = getMatchDate(m)
      key = format(d, 'yyyy-MM-dd')
      label = capitalize(format(d, 'EEEE d MMMM', { locale: nl }))
      sortIndex = d.getTime()
    }

    if (!buckets.has(key)) buckets.set(key, { key, label, sortIndex, items: [] })
    buckets.get(key).items.push(item)
  })

  return [...buckets.values()]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((b) => ({ key: b.key, label: b.label, count: b.items.length, items: b.items }))
}
