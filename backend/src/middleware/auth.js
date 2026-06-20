import jwt from 'jsonwebtoken'
import db from '../db/database.js'

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Geen toegang - log in' })
  }
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret')
    const user = db.prepare('SELECT id, username, avatar, favorite_team, role, tokens_valid_after FROM users WHERE id = ?').get(decoded.userId)
    if (!user) return res.status(401).json({ error: 'Gebruiker niet gevonden' })
    // Reject tokens issued before this user's session cutoff (set when an admin
    // forces a logout or a password is changed). `iat` is in seconds, as is the
    // stored timestamp. Tokens with no iat (shouldn't happen) are treated as old.
    if (user.tokens_valid_after && (decoded.iat ?? 0) < user.tokens_valid_after) {
      return res.status(401).json({ error: 'Sessie beëindigd - log opnieuw in' })
    }
    const { tokens_valid_after, ...safeUser } = user
    req.user = safeUser
    next()
  } catch {
    res.status(401).json({ error: 'Ongeldige of verlopen token' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin rechten vereist' })
  }
  next()
}
