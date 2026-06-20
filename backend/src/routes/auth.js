import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db/database.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d'

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// POST /api/auth/register
// Public registration is disabled by design — only an admin creates accounts
// (via POST /api/admin/users). This endpoint stays as an explicit 403 so any
// direct API call is rejected rather than silently creating a user.
router.post('/register', (req, res) => {
  return res.status(403).json({
    error: 'Registratie is uitgeschakeld. Vraag de beheerder om een account aan te maken.',
  })
})

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' })
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username)
  if (!user) {
    return res.status(401).json({ error: 'Ongeldige inloggegevens' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Ongeldige inloggegevens' })
  }

  const token = generateToken(user.id)
  const { password_hash, ...safeUser } = user

  res.json({ token, user: safeUser })
})

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

// PUT /api/auth/me
router.put('/me', authenticate, (req, res) => {
  const { avatar, favorite_team } = req.body

  db.prepare(`
    UPDATE users SET avatar = ?, favorite_team = ? WHERE id = ?
  `).run(
    avatar !== undefined ? avatar : req.user.avatar,
    favorite_team !== undefined ? favorite_team : req.user.favorite_team,
    req.user.id
  )

  const updated = db.prepare('SELECT id, username, avatar, favorite_team, role FROM users WHERE id = ?').get(req.user.id)
  res.json({ user: updated })
})

export default router
