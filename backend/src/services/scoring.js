import db from '../db/database.js'
import { checkAchievements } from './achievements.js'

export function calculatePoints(predictedHome, predictedAway, actualHome, actualAway, multiplier = 1) {
  const getResult = (home, away) => {
    if (home > away) return 'home'
    if (away > home) return 'away'
    return 'draw'
  }

  const getGoalDiff = (home, away) => home - away

  const predictedResult = getResult(predictedHome, predictedAway)
  const actualResult = getResult(actualHome, actualAway)
  const predictedDiff = getGoalDiff(predictedHome, predictedAway)
  const actualDiff = getGoalDiff(actualHome, actualAway)

  // Exact score
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return Math.round(5 * multiplier * 10) / 10
  }

  // Goal difference AND winner both match
  if (predictedResult === actualResult && predictedDiff === actualDiff) {
    return Math.round(3 * multiplier * 10) / 10
  }

  // Correct winner (or both draw)
  if (predictedResult === actualResult) {
    return Math.round(2 * multiplier * 10) / 10
  }

  return 0
}

export function processMatchResult(matchId) {
  const match = db.prepare(`
    SELECT m.*, ph.multiplier
    FROM matches m
    JOIN phases ph ON m.phase_id = ph.id
    WHERE m.id = ?
  `).get(matchId)

  if (!match || match.home_score === null || match.away_score === null) {
    return
  }

  const predictions = db.prepare(`
    SELECT * FROM predictions WHERE match_id = ?
  `).all(matchId)

  const updatePrediction = db.prepare(`
    UPDATE predictions SET points_earned = ? WHERE id = ?
  `)

  const processPredictions = db.transaction(() => {
    for (const pred of predictions) {
      const points = calculatePoints(
        pred.predicted_home,
        pred.predicted_away,
        match.home_score,
        match.away_score,
        match.multiplier
      )
      updatePrediction.run(points, pred.id)
    }
  })

  processPredictions()

  // Check achievements for all users who had a prediction
  for (const pred of predictions) {
    checkAchievements(pred.user_id)
  }
}
