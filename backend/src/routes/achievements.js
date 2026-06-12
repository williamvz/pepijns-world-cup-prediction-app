import express from 'express'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)

// GET /api/achievements
router.get('/', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt

  const definitions = db.prepare('SELECT * FROM achievement_definitions ORDER BY category, rarity').all()

  // Get this user's unlocked achievements
  const unlocked = db.prepare(`
    SELECT achievement_key, unlocked_at FROM achievements WHERE user_id = ?
  `).all(req.user.id)
  const unlockedMap = {}
  for (const a of unlocked) unlockedMap[a.achievement_key] = a.unlocked_at

  // Get unlock counts per achievement (for percentage)
  const countRows = db.prepare(`
    SELECT achievement_key, COUNT(*) as cnt FROM achievements GROUP BY achievement_key
  `).all()
  const countMap = {}
  for (const r of countRows) countMap[r.achievement_key] = r.cnt

  const result = definitions.map(def => ({
    ...def,
    unlocked_at: unlockedMap[def.key] || null,
    is_unlocked: !!unlockedMap[def.key],
    unlock_percentage: totalUsers > 0
      ? Math.round(((countMap[def.key] || 0) / totalUsers) * 100)
      : 0,
  }))

  res.json({ achievements: result })
})

// GET /api/achievements/mine
router.get('/mine', (req, res) => {
  const achievements = db.prepare(`
    SELECT ad.*, a.unlocked_at
    FROM achievements a
    JOIN achievement_definitions ad ON a.achievement_key = ad.key
    WHERE a.user_id = ?
    ORDER BY a.unlocked_at DESC
  `).all(req.user.id)

  res.json({ achievements })
})

export default router
