import express from 'express'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import { checkAchievements } from '../services/achievements.js'
import { nowNaive } from '../utils/time.js'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Locked from 30 min before kickoff. Compared as naive Amsterdam wall-clock
// strings so it is correct regardless of the server timezone.
function isMatchLocked(matchDatetime) {
  return matchDatetime <= nowNaive(30 * 60 * 1000)
}

// GET /api/predictions
router.get('/', (req, res) => {
  const predictions = db.prepare(`
    SELECT
      p.*,
      m.match_datetime, m.status, m.home_score, m.away_score, m.group_name, m.venue, m.city,
      ht.name as home_team_name, ht.code as home_team_code, ht.flag_emoji as home_team_flag,
      at.name as away_team_name, at.code as away_team_code, at.flag_emoji as away_team_flag,
      ph.multiplier as phase_multiplier, ph.name as phase_name
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    LEFT JOIN teams ht ON m.home_team_id = ht.id
    LEFT JOIN teams at ON m.away_team_id = at.id
    LEFT JOIN phases ph ON m.phase_id = ph.id
    WHERE p.user_id = ?
    ORDER BY m.match_datetime ASC
  `).all(req.user.id)

  const enriched = predictions.map(p => ({
    ...p,
    is_correct: p.points_earned !== null && p.points_earned > 0,
    is_exact: p.status === 'finished' && p.predicted_home === p.home_score && p.predicted_away === p.away_score,
    home_team: { name: p.home_team_name, code: p.home_team_code, flag_emoji: p.home_team_flag },
    away_team: { name: p.away_team_name, code: p.away_team_code, flag_emoji: p.away_team_flag },
  }))

  res.json({ predictions: enriched })
})

// GET /api/predictions/summary
router.get('/summary', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_predictions,
      COUNT(CASE WHEN points_earned > 0 THEN 1 END) as correct_winners,
      COUNT(CASE WHEN points_earned IS NOT NULL THEN 1 END) as scored_predictions,
      COALESCE(SUM(points_earned), 0) as total_points
    FROM predictions
    WHERE user_id = ?
  `).get(req.user.id)

  const exactScores = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.user_id = ?
      AND m.status = 'finished'
      AND p.predicted_home = m.home_score
      AND p.predicted_away = m.away_score
  `).get(req.user.id)

  // Bonus points count toward the player's grand total (matches the leaderboard).
  const bonus = db.prepare(`
    SELECT COALESCE(SUM(points_earned), 0) as pts FROM bonus_predictions WHERE user_id = ?
  `).get(req.user.id)

  res.json({
    summary: {
      total_predictions: stats.total_predictions,
      correct_winners: stats.correct_winners,
      exact_scores: exactScores.cnt,
      prediction_points: stats.total_points,
      bonus_points: bonus.pts,
      total_points: stats.total_points + bonus.pts,
    }
  })
})

// GET /api/predictions/match/:matchId
router.get('/match/:matchId', (req, res) => {
  const prediction = db.prepare(`
    SELECT p.*, m.match_datetime
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.user_id = ? AND p.match_id = ?
  `).get(req.user.id, req.params.matchId)

  if (!prediction) {
    return res.status(404).json({ error: 'Geen voorspelling gevonden voor deze wedstrijd' })
  }

  res.json({ prediction })
})

// POST /api/predictions
router.post('/', (req, res) => {
  const { match_id, predicted_home, predicted_away } = req.body

  if (!match_id || predicted_home === undefined || predicted_away === undefined) {
    return res.status(400).json({ error: 'match_id, predicted_home en predicted_away zijn verplicht' })
  }

  if (!Number.isInteger(Number(predicted_home)) || !Number.isInteger(Number(predicted_away))) {
    return res.status(400).json({ error: 'Scores moeten gehele getallen zijn' })
  }

  if (Number(predicted_home) < 0 || Number(predicted_away) < 0) {
    return res.status(400).json({ error: 'Scores kunnen niet negatief zijn' })
  }

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id)
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })

  if (isMatchLocked(match.match_datetime)) {
    return res.status(400).json({ error: 'Voorspelling vergrendeld - wedstrijd begint bijna of is al begonnen' })
  }

  db.prepare(`
    INSERT INTO predictions (user_id, match_id, predicted_home, predicted_away)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, match_id) DO UPDATE SET
      predicted_home = excluded.predicted_home,
      predicted_away = excluded.predicted_away,
      submitted_at = current_timestamp
  `).run(req.user.id, match_id, Number(predicted_home), Number(predicted_away))

  checkAchievements(req.user.id)

  const prediction = db.prepare('SELECT * FROM predictions WHERE user_id = ? AND match_id = ?').get(req.user.id, match_id)
  res.status(201).json({ prediction })
})

// PUT /api/predictions/:matchId
router.put('/:matchId', (req, res) => {
  const { predicted_home, predicted_away } = req.body
  const match_id = req.params.matchId

  if (predicted_home === undefined || predicted_away === undefined) {
    return res.status(400).json({ error: 'predicted_home en predicted_away zijn verplicht' })
  }

  if (!Number.isInteger(Number(predicted_home)) || !Number.isInteger(Number(predicted_away))) {
    return res.status(400).json({ error: 'Scores moeten gehele getallen zijn' })
  }

  if (Number(predicted_home) < 0 || Number(predicted_away) < 0) {
    return res.status(400).json({ error: 'Scores kunnen niet negatief zijn' })
  }

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id)
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })

  if (isMatchLocked(match.match_datetime)) {
    return res.status(400).json({ error: 'Voorspelling vergrendeld - wedstrijd begint bijna of is al begonnen' })
  }

  db.prepare(`
    INSERT INTO predictions (user_id, match_id, predicted_home, predicted_away)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, match_id) DO UPDATE SET
      predicted_home = excluded.predicted_home,
      predicted_away = excluded.predicted_away,
      submitted_at = current_timestamp
  `).run(req.user.id, match_id, Number(predicted_home), Number(predicted_away))

  checkAchievements(req.user.id)

  const prediction = db.prepare('SELECT * FROM predictions WHERE user_id = ? AND match_id = ?').get(req.user.id, match_id)
  res.json({ prediction })
})

export default router
