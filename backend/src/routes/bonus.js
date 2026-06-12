import express from 'express'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'
import { checkAchievements } from '../services/achievements.js'
import { nowNaive } from '../utils/time.js'

const router = express.Router()

router.use(authenticate)

// GET /api/bonus
router.get('/', (req, res) => {
  const bonusPredictions = db.prepare(`
    SELECT * FROM bonus_predictions WHERE user_id = ?
    ORDER BY submitted_at DESC
  `).all(req.user.id)

  res.json({ bonus_predictions: bonusPredictions })
})

// POST /api/bonus
router.post('/', (req, res) => {
  const { type, predicted_value } = req.body

  if (!type || !['champion', 'topscorer'].includes(type)) {
    return res.status(400).json({ error: 'type moet champion of topscorer zijn' })
  }

  if (!predicted_value || predicted_value.trim() === '') {
    return res.status(400).json({ error: 'predicted_value is verplicht' })
  }

  // For champion: only allowed before tournament starts
  if (type === 'champion') {
    const firstMatch = db.prepare(`
      SELECT match_datetime FROM matches ORDER BY match_datetime ASC LIMIT 1
    `).get()

    if (firstMatch && nowNaive() >= firstMatch.match_datetime) {
      return res.status(400).json({
        error: 'Kampioen voorspelling is gesloten - het toernooi is al begonnen'
      })
    }
  }

  // Upsert bonus prediction
  db.prepare(`
    INSERT INTO bonus_predictions (user_id, type, predicted_value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, type) DO UPDATE SET
      predicted_value = excluded.predicted_value,
      submitted_at = current_timestamp
  `).run(req.user.id, type, predicted_value.trim())

  checkAchievements(req.user.id)

  const prediction = db.prepare('SELECT * FROM bonus_predictions WHERE user_id = ? AND type = ?').get(req.user.id, type)
  res.status(201).json({ bonus_prediction: prediction })
})

export default router
