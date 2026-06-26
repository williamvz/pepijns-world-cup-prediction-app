import { getQualifiers } from './standings.js'

// Round of 32 starts the day after the last group matches and runs ~6 days.
// Naive Amsterdam wall-clock strings, matching how every other match is stored.
// These are sensible defaults; the admin can fine-tune any fixture afterwards
// in the "Wedstrijden" tab.
const R32_DAYS = [
  '2026-06-28', '2026-06-29', '2026-06-30',
  '2026-07-01', '2026-07-02', '2026-07-03',
]
const R32_TIMES = ['18:00:00', '21:00:00', '23:00:00']
const R32_FIRST_MATCH_NUMBER = 73

function scheduleFor(index) {
  const day = R32_DAYS[Math.min(Math.floor(index / 3), R32_DAYS.length - 1)]
  const time = R32_TIMES[index % R32_TIMES.length]
  return `${day}T${time}`
}

// Order all 32 qualifiers into seeds 1..32: winners first (best→worst), then
// runners-up, then the 8 best third-placed teams. Within each tier the standings
// comparator already sorted them, so concatenating tiers gives the seed order.
//
// Pairing seed i against seed (33 - i) reproduces the official Round-of-32 shape
// exactly: the 8 strongest winners meet the 8 third-placed teams, the 4 weakest
// winners meet runners-up, and the middle runners-up meet each other —
// 8×(winner v 3rd) + 4×(winner v runner-up) + 4×(runner-up v runner-up).
function seedOrder(qualifiers) {
  return [...qualifiers.winners, ...qualifiers.runnersUp, ...qualifiers.bestThirds]
}

// A pairing is a group-stage rematch when both teams came from the same group.
function isRematch(home, away) {
  return home.group === away.group
}

// Build the 16 Round-of-32 pairings from the seed order. Greedily swaps the
// lower-seeded side between matches to avoid two teams from the same group being
// drawn against each other again (mirrors FIFA's "no early rematch" intent).
function buildPairings(seeds) {
  const n = seeds.length // 32
  const pairs = []
  for (let i = 0; i < n / 2; i++) {
    pairs.push({ home: seeds[i], away: seeds[n - 1 - i] })
  }

  for (let i = 0; i < pairs.length; i++) {
    if (!isRematch(pairs[i].home, pairs[i].away)) continue
    for (let j = 0; j < pairs.length; j++) {
      if (j === i) continue
      // Swapping the away sides must leave BOTH affected matches rematch-free.
      if (
        !isRematch(pairs[i].home, pairs[j].away) &&
        !isRematch(pairs[j].home, pairs[i].away)
      ) {
        const tmp = pairs[i].away
        pairs[i].away = pairs[j].away
        pairs[j].away = tmp
        break
      }
    }
  }

  return pairs
}

// Generate the full Round-of-32 fixture list from the current group results.
// Throws a user-facing Error (Dutch message) when the data isn't ready.
// Returns an array of 16 fixtures ready to insert, each also carrying the
// resolved team objects so the caller can echo a readable preview.
export function buildRoundOf32() {
  const qualifiers = getQualifiers()

  if (!qualifiers.complete) {
    throw new Error(
      `Groepsfase nog niet volledig afgerond (${qualifiers.finishedCount}/${qualifiers.total} wedstrijden met uitslag). ` +
        'Vul eerst alle groepsuitslagen in.'
    )
  }
  if (qualifiers.groupKeys.length !== 12) {
    throw new Error(
      `Verwacht 12 groepen, maar ${qualifiers.groupKeys.length} gevonden. Ronde van 32 kan niet worden gegenereerd.`
    )
  }
  if (qualifiers.bestThirds.length < 8) {
    throw new Error('Onvoldoende nummers 3 om de beste 8 te bepalen.')
  }

  const seeds = seedOrder(qualifiers)
  const pairs = buildPairings(seeds)

  return pairs.map((pair, index) => ({
    home_team_id: pair.home.team.id,
    away_team_id: pair.away.team.id,
    match_datetime: scheduleFor(index),
    match_number: R32_FIRST_MATCH_NUMBER + index,
    venue: null,
    city: null,
    // Preview-only fields (not persisted as such):
    home_team: pair.home.team,
    away_team: pair.away.team,
    home_slot: pair.home.slot,
    away_slot: pair.away.slot,
  }))
}
