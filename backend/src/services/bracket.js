import db from '../db/database.js'
import { getQualifiers } from './standings.js'

// ── Official FIFA World Cup 2026 knockout bracket ─────────────────────────────
// The 2026 bracket is FIXED in advance: which group position meets which in the
// Round of 32, and how each winner flows into the later rounds, is decided by the
// official schedule — NOT by seeding or performance. We therefore encode the
// official bracket verbatim instead of computing a generic single-elimination
// seeding (which produced the wrong fixtures before).
//
// Slot labels:
//   1X = winner of group X        2X = runner-up of group X
//   3X = third-placed team of group X (only the eight best thirds advance; in
//        2026 those came from groups B, D, E, F, I, J, K and L).
//
// Kick-off times are naive Amsterdam wall-clock strings (Europe/Amsterdam), the
// same format every other match uses, taken straight from the official schedule.
// The admin can fine-tune any fixture afterwards under the "Wedstrijden" tab.

// Round of 32 — match numbers 73–88, listed in official bracket order.
// [matchNumber, homeSlot, awaySlot, datetime]   (home = team listed on top in
// the official bracket)
const ROUND_OF_32 = [
  [73, '2A', '2B', '2026-06-28T21:00:00'], // Zuid-Afrika – Canada
  [74, '1E', '3D', '2026-06-29T22:30:00'], // Duitsland – Paraguay
  [75, '1F', '2C', '2026-06-30T03:00:00'], // Nederland – Marokko
  [76, '1C', '2F', '2026-06-29T19:00:00'], // Brazilië – Japan
  [77, '1I', '3F', '2026-06-30T23:00:00'], // Frankrijk – Zweden
  [78, '2E', '2I', '2026-06-30T19:00:00'], // Ivoorkust – Noorwegen
  [79, '1A', '3E', '2026-07-01T03:00:00'], // Mexico – Ecuador
  [80, '1L', '3K', '2026-07-01T18:00:00'], // Engeland – Congo DR
  [81, '1D', '3B', '2026-07-02T02:00:00'], // VS – Bosnië-Herzegovina
  [82, '1G', '3I', '2026-07-01T22:00:00'], // België – Senegal
  [83, '2K', '2L', '2026-07-03T01:00:00'], // Portugal – Kroatië
  [84, '1H', '2J', '2026-07-02T21:00:00'], // Spanje – Oostenrijk
  [85, '1B', '3J', '2026-07-03T05:00:00'], // Zwitserland – Algerije
  [86, '1J', '2H', '2026-07-04T00:00:00'], // Argentinië – Kaapverdië
  [87, '1K', '3L', '2026-07-04T03:30:00'], // Colombia – Ghana
  [88, '2D', '2G', '2026-07-03T20:00:00'], // Australië – Egypte
]

// Later rounds — every fixture is built from two earlier matches, referenced by
// match number. `take` decides which side advances: the winners, or (for the
// third-place play-off) the losers of the two semi-finals.
// Each entry: [matchNumber, sourceA, sourceB, datetime]   (home = winner/loser
// of sourceA).
//
// NB: the Round of 16 pairings are NOT consecutive match numbers — match 89 is
// winner-74 vs winner-77, match 90 is winner-73 vs winner-75, etc. — so the tree
// is encoded explicitly rather than by pairing neighbours.
const LATER_ROUNDS = {
  'Achtste finales': {
    take: 'winner',
    fixtures: [
      [89, 74, 77, '2026-07-04T23:00:00'],
      [90, 73, 75, '2026-07-04T19:00:00'],
      [91, 76, 78, '2026-07-05T22:00:00'],
      [92, 79, 80, '2026-07-06T02:00:00'],
      [93, 83, 84, '2026-07-06T21:00:00'],
      [94, 81, 82, '2026-07-07T02:00:00'],
      [95, 86, 88, '2026-07-07T18:00:00'],
      [96, 85, 87, '2026-07-07T22:00:00'],
    ],
  },
  'Kwartfinales': {
    take: 'winner',
    fixtures: [
      [97, 89, 90, '2026-07-09T22:00:00'],
      [98, 93, 94, '2026-07-10T21:00:00'],
      [99, 91, 92, '2026-07-11T23:00:00'],
      [100, 95, 96, '2026-07-12T03:00:00'],
    ],
  },
  'Halve finales': {
    take: 'winner',
    fixtures: [
      [101, 97, 98, '2026-07-14T21:00:00'],
      [102, 99, 100, '2026-07-15T21:00:00'],
    ],
  },
  // Third-place play-off: the two losing semi-finalists. Times for the last two
  // fixtures were not on the official screenshot — verify/adjust if needed.
  'Troostfinale': {
    take: 'loser',
    fixtures: [[103, 101, 102, '2026-07-18T21:00:00']],
  },
  'Finale': {
    take: 'winner',
    fixtures: [[104, 101, 102, '2026-07-19T21:00:00']],
  },
}

export const GENERATABLE_PHASES = ['Ronde van 32', ...Object.keys(LATER_ROUNDS)]

// ── Round of 32 (from the group standings) ────────────────────────────────────

export function buildRoundOf32() {
  const q = getQualifiers()

  if (!q.complete) {
    throw new Error(
      `Groepsfase nog niet volledig afgerond (${q.finishedCount}/${q.total} wedstrijden met uitslag). ` +
        'Vul eerst alle groepsuitslagen in.'
    )
  }
  if (q.groupKeys.length !== 12) {
    throw new Error(`Verwacht 12 groepen, maar ${q.groupKeys.length} gevonden. Ronde van 32 kan niet worden gegenereerd.`)
  }
  if (q.bestThirds.length < 8) {
    throw new Error('Onvoldoende nummers 3 om de beste 8 te bepalen.')
  }

  // Map every slot label (1A, 2C, 3E, …) to the qualifying team behind it.
  const bySlot = {}
  for (const w of q.winners) bySlot[w.slot] = w // 1A..1L
  for (const r of q.runnersUp) bySlot[r.slot] = r // 2A..2L
  for (const t of q.bestThirds) bySlot[t.slot] = t // 3X for the eight best thirds

  const resolve = (slot) => {
    const entry = bySlot[slot]
    if (!entry) {
      throw new Error(
        slot[0] === '3'
          ? `De nummer 3 van groep ${slot[1]} hoort volgens het officiële schema bij de beste 8, ` +
              'maar staat dat niet in de huidige eindstand. Controleer de groepsuitslagen.'
          : `Geen team gevonden voor slot ${slot}.`
      )
    }
    return entry
  }

  return ROUND_OF_32.map(([number, homeSlot, awaySlot, datetime]) => {
    const home = resolve(homeSlot)
    const away = resolve(awaySlot)
    return {
      home_team_id: home.team.id,
      away_team_id: away.team.id,
      match_datetime: datetime,
      match_number: number,
      venue: null,
      city: null,
      home_team: home.team,
      away_team: away.team,
      home_slot: homeSlot,
      away_slot: awaySlot,
    }
  })
}

// ── Later rounds (from the winners/losers of earlier matches) ─────────────────

function loadMatchByNumber(number) {
  return db
    .prepare(`
      SELECT m.match_number, m.status, m.home_score, m.away_score, m.winner_team_id,
        m.home_team_id, m.away_team_id,
        ht.name AS home_name, at.name AS away_name
      FROM matches m
      LEFT JOIN teams ht ON ht.id = m.home_team_id
      LEFT JOIN teams at ON at.id = m.away_team_id
      WHERE m.match_number = ?
    `)
    .get(number)
}

// Resolve the side that advances (or is eliminated) from a finished knockout
// match. Throws a user-facing Dutch error if the match isn't decided yet.
function resolveSide(match, number, take) {
  if (!match) {
    throw new Error(`Wedstrijd #${number} bestaat nog niet. Genereer en speel eerst de vorige ronde.`)
  }
  if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
    throw new Error(`Wedstrijd #${number} is nog niet gespeeld. Vul eerst alle uitslagen van de vorige ronde in.`)
  }
  let homeWon
  if (match.home_score === match.away_score) {
    // Level after extra time: the shootout winner (winner_team_id) decides who
    // advances. Without it we cannot know, so ask the admin to set it.
    if (!match.winner_team_id) {
      throw new Error(
        `Wedstrijd #${number} (${match.home_name} - ${match.away_name}) eindigde gelijk. ` +
          'Kies bij de uitslag wie er doorging na strafschoppen.'
      )
    }
    homeWon = match.winner_team_id === match.home_team_id
  } else {
    homeWon = match.home_score > match.away_score
  }
  const advance = (take === 'winner') === homeWon
  return {
    team: { id: advance ? match.home_team_id : match.away_team_id, name: advance ? match.home_name : match.away_name },
    slot: (take === 'winner' ? 'W' : 'V') + number, // W=winnaar, V=verliezer
  }
}

export function buildKnockoutRound(phaseName) {
  const cfg = LATER_ROUNDS[phaseName]
  if (!cfg) throw new Error(`Fase "${phaseName}" kan niet automatisch worden gegenereerd.`)

  return cfg.fixtures.map(([number, sourceA, sourceB, datetime]) => {
    const home = resolveSide(loadMatchByNumber(sourceA), sourceA, cfg.take)
    const away = resolveSide(loadMatchByNumber(sourceB), sourceB, cfg.take)
    return {
      home_team_id: home.team.id,
      away_team_id: away.team.id,
      match_datetime: datetime,
      match_number: number,
      venue: null,
      city: null,
      home_team: home.team,
      away_team: away.team,
      home_slot: home.slot,
      away_slot: away.slot,
    }
  })
}

// Dispatch: build whichever round this phase represents.
export function buildRound(phaseName) {
  if (phaseName === 'Ronde van 32') return buildRoundOf32()
  return buildKnockoutRound(phaseName)
}

// Is the round this phase derives from fully decided, so it can be built now?
// (Group stage complete for the Round of 32; every source match finished — with a
// recorded shootout winner for a level score — for the later rounds.)
function sourceReady(phaseName) {
  if (phaseName === 'Ronde van 32') {
    const q = getQualifiers()
    return q.complete && q.groupKeys.length === 12 && q.bestThirds.length >= 8
  }

  const cfg = LATER_ROUNDS[phaseName]
  if (!cfg) return false
  const sourceNumbers = [...new Set(cfg.fixtures.flatMap(([, a, b]) => [a, b]))]
  return sourceNumbers.every((n) => {
    const m = loadMatchByNumber(n)
    return (
      m &&
      m.status === 'finished' &&
      m.home_score !== null &&
      m.away_score !== null &&
      (m.home_score !== m.away_score || m.winner_team_id != null)
    )
  })
}

// Cheap readiness check for the admin UI: can this phase be generated right now?
// (Its own matches don't exist yet, and the round it's built from is ready.)
// Unlike buildRound this never throws — it just returns true/false.
export function readyToGenerate(phaseName) {
  if (!GENERATABLE_PHASES.includes(phaseName)) return false

  const phase = db.prepare('SELECT id FROM phases WHERE name = ?').get(phaseName)
  if (!phase) return false
  const own = db.prepare('SELECT COUNT(*) AS c FROM matches WHERE phase_id = ?').get(phase.id).c
  if (own > 0) return false // already generated — use regenerate instead

  return sourceReady(phaseName)
}

// Can this already-generated knockout phase be safely rebuilt? Only when its
// fixtures carry no predictions and no results yet (so nothing is lost), and the
// round it derives from is still ready to build. Used to fix a phase that was
// generated with the wrong fixtures.
export function readyToRegenerate(phaseName) {
  if (!GENERATABLE_PHASES.includes(phaseName)) return false

  const phase = db.prepare('SELECT id FROM phases WHERE name = ?').get(phaseName)
  if (!phase) return false

  const matches = db.prepare('SELECT id, status FROM matches WHERE phase_id = ?').all(phase.id)
  if (matches.length === 0) return false // nothing to rebuild — use generate instead
  if (matches.some((m) => m.status === 'finished' || m.status === 'live')) return false

  const ids = matches.map((m) => m.id)
  const placeholders = ids.map(() => '?').join(',')
  const predCount = db
    .prepare(`SELECT COUNT(*) AS c FROM predictions WHERE match_id IN (${placeholders})`)
    .get(...ids).c
  if (predCount > 0) return false

  return sourceReady(phaseName)
}
