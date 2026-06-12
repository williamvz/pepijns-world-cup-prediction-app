import express from 'express'
import db from '../db/database.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { processMatchResult } from '../services/scoring.js'
import { nowNaive } from '../utils/time.js'

const router = express.Router()

// Locked 30 min before kickoff, compared as naive Amsterdam wall-clock strings.
function isMatchLocked(matchDatetime) {
  return matchDatetime <= nowNaive(30 * 60 * 1000)
}

function enrichMatch(match) {
  return {
    ...match,
    is_locked: isMatchLocked(match.match_datetime),
  }
}

const matchWithTeamsSQL = `
  SELECT
    m.*,
    ht.id as home_team_id, ht.name as home_team_name, ht.code as home_team_code,
    ht.flag_emoji as home_team_flag, ht.group_name as home_team_group,
    at.id as away_team_id, at.name as away_team_name, at.code as away_team_code,
    at.flag_emoji as away_team_flag, at.group_name as away_team_group,
    ph.name as phase_name, ph.multiplier as phase_multiplier, ph.is_unlocked as phase_is_unlocked
  FROM matches m
  LEFT JOIN teams ht ON m.home_team_id = ht.id
  LEFT JOIN teams at ON m.away_team_id = at.id
  LEFT JOIN phases ph ON m.phase_id = ph.id
`

function formatMatch(row) {
  return {
    id: row.id,
    phase_id: row.phase_id,
    phase_name: row.phase_name,
    phase_multiplier: row.phase_multiplier,
    phase_is_unlocked: row.phase_is_unlocked,
    group_name: row.group_name,
    match_datetime: row.match_datetime,
    venue: row.venue,
    city: row.city,
    status: row.status,
    home_score: row.home_score,
    away_score: row.away_score,
    match_number: row.match_number,
    is_locked: isMatchLocked(row.match_datetime),
    home_team: {
      id: row.home_team_id,
      name: row.home_team_name,
      code: row.home_team_code,
      flag_emoji: row.home_team_flag,
    },
    away_team: {
      id: row.away_team_id,
      name: row.away_team_name,
      code: row.away_team_code,
      flag_emoji: row.away_team_flag,
    },
  }
}

// GET /api/matches
router.get('/', (req, res) => {
  const rows = db.prepare(matchWithTeamsSQL + ' ORDER BY m.match_datetime ASC').all()
  const matches = rows.map(formatMatch)

  // Group by phase, then by group_name
  const grouped = {}
  for (const match of matches) {
    const phaseKey = match.phase_name || 'Unknown Phase'
    if (!grouped[phaseKey]) grouped[phaseKey] = { phase_name: phaseKey, groups: {} }
    const groupKey = match.group_name || 'Knockout'
    if (!grouped[phaseKey].groups[groupKey]) grouped[phaseKey].groups[groupKey] = []
    grouped[phaseKey].groups[groupKey].push(match)
  }

  // Convert to array format
  const result = Object.values(grouped).map(phase => ({
    phase_name: phase.phase_name,
    groups: Object.entries(phase.groups).map(([group_name, matches]) => ({
      group_name,
      matches,
    })),
  }))

  res.json({ matches: result, flat: matches })
})

// GET /api/matches/upcoming
router.get('/upcoming', (req, res) => {
  const cutoff = nowNaive(30 * 60 * 1000)
  const rows = db.prepare(matchWithTeamsSQL + `
    WHERE m.status = 'scheduled' AND m.match_datetime > ?
    ORDER BY m.match_datetime ASC
    LIMIT 5
  `).all(cutoff)

  res.json({ matches: rows.map(formatMatch) })
})

// GET /api/matches/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(matchWithTeamsSQL + ' WHERE m.id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })
  res.json({ match: formatMatch(row) })
})

// PUT /api/matches/:id/result
router.put('/:id/result', authenticate, requireAdmin, (req, res) => {
  const { home_score, away_score } = req.body

  if (home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: 'home_score en away_score zijn verplicht' })
  }

  if (!Number.isInteger(Number(home_score)) || !Number.isInteger(Number(away_score))) {
    return res.status(400).json({ error: 'Scores moeten gehele getallen zijn' })
  }

  const matchRow = db.prepare(matchWithTeamsSQL + ' WHERE m.id = ?').get(req.params.id)
  if (!matchRow) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })

  db.prepare(`
    UPDATE matches SET home_score = ?, away_score = ?, status = 'finished' WHERE id = ?
  `).run(Number(home_score), Number(away_score), req.params.id)

  processMatchResult(Number(req.params.id))

  // Notify all users
  const match = formatMatch(matchRow)
  const message = `Uitslag: ${match.home_team.name} ${home_score}-${away_score} ${match.away_team.name}`
  const users = db.prepare('SELECT id FROM users').all()
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'result')
  `)
  const notifyAll = db.transaction(() => {
    for (const user of users) insertNotif.run(user.id, message)
  })
  notifyAll()

  const updatedRow = db.prepare(matchWithTeamsSQL + ' WHERE m.id = ?').get(req.params.id)
  res.json({ match: formatMatch(updatedRow) })
})

export default router
