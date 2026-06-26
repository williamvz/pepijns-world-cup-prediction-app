import db from '../db/database.js'
import { getQualifiers } from './standings.js'

// ── Schedules ────────────────────────────────────────────────────────────────
// Knockout kickoff times as naive Amsterdam wall-clock strings, matching how
// every other match is stored. These are sensible defaults that follow the real
// 2026 calendar shape; the admin can fine-tune any fixture afterwards in the
// "Wedstrijden" tab.
function spread(days, times, count) {
  const out = []
  for (let i = 0; i < count; i++) {
    const day = days[Math.min(Math.floor(i / times.length), days.length - 1)]
    out.push(`${day}T${times[i % times.length]}`)
  }
  return out
}

// Per-round configuration. `source`/`take` drive how a round is built from the
// previous one; the Round of 32 is special (built from the group standings).
// `firstNumber` keeps match numbers contiguous across the whole tournament
// (group stage is 1–72, knockouts 73–104).
const ROUNDS = {
  'Ronde van 32': {
    firstNumber: 73,
    schedule: spread(
      ['2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03'],
      ['18:00:00', '21:00:00', '23:00:00'],
      16
    ),
  },
  'Achtste finales': {
    source: 'Ronde van 32', take: 'winner', firstNumber: 89,
    schedule: spread(['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07'], ['18:00:00', '22:00:00'], 8),
  },
  'Kwartfinales': {
    source: 'Achtste finales', take: 'winner', firstNumber: 97,
    schedule: spread(['2026-07-09', '2026-07-10', '2026-07-11'], ['18:00:00', '22:00:00'], 4),
  },
  'Halve finales': {
    source: 'Kwartfinales', take: 'winner', firstNumber: 101,
    schedule: spread(['2026-07-14', '2026-07-15'], ['21:00:00'], 2),
  },
  'Troostfinale': {
    source: 'Halve finales', take: 'loser', firstNumber: 103,
    schedule: ['2026-07-18T18:00:00'],
  },
  'Finale': {
    source: 'Halve finales', take: 'winner', firstNumber: 104,
    schedule: ['2026-07-19T18:00:00'],
  },
}

export const GENERATABLE_PHASES = Object.keys(ROUNDS)

// ── Round of 32 (from group standings) ───────────────────────────────────────

// Standard single-elimination seeding order for `n` slots (n a power of two).
// Produces the bracket positions so that seed 1 and seed 2 can only meet in the
// final, seeds 1–4 only in the semis, etc. Each first-round match pairs seed s
// with seed (n+1-s).
function seedBracketOrder(n) {
  let order = [1, 2]
  while (order.length < n) {
    const sum = order.length * 2 + 1
    const next = []
    for (const s of order) {
      next.push(s)
      next.push(sum - s)
    }
    order = next
  }
  return order
}

function isRematch(a, b) {
  return a.group === b.group
}

// Greedily swap the lower-seeded sides between matches so no fixture is a
// group-stage rematch (mirrors FIFA's "no early rematch" intent).
function avoidRematches(pairs) {
  for (let i = 0; i < pairs.length; i++) {
    if (!isRematch(pairs[i].home, pairs[i].away)) continue
    for (let j = 0; j < pairs.length; j++) {
      if (j === i) continue
      if (!isRematch(pairs[i].home, pairs[j].away) && !isRematch(pairs[j].home, pairs[i].away)) {
        const tmp = pairs[i].away
        pairs[i].away = pairs[j].away
        pairs[j].away = tmp
        break
      }
    }
  }
  return pairs
}

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

  // Seeds 1..32: winners (best→worst), then runners-up, then the 8 best thirds.
  const seedList = [...q.winners, ...q.runnersUp, ...q.bestThirds]
  const order = seedBracketOrder(32)
  const schedule = ROUNDS['Ronde van 32'].schedule

  let pairs = []
  for (let k = 0; k < 16; k++) {
    pairs.push({ home: seedList[order[2 * k] - 1], away: seedList[order[2 * k + 1] - 1] })
  }
  pairs = avoidRematches(pairs)

  return pairs.map((p, i) => ({
    home_team_id: p.home.team.id,
    away_team_id: p.away.team.id,
    match_datetime: schedule[i],
    match_number: 73 + i,
    venue: null,
    city: null,
    home_team: p.home.team,
    away_team: p.away.team,
    home_slot: p.home.slot,
    away_slot: p.away.slot,
  }))
}

// ── Later rounds (from the winners/losers of the previous round) ──────────────

function loadRoundMatches(phaseName) {
  const phase = db.prepare('SELECT id FROM phases WHERE name = ?').get(phaseName)
  if (!phase) return null
  return db
    .prepare(`
      SELECT m.match_number, m.status, m.home_score, m.away_score,
        m.home_team_id, m.away_team_id,
        ht.name AS home_name, at.name AS away_name
      FROM matches m
      LEFT JOIN teams ht ON ht.id = m.home_team_id
      LEFT JOIN teams at ON at.id = m.away_team_id
      WHERE m.phase_id = ?
      ORDER BY m.match_number ASC
    `)
    .all(phase.id)
}

// Resolve the side that advances (or is eliminated) from a finished knockout
// match. Throws a user-facing Dutch error if the match isn't decided yet.
function resolveSide(match, take) {
  if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
    throw new Error(`Wedstrijd #${match.match_number} is nog niet gespeeld. Vul eerst alle uitslagen van de vorige ronde in.`)
  }
  if (match.home_score === match.away_score) {
    throw new Error(
      `Wedstrijd #${match.match_number} (${match.home_name} - ${match.away_name}) eindigde gelijk. ` +
        'Vul een beslissende uitslag in (na verlenging of strafschoppen) zodat de winnaar vaststaat.'
    )
  }
  const homeWon = match.home_score > match.away_score
  const advance = (take === 'winner') === homeWon
  return {
    team: { id: advance ? match.home_team_id : match.away_team_id, name: advance ? match.home_name : match.away_name },
    slot: (take === 'winner' ? 'W' : 'V') + match.match_number, // W=winnaar, V=verliezer
  }
}

export function buildKnockoutRound(phaseName) {
  const cfg = ROUNDS[phaseName]
  if (!cfg || !cfg.source) throw new Error(`Fase "${phaseName}" kan niet automatisch worden gegenereerd.`)

  const sourceMatches = loadRoundMatches(cfg.source)
  if (!sourceMatches || sourceMatches.length === 0) {
    throw new Error(`${cfg.source} bestaat nog niet. Genereer en speel eerst die ronde.`)
  }

  const advancers = sourceMatches.map((m) => resolveSide(m, cfg.take))

  const fixtures = []
  for (let k = 0; k < advancers.length; k += 2) {
    const home = advancers[k]
    const away = advancers[k + 1]
    const index = k / 2
    fixtures.push({
      home_team_id: home.team.id,
      away_team_id: away.team.id,
      match_datetime: cfg.schedule[index],
      match_number: cfg.firstNumber + index,
      venue: null,
      city: null,
      home_team: home.team,
      away_team: away.team,
      home_slot: home.slot,
      away_slot: away.slot,
    })
  }
  return fixtures
}

// Dispatch: build whichever round this phase represents.
export function buildRound(phaseName) {
  if (phaseName === 'Ronde van 32') return buildRoundOf32()
  return buildKnockoutRound(phaseName)
}

// Cheap readiness check for the admin UI: can this phase be generated right now?
// (Its own matches don't exist yet, and the round it's built from is ready.)
// Unlike buildRound this never throws — it just returns true/false.
export function readyToGenerate(phaseName) {
  const cfg = ROUNDS[phaseName]
  if (!cfg) return false

  const phase = db.prepare('SELECT id FROM phases WHERE name = ?').get(phaseName)
  if (!phase) return false
  const own = db.prepare('SELECT COUNT(*) AS c FROM matches WHERE phase_id = ?').get(phase.id).c
  if (own > 0) return false // already generated

  if (phaseName === 'Ronde van 32') {
    const q = getQualifiers()
    return q.complete && q.groupKeys.length === 12 && q.bestThirds.length >= 8
  }

  const source = loadRoundMatches(cfg.source)
  if (!source || source.length === 0) return false
  // Ready once every source match has a result; the build step surfaces the
  // precise reason (e.g. a draw) if one still can't be resolved.
  return source.every((m) => m.status === 'finished' && m.home_score !== null && m.away_score !== null)
}
