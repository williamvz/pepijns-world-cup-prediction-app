import db from '../db/database.js'

// Group-stage points system.
const WIN_POINTS = 3
const DRAW_POINTS = 1

// Deterministic ranking comparator (best team first).
// FIFA's official order is points → goal difference → goals for → head-to-head →
// fair-play → drawing of lots. For a friends' pool we stop at goals-for and use
// the team name as a final, fully deterministic tie-break so the same results
// always yield the same standings (the admin can hand-edit a generated fixture
// if a tie ever needs to fall the other way).
function compareStanding(a, b) {
  return (
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.team.name.localeCompare(b.team.name)
  )
}

// Build per-team group-stage statistics from the FINISHED group matches.
// Returns { groups, total, finishedCount, complete } where `groups` maps each
// group letter to its teams sorted best-first.
export function computeGroupStandings() {
  const groupPhase = db.prepare("SELECT id FROM phases WHERE name = 'Groepsfase'").get()
  if (!groupPhase) throw new Error('Groepsfase niet gevonden')

  const matches = db
    .prepare('SELECT * FROM matches WHERE phase_id = ?')
    .all(groupPhase.id)

  const total = matches.length
  const finished = matches.filter(
    (m) => m.status === 'finished' && m.home_score !== null && m.away_score !== null
  )

  // Seed a stat row for every team that belongs to a group.
  const teams = db
    .prepare('SELECT id, name, code, group_name, flag_emoji, fifa_ranking FROM teams')
    .all()
  const stats = {}
  for (const t of teams) {
    if (!t.group_name) continue
    stats[t.id] = {
      team: t,
      group: t.group_name,
      played: 0, won: 0, drawn: 0, lost: 0,
      gf: 0, ga: 0, gd: 0, points: 0,
    }
  }

  for (const m of finished) {
    const home = stats[m.home_team_id]
    const away = stats[m.away_team_id]
    if (!home || !away) continue // a knockout/placeholder match with no group team

    home.played++; away.played++
    home.gf += m.home_score; home.ga += m.away_score
    away.gf += m.away_score; away.ga += m.home_score

    if (m.home_score > m.away_score) {
      home.won++; away.lost++; home.points += WIN_POINTS
    } else if (m.home_score < m.away_score) {
      away.won++; home.lost++; away.points += WIN_POINTS
    } else {
      home.drawn++; away.drawn++
      home.points += DRAW_POINTS; away.points += DRAW_POINTS
    }
  }

  const groups = {}
  for (const s of Object.values(stats)) {
    s.gd = s.gf - s.ga
    ;(groups[s.group] ||= []).push(s)
  }
  for (const key of Object.keys(groups)) groups[key].sort(compareStanding)

  return {
    groups,
    total,
    finishedCount: finished.length,
    complete: total > 0 && finished.length === total,
  }
}

// Determine who advances to the Round of 32 per the 2026 format: the 12 group
// winners, the 12 runners-up, and the 8 best third-placed teams (ranked across
// all groups). Each qualifier carries its standings stats plus a `seedTier`
// (0 = winner, 1 = runner-up, 2 = third) used by the bracket builder.
export function getQualifiers() {
  const { groups, complete, finishedCount, total } = computeGroupStandings()
  const groupKeys = Object.keys(groups).sort()

  const winners = []
  const runnersUp = []
  const thirds = []

  for (const key of groupKeys) {
    const table = groups[key]
    if (table[0]) winners.push({ ...table[0], seedTier: 0, slot: `1${key}` })
    if (table[1]) runnersUp.push({ ...table[1], seedTier: 1, slot: `2${key}` })
    if (table[2]) thirds.push({ ...table[2], seedTier: 2, slot: `3${key}` })
  }

  const thirdsRanked = [...thirds].sort(compareStanding)
  const bestThirds = thirdsRanked.slice(0, 8)

  return {
    groups,
    groupKeys,
    winners,
    runnersUp,
    thirds: thirdsRanked,
    bestThirds,
    complete,
    finishedCount,
    total,
  }
}
