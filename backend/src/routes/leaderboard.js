import express from 'express'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import { todayNaiveRange } from '../utils/time.js'

const router = express.Router()

router.use(authenticate)

// GET /api/leaderboard
router.get('/', (req, res) => {
  // Aggregate predictions and bonus separately, then join. Joining both
  // directly to users would produce a cartesian product (each prediction row
  // multiplied by each bonus row), inflating every total once a player has
  // both predictions and bonus predictions.
  const rows = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.avatar,
      u.favorite_team,
      u.role,
      COALESCE(pred.pts, 0) as prediction_points,
      COALESCE(bon.pts, 0) as bonus_points,
      COALESCE(pred.pts, 0) + COALESCE(bon.pts, 0) as total_points,
      COALESCE(pred.correct, 0) as correct_winners,
      COALESCE(pred.scored, 0) as scored_predictions,
      COALESCE(pred.exact, 0) as exact_scores
    FROM users u
    LEFT JOIN (
      SELECT
        p.user_id,
        SUM(p.points_earned) as pts,
        COUNT(CASE WHEN p.points_earned > 0 THEN 1 END) as correct,
        COUNT(CASE WHEN p.points_earned IS NOT NULL THEN 1 END) as scored,
        SUM(CASE WHEN m.status = 'finished'
                  AND p.predicted_home = m.home_score
                  AND p.predicted_away = m.away_score
                 THEN 1 ELSE 0 END) as exact
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      GROUP BY p.user_id
    ) pred ON pred.user_id = u.id
    LEFT JOIN (
      SELECT user_id, SUM(points_earned) as pts
      FROM bonus_predictions
      GROUP BY user_id
    ) bon ON bon.user_id = u.id
    ORDER BY total_points DESC, exact_scores DESC, correct_winners DESC, u.username ASC
  `).all()

  const leaderboard = rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    favorite_team: row.favorite_team,
    total_points: row.total_points,
    prediction_points: row.prediction_points,
    bonus_points: row.bonus_points,
    correct_winners: row.correct_winners,
    exact_scores: row.exact_scores,
    scored_predictions: row.scored_predictions,
  }))

  res.json({ leaderboard })
})

// GET /api/leaderboard/stats
router.get('/stats', (req, res) => {
  const { start: todayStart, end: todayEnd } = todayNaiveRange()

  // Best predictor of the day: user with most points earned today (from matches that finished today)
  const bestToday = db.prepare(`
    SELECT
      u.id, u.username, u.avatar,
      COALESCE(SUM(p.points_earned), 0) as points_today
    FROM users u
    JOIN predictions p ON p.user_id = u.id
    JOIN matches m ON p.match_id = m.id
    WHERE m.status = 'finished'
      AND m.match_datetime >= ?
      AND m.match_datetime <= ?
      AND p.points_earned IS NOT NULL
    GROUP BY u.id
    ORDER BY points_today DESC
    LIMIT 1
  `).get(todayStart, todayEnd)

  // Total stats
  const totals = db.prepare(`
    SELECT
      COUNT(DISTINCT u.id) as total_players,
      COUNT(p.id) as total_predictions,
      COALESCE(SUM(p.points_earned), 0) as total_points_all
    FROM users u
    LEFT JOIN predictions p ON p.user_id = u.id
  `).get()

  res.json({
    best_predictor_today: bestToday || null,
    totals,
  })
})

export default router
