import express from 'express'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)

// GET /api/notifications
router.get('/', (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(req.user.id)

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(req.user.id)

  res.json({ notifications, unread_count: unreadCount.cnt })
})

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  const notification = db.prepare(`
    SELECT * FROM notifications WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id)

  if (!notification) {
    return res.status(404).json({ error: 'Notificatie niet gevonden' })
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id)

  const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id)
  res.json({ notification: updated })
})

// PUT /api/notifications/read-all
router.put('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id)
  res.json({ success: true, message: 'Alle notificaties gemarkeerd als gelezen' })
})

export default router
