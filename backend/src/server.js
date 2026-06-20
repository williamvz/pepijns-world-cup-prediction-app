import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

import authRouter from './routes/auth.js'
import matchesRouter from './routes/matches.js'
import predictionsRouter from './routes/predictions.js'
import leaderboardRouter from './routes/leaderboard.js'
import achievementsRouter from './routes/achievements.js'
import adminRouter from './routes/admin.js'
import usersRouter from './routes/users.js'
import bonusRouter from './routes/bonus.js'
import notificationsRouter from './routes/notifications.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// Warn loudly when running on the built-in fallback secret: with it, anyone can
// forge a valid (admin) token, and rotating it is also the quickest way to
// invalidate every existing session at once.
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET niet ingesteld — er wordt een onveilig standaard secret gebruikt.')
  console.warn('   Stel JWT_SECRET in op een lang, willekeurig geheim. Het wijzigen ervan logt iedereen direct uit.')
}

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/auth', authRouter)
app.use('/api/matches', matchesRouter)
app.use('/api/predictions', predictionsRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/achievements', achievementsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/users', usersRouter)
app.use('/api/bonus', bonusRouter)
app.use('/api/notifications', notificationsRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve frontend static files
const publicDir = join(__dirname, '../public')
if (existsSync(publicDir)) {
  app.use(express.static(publicDir))
  app.get('*', (req, res) => {
    res.sendFile(join(publicDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`⚽ WK Pool server draait op poort ${PORT}`)
})

export default app
