import express from 'express'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import { nowNaive } from '../utils/time.js'

const router = express.Router()

router.use(authenticate)

// GET /api/users/:id/profile
router.get('/:id/profile', (req, res) => {
  const user = db.prepare(`
    SELECT id, username, avatar, favorite_team, created_at
    FROM users WHERE id = ?
  `).get(req.params.id)

  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' })

  // Top 3 recent achievements
  const achievements = db.prepare(`
    SELECT ad.key, ad.name, ad.icon, ad.category, ad.rarity, a.unlocked_at
    FROM achievements a
    JOIN achievement_definitions ad ON a.achievement_key = ad.key
    WHERE a.user_id = ?
    ORDER BY a.unlocked_at DESC
    LIMIT 3
  `).all(req.params.id)

  // Stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_predictions,
      COUNT(CASE WHEN points_earned > 0 THEN 1 END) as correct_winners,
      COALESCE(SUM(points_earned), 0) as total_points
    FROM predictions
    WHERE user_id = ?
  `).get(req.params.id)

  const exactScores = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.user_id = ?
      AND m.status = 'finished'
      AND p.predicted_home = m.home_score
      AND p.predicted_away = m.away_score
  `).get(req.params.id)

  const achievementCount = db.prepare('SELECT COUNT(*) as cnt FROM achievements WHERE user_id = ?').get(req.params.id)

  res.json({
    user: {
      ...user,
      stats: {
        total_predictions: stats.total_predictions,
        correct_winners: stats.correct_winners,
        exact_scores: exactScores.cnt,
        total_points: stats.total_points,
        achievement_count: achievementCount.cnt,
      },
      recent_achievements: achievements,
    }
  })
})

// GET /api/users/:id/predictions
// Only show predictions after the match has started (match_datetime <= now)
router.get('/:id/predictions', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' })

  const now = nowNaive()

  const predictions = db.prepare(`
    SELECT
      p.*,
      m.match_datetime, m.status, m.home_score, m.away_score, m.group_name, m.venue,
      ht.name as home_team_name, ht.code as home_team_code, ht.flag_emoji as home_team_flag,
      at.name as away_team_name, at.code as away_team_code, at.flag_emoji as away_team_flag
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    LEFT JOIN teams ht ON m.home_team_id = ht.id
    LEFT JOIN teams at ON m.away_team_id = at.id
    WHERE p.user_id = ? AND m.match_datetime <= ?
    ORDER BY m.match_datetime ASC
  `).all(req.params.id, now)

  const enriched = predictions.map(p => ({
    ...p,
    home_team: { name: p.home_team_name, code: p.home_team_code, flag_emoji: p.home_team_flag },
    away_team: { name: p.away_team_name, code: p.away_team_code, flag_emoji: p.away_team_flag },
    is_correct: p.points_earned !== null && p.points_earned > 0,
  }))

  res.json({ predictions: enriched })
})

// GET /api/users/compare/:id1/:id2
router.get('/compare/:id1/:id2', (req, res) => {
  const { id1, id2 } = req.params
  const now = nowNaive()

  const user1 = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(id1)
  const user2 = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(id2)

  if (!user1 || !user2) return res.status(404).json({ error: 'Gebruiker niet gevonden' })

  // Get matches where both users have predictions and match has started
  const sharedMatches = db.prepare(`
    SELECT
      m.id as match_id, m.match_datetime, m.status, m.home_score, m.away_score,
      m.group_name, m.venue,
      ht.name as home_team_name, ht.code as home_team_code, ht.flag_emoji as home_team_flag,
      at.name as away_team_name, at.code as away_team_code, at.flag_emoji as away_team_flag,
      p1.predicted_home as user1_home, p1.predicted_away as user1_away, p1.points_earned as user1_points,
      p2.predicted_home as user2_home, p2.predicted_away as user2_away, p2.points_earned as user2_points
    FROM matches m
    JOIN predictions p1 ON p1.match_id = m.id AND p1.user_id = ?
    JOIN predictions p2 ON p2.match_id = m.id AND p2.user_id = ?
    LEFT JOIN teams ht ON m.home_team_id = ht.id
    LEFT JOIN teams at ON m.away_team_id = at.id
    WHERE m.match_datetime <= ?
    ORDER BY m.match_datetime ASC
  `).all(id1, id2, now)

  const compared = sharedMatches.map(m => ({
    match: {
      id: m.match_id,
      match_datetime: m.match_datetime,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      group_name: m.group_name,
      venue: m.venue,
      home_team: { name: m.home_team_name, code: m.home_team_code, flag_emoji: m.home_team_flag },
      away_team: { name: m.away_team_name, code: m.away_team_code, flag_emoji: m.away_team_flag },
    },
    user1_prediction: { home: m.user1_home, away: m.user1_away, points: m.user1_points },
    user2_prediction: { home: m.user2_home, away: m.user2_away, points: m.user2_points },
  }))

  // Totals
  const user1Total = db.prepare('SELECT COALESCE(SUM(points_earned), 0) as t FROM predictions WHERE user_id = ?').get(id1).t
  const user2Total = db.prepare('SELECT COALESCE(SUM(points_earned), 0) as t FROM predictions WHERE user_id = ?').get(id2).t

  res.json({
    user1: { ...user1, total_points: user1Total },
    user2: { ...user2, total_points: user2Total },
    matches: compared,
  })
})

export default router
