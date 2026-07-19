import express from 'express'
import bcrypt from 'bcryptjs'
import db from '../db/database.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { processMatchResult } from '../services/scoring.js'
import { buildRound, readyToGenerate, readyToRegenerate, GENERATABLE_PHASES } from '../services/bracket.js'
import { nowNaive } from '../utils/time.js'

const router = express.Router()

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin)

// GET /api/admin/dashboard
router.get('/dashboard', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt
  const totalMatches = db.prepare('SELECT COUNT(*) as cnt FROM matches').get().cnt
  const totalPredictions = db.prepare('SELECT COUNT(*) as cnt FROM predictions').get().cnt

  // Per match prediction coverage
  const matchCoverage = db.prepare(`
    SELECT
      m.id, m.match_datetime, m.status, m.group_name, m.venue,
      ht.name as home_team, at.name as away_team,
      COUNT(p.id) as prediction_count
    FROM matches m
    LEFT JOIN teams ht ON m.home_team_id = ht.id
    LEFT JOIN teams at ON m.away_team_id = at.id
    LEFT JOIN predictions p ON m.id = p.match_id
    GROUP BY m.id
    ORDER BY m.match_datetime ASC
  `).all()

  // Upcoming matches needing attention (next 3 days, no result yet)
  const upcomingThreshold = nowNaive(3 * 24 * 60 * 60 * 1000)
  const upcomingMatches = db.prepare(`
    SELECT m.id, m.match_datetime, m.status, m.group_name,
      ht.name as home_team, at.name as away_team
    FROM matches m
    LEFT JOIN teams ht ON m.home_team_id = ht.id
    LEFT JOIN teams at ON m.away_team_id = at.id
    WHERE m.status != 'finished' AND m.match_datetime <= ?
    ORDER BY m.match_datetime ASC
  `).all(upcomingThreshold)

  res.json({
    stats: {
      total_users: totalUsers,
      total_matches: totalMatches,
      total_predictions: totalPredictions,
    },
    match_coverage: matchCoverage.map(m => ({ ...m, total_users: totalUsers })),
    upcoming_attention: upcomingMatches,
  })
})

// POST /api/admin/users - Create a new user
router.post('/users', (req, res) => {
  const { username, password, avatar = 'ball1', favorite_team = '', role = 'player' } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' })
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Gebruikersnaam moet 3-20 tekens zijn' })
  if (password.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' })
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return res.status(409).json({ error: 'Gebruikersnaam is al bezet' })
  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare('INSERT INTO users (username, password_hash, avatar, favorite_team, role) VALUES (?, ?, ?, ?, ?)').run(username, hash, avatar, favorite_team, role)
  const user = db.prepare('SELECT id, username, avatar, favorite_team, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ user })
})

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT
      u.id, u.username, u.avatar, u.favorite_team, u.role, u.created_at,
      COUNT(p.id) as prediction_count,
      COALESCE(SUM(p.points_earned), 0) as total_points
    FROM users u
    LEFT JOIN predictions p ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all()

  res.json({ users })
})

// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  const { password, role, avatar, favorite_team } = req.body
  const userId = req.params.id

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' })

  if (role && !['admin', 'player'].includes(role)) {
    return res.status(400).json({ error: 'Ongeldige rol' })
  }

  // The game always needs at least one admin. Block demoting the last one.
  if (role === 'player' && user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get().cnt
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Er moet altijd minstens één admin zijn' })
    }
  }

  let updates = []
  let params = []

  if (password) {
    updates.push('password_hash = ?')
    params.push(bcrypt.hashSync(password, 10))
    // A new password must end any sessions opened with the old one. Stamping the
    // session cutoff at "now" invalidates every token this user already holds.
    updates.push('tokens_valid_after = ?')
    params.push(Math.floor(Date.now() / 1000))
  }
  if (role !== undefined) {
    updates.push('role = ?')
    params.push(role)
  }
  if (avatar !== undefined) {
    updates.push('avatar = ?')
    params.push(avatar)
  }
  if (favorite_team !== undefined) {
    updates.push('favorite_team = ?')
    params.push(favorite_team)
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Geen velden om bij te werken' })
  }

  params.push(userId)
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const updated = db.prepare('SELECT id, username, avatar, favorite_team, role, created_at FROM users WHERE id = ?').get(userId)
  res.json({ user: updated })
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const userId = Number(req.params.id)

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' })
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' })

  // Delete cascade manually (foreign keys are ON but no CASCADE defined)
  const deleteUser = db.transaction(() => {
    db.prepare('DELETE FROM achievements WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM bonus_predictions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM predictions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  })
  deleteUser()

  res.json({ success: true, message: 'Gebruiker verwijderd' })
})

// POST /api/admin/users/:id/logout - Force a single user to log in again
// Invalidates every token that user currently holds by moving their session
// cutoff to now. Useful when one account may be compromised.
router.post('/users/:id/logout', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' })

  db.prepare('UPDATE users SET tokens_valid_after = ? WHERE id = ?')
    .run(Math.floor(Date.now() / 1000), req.params.id)

  res.json({ success: true, message: 'Gebruiker wordt uitgelogd op het volgende verzoek' })
})

// POST /api/admin/logout-all - Force every user (including the caller) to log in
// again. The fastest way to clear out sessions opened with leaked credentials.
router.post('/logout-all', (req, res) => {
  const result = db.prepare('UPDATE users SET tokens_valid_after = ?')
    .run(Math.floor(Date.now() / 1000))

  res.json({
    success: true,
    message: `${result.changes} gebruiker(s) worden uitgelogd. Iedereen moet opnieuw inloggen.`,
    affected: result.changes,
  })
})

// GET /api/admin/phases
router.get('/phases', (req, res) => {
  const phases = db.prepare(`
    SELECT
      ph.*,
      COUNT(m.id) as match_count,
      COUNT(CASE WHEN m.status = 'finished' THEN 1 END) as finished_count
    FROM phases ph
    LEFT JOIN matches m ON m.phase_id = ph.id
    GROUP BY ph.id
    ORDER BY ph.unlock_order ASC
  `).all()

  // `can_generate` tells the admin UI whether this round can be auto-built right
  // now (no matches yet + the round it derives from is fully played).
  // `can_regenerate` flags a round that already has fixtures but can still be
  // safely rebuilt (no predictions/results yet) — e.g. to fix a wrong draw.
  const enriched = phases.map((ph) => ({
    ...ph,
    can_generate: readyToGenerate(ph.name),
    can_regenerate: readyToRegenerate(ph.name),
  }))

  res.json({ phases: enriched })
})

// PUT /api/admin/phases/:id/unlock
router.put('/phases/:id/unlock', (req, res) => {
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(req.params.id)
  if (!phase) return res.status(404).json({ error: 'Fase niet gevonden' })

  db.prepare('UPDATE phases SET is_unlocked = 1 WHERE id = ?').run(req.params.id)

  // Notify all users
  const message = `Nieuwe fase beschikbaar: ${phase.name}`
  const users = db.prepare('SELECT id FROM users').all()
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'phase_unlock')
  `)
  const notifyAll = db.transaction(() => {
    for (const user of users) insertNotif.run(user.id, message)
  })
  notifyAll()

  const updated = db.prepare('SELECT * FROM phases WHERE id = ?').get(req.params.id)
  res.json({ phase: updated })
})

// Insert a freshly built set of fixtures for a phase. When `replace` is set the
// phase's current matches are deleted first (used by regenerate); the whole thing
// runs in one transaction so a phase is never left half-populated.
function writeFixtures(phaseId, fixtures, { replace = false } = {}) {
  const insertMatch = db.prepare(`
    INSERT INTO matches
      (phase_id, group_name, home_team_id, away_team_id, match_datetime, venue, city, status, home_score, away_score, match_number)
    VALUES (?, NULL, ?, ?, ?, ?, ?, 'scheduled', NULL, NULL, ?)
  `)
  const run = db.transaction(() => {
    if (replace) db.prepare('DELETE FROM matches WHERE phase_id = ?').run(phaseId)
    for (const f of fixtures) {
      insertMatch.run(phaseId, f.home_team_id, f.away_team_id, f.match_datetime, f.venue, f.city, f.match_number)
    }
  })
  run()
}

// Shape fixtures for the JSON response so the admin sees what was created.
function summariseFixtures(fixtures) {
  return fixtures.map((f) => ({
    match_number: f.match_number,
    match_datetime: f.match_datetime,
    home_team: f.home_team.name,
    home_slot: f.home_slot,
    away_team: f.away_team.name,
    away_slot: f.away_slot,
  }))
}

// POST /api/admin/phases/:id/generate
// Compute the bracket for a knockout phase from the results already in the
// database and create its matches. The Round of 32 is built from the finished
// group stage (12 winners + 12 runners-up + 8 best thirds); every later round is
// built from the winners (or, for the third-place match, the losers) of the
// matches it derives from. Guarded so it can never run twice or before its source
// round is decided.
router.post('/phases/:id/generate', (req, res) => {
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(req.params.id)
  if (!phase) return res.status(404).json({ error: 'Fase niet gevonden' })

  if (!GENERATABLE_PHASES.includes(phase.name)) {
    return res.status(400).json({
      error: `Automatisch genereren is niet beschikbaar voor "${phase.name}".`,
    })
  }

  const existing = db
    .prepare('SELECT COUNT(*) AS c FROM matches WHERE phase_id = ?')
    .get(phase.id).c
  if (existing > 0) {
    return res.status(400).json({
      error: `Er bestaan al ${existing} wedstrijden voor deze fase. Gebruik "Genereer opnieuw" om ze te vervangen.`,
    })
  }

  let fixtures
  try {
    fixtures = buildRound(phase.name)
  } catch (err) {
    // buildRound throws a ready-to-show Dutch message when the data isn't ready.
    return res.status(400).json({ error: err.message })
  }

  writeFixtures(phase.id, fixtures)

  res.status(201).json({
    message: `${fixtures.length} wedstrijden aangemaakt voor ${phase.name}.`,
    matches: summariseFixtures(fixtures),
  })
})

// POST /api/admin/phases/:id/regenerate
// Rebuild a knockout phase that was generated with the wrong fixtures. Only
// allowed when the existing matches carry no predictions and no results, so
// nothing players entered is ever lost.
router.post('/phases/:id/regenerate', (req, res) => {
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(req.params.id)
  if (!phase) return res.status(404).json({ error: 'Fase niet gevonden' })

  if (!GENERATABLE_PHASES.includes(phase.name)) {
    return res.status(400).json({ error: `Opnieuw genereren is niet beschikbaar voor "${phase.name}".` })
  }

  const matches = db.prepare('SELECT id, status FROM matches WHERE phase_id = ?').all(phase.id)
  if (matches.length === 0) {
    return res.status(400).json({
      error: 'Er zijn nog geen wedstrijden voor deze fase. Gebruik "Genereer wedstrijden".',
    })
  }
  if (matches.some((m) => m.status === 'finished' || m.status === 'live')) {
    return res.status(400).json({
      error: 'Er zijn al uitslagen ingevoerd voor deze fase. Opnieuw genereren is geblokkeerd om resultaten te beschermen.',
    })
  }
  const ids = matches.map((m) => m.id)
  const placeholders = ids.map(() => '?').join(',')
  const predCount = db
    .prepare(`SELECT COUNT(*) AS c FROM predictions WHERE match_id IN (${placeholders})`)
    .get(...ids).c
  if (predCount > 0) {
    return res.status(400).json({
      error: `Er zijn al ${predCount} voorspelling(en) op deze wedstrijden. Opnieuw genereren zou die wissen en is daarom geblokkeerd.`,
    })
  }

  let fixtures
  try {
    fixtures = buildRound(phase.name)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  writeFixtures(phase.id, fixtures, { replace: true })

  res.status(201).json({
    message: `${fixtures.length} wedstrijden opnieuw aangemaakt voor ${phase.name}.`,
    matches: summariseFixtures(fixtures),
  })
})

// PUT /api/admin/matches/:id
router.put('/matches/:id', (req, res) => {
  const { match_datetime, venue, city, status, home_score, away_score, winner_team_id } = req.body
  const matchId = req.params.id

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId)
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })

  if (status && !['scheduled', 'live', 'finished'].includes(status)) {
    return res.status(400).json({ error: 'Ongeldige status' })
  }

  let updates = []
  let params = []

  if (match_datetime !== undefined) { updates.push('match_datetime = ?'); params.push(match_datetime) }
  if (venue !== undefined) { updates.push('venue = ?'); params.push(venue) }
  if (city !== undefined) { updates.push('city = ?'); params.push(city) }
  if (status !== undefined) { updates.push('status = ?'); params.push(status) }
  if (home_score !== undefined) { updates.push('home_score = ?'); params.push(home_score) }
  if (away_score !== undefined) { updates.push('away_score = ?'); params.push(away_score) }

  // Record (or clear) the penalty-shootout winner whenever a score is saved.
  // It only applies to a level score; a decisive result clears any stale winner.
  if (home_score !== undefined && away_score !== undefined) {
    const isDraw = Number(home_score) === Number(away_score)
    let winner = null
    if (isDraw && winner_team_id != null) {
      if (![match.home_team_id, match.away_team_id].includes(Number(winner_team_id))) {
        return res.status(400).json({ error: 'Ongeldige winnaar voor strafschoppen' })
      }
      winner = Number(winner_team_id)
    }
    updates.push('winner_team_id = ?'); params.push(winner)
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Geen velden om bij te werken' })
  }

  params.push(matchId)
  db.prepare(`UPDATE matches SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  // Recalculate points and notify users when a score is saved
  if (home_score !== undefined && away_score !== undefined) {
    processMatchResult(matchId)

    const saved = db.prepare(`
      SELECT m.*, ht.name as home_name, at.name as away_name
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      WHERE m.id = ?
    `).get(matchId)

    if (saved) {
      const message = `Uitslag: ${saved.home_name} ${saved.home_score}-${saved.away_score} ${saved.away_name}`
      const users = db.prepare('SELECT id FROM users').all()
      const insertNotif = db.prepare(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'result')`)
      const notifyAll = db.transaction(() => {
        for (const user of users) insertNotif.run(user.id, message)
      })
      notifyAll()
    }
  }

  const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId)
  res.json({ match: updated })
})

// GET /api/admin/bonus - overview of champion/topscorer predictions for evaluation
router.get('/bonus', (req, res) => {
  const rows = db.prepare(`
    SELECT bp.*, u.username, u.avatar
    FROM bonus_predictions bp
    JOIN users u ON u.id = bp.user_id
    ORDER BY u.username COLLATE NOCASE ASC
  `).all()

  function summarise(type) {
    const predictions = rows.filter((r) => r.type === type)
    const evaluated = predictions.some((r) => r.is_correct !== null)

    const tally = {}
    for (const p of predictions) {
      tally[p.predicted_value] = (tally[p.predicted_value] || 0) + 1
    }
    const tallied = Object.entries(tally)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)

    return { predictions, evaluated, tally: tallied }
  }

  res.json({
    champion: summarise('champion'),
    topscorer: summarise('topscorer'),
  })
})

// POST /api/admin/bonus/evaluate
router.post('/bonus/evaluate', (req, res) => {
  const { type, correct_value } = req.body

  if (!type || !['champion', 'topscorer'].includes(type)) {
    return res.status(400).json({ error: 'type moet champion of topscorer zijn' })
  }

  if (!correct_value) {
    return res.status(400).json({ error: 'correct_value is verplicht' })
  }

  const points = type === 'champion' ? 10 : 5

  // Mark all predictions for this type
  const bonusPredictions = db.prepare('SELECT * FROM bonus_predictions WHERE type = ?').all(type)

  const evaluateAll = db.transaction(() => {
    for (const bp of bonusPredictions) {
      const isCorrect = bp.predicted_value.toLowerCase() === correct_value.toLowerCase() ? 1 : 0
      const earnedPoints = isCorrect ? points : 0
      db.prepare(`
        UPDATE bonus_predictions SET is_correct = ?, points_earned = ? WHERE id = ?
      `).run(isCorrect, earnedPoints, bp.id)

      if (isCorrect) {
        // Notify winner
        db.prepare(`
          INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'bonus_correct')
        `).run(bp.user_id, `Jouw bonusvoorspelling (${type}) was correct! +${points} punten`)
      }
    }
  })
  evaluateAll()

  const updated = db.prepare('SELECT * FROM bonus_predictions WHERE type = ?').all(type)
  res.json({
    message: `${updated.length} bonusvoorspellingen geëvalueerd`,
    correct_value,
    type,
    results: updated,
  })
})

export default router
