import db from '../db/database.js'

function unlockAchievement(userId, key) {
  const existing = db.prepare('SELECT id FROM achievements WHERE user_id = ? AND achievement_key = ?').get(userId, key)
  if (existing) return false

  try {
    db.prepare('INSERT INTO achievements (user_id, achievement_key) VALUES (?, ?)').run(userId, key)

    const def = db.prepare('SELECT name, icon FROM achievement_definitions WHERE key = ?').get(key)
    if (def) {
      db.prepare(`
        INSERT INTO notifications (user_id, message, type)
        VALUES (?, ?, 'achievement')
      `).run(userId, `Prestatie ontgrendeld: ${def.icon} ${def.name}`)
    }
    return true
  } catch {
    return false
  }
}

export function checkAchievements(userId) {
  // first_shot: at least 1 prediction
  const predCount = db.prepare('SELECT COUNT(*) as cnt FROM predictions WHERE user_id = ?').get(userId)
  if (predCount.cnt >= 1) unlockAchievement(userId, 'first_shot')

  // oracle_start: has a bonus prediction
  const bonusCount = db.prepare('SELECT COUNT(*) as cnt FROM bonus_predictions WHERE user_id = ?').get(userId)
  if (bonusCount.cnt >= 1) unlockAchievement(userId, 'oracle_start')

  // good_guess: at least 1 prediction with points >= 2
  const goodGuess = db.prepare('SELECT COUNT(*) as cnt FROM predictions WHERE user_id = ? AND points_earned >= 2').get(userId)
  if (goodGuess.cnt >= 1) unlockAchievement(userId, 'good_guess')

  // sharpshooter: at least 1 exact prediction (points where predicted matches actual score)
  const exactScores = db.prepare(`
    SELECT COUNT(*) as cnt FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.user_id = ?
      AND m.status = 'finished'
      AND p.predicted_home = m.home_score
      AND p.predicted_away = m.away_score
  `).get(userId)

  if (exactScores.cnt >= 1) unlockAchievement(userId, 'sharpshooter')
  if (exactScores.cnt >= 3) unlockAchievement(userId, 'diamond_eye')
  if (exactScores.cnt >= 5) unlockAchievement(userId, 'oracle')

  // marathon: predictions for all group stage matches
  const totalGroupMatches = db.prepare(`
    SELECT COUNT(*) as cnt FROM matches m
    JOIN phases ph ON m.phase_id = ph.id
    WHERE ph.name = 'Groepsfase'
  `).get()
  const userGroupPredictions = db.prepare(`
    SELECT COUNT(*) as cnt FROM predictions p
    JOIN matches m ON p.match_id = m.id
    JOIN phases ph ON m.phase_id = ph.id
    WHERE p.user_id = ? AND ph.name = 'Groepsfase'
  `).get(userId)
  if (totalGroupMatches.cnt > 0 && userGroupPredictions.cnt >= totalGroupMatches.cnt) {
    unlockAchievement(userId, 'marathon')
  }

  // full_day: predicted all matches on any single calendar day
  const fullDay = db.prepare(`
    SELECT day_totals.match_day
    FROM (
      SELECT DATE(match_datetime) as match_day, COUNT(*) as total_on_day
      FROM matches
      GROUP BY DATE(match_datetime)
    ) day_totals
    JOIN (
      SELECT DATE(m.match_datetime) as match_day, COUNT(*) as user_preds_on_day
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      WHERE p.user_id = ?
      GROUP BY DATE(m.match_datetime)
    ) user_day ON day_totals.match_day = user_day.match_day
    WHERE user_day.user_preds_on_day >= day_totals.total_on_day
    LIMIT 1
  `).get(userId)
  if (fullDay) unlockAchievement(userId, 'full_day')

  // world_citizen: predictions covering teams from at least 20 different countries
  const teamCount = db.prepare(`
    SELECT COUNT(DISTINCT t.id) as cnt
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
    WHERE p.user_id = ?
      AND t.continent != 'TBD'
  `).get(userId)
  if (teamCount.cnt >= 20) unlockAchievement(userId, 'world_citizen')

  // on_fire: consecutive correct predictions (points_earned > 0)
  // Get predictions ordered by match datetime
  const orderedPredictions = db.prepare(`
    SELECT p.points_earned
    FROM predictions p
    JOIN matches m ON p.match_id = m.id
    WHERE p.user_id = ? AND m.status = 'finished' AND p.points_earned IS NOT NULL
    ORDER BY m.match_datetime ASC
  `).all(userId)

  let maxStreak = 0
  let currentStreak = 0
  for (const pred of orderedPredictions) {
    if (pred.points_earned > 0) {
      currentStreak++
      if (currentStreak > maxStreak) maxStreak = currentStreak
    } else {
      currentStreak = 0
    }
  }

  if (maxStreak >= 3)  unlockAchievement(userId, 'on_fire_3')
  if (maxStreak >= 5)  unlockAchievement(userId, 'on_fire_5')
  if (maxStreak >= 10) unlockAchievement(userId, 'on_fire_10')

  // number_one: currently rank 1 on leaderboard (with at least some points).
  // Aggregate separately to avoid the predictions×bonus cartesian product.
  const leaderboard = db.prepare(`
    SELECT u.id,
      COALESCE(pred.pts, 0) + COALESCE(bon.pts, 0) as total_points
    FROM users u
    LEFT JOIN (SELECT user_id, SUM(points_earned) as pts FROM predictions GROUP BY user_id) pred ON pred.user_id = u.id
    LEFT JOIN (SELECT user_id, SUM(points_earned) as pts FROM bonus_predictions GROUP BY user_id) bon ON bon.user_id = u.id
    ORDER BY total_points DESC
    LIMIT 1
  `).get()

  if (leaderboard && leaderboard.id === userId && leaderboard.total_points > 0) {
    unlockAchievement(userId, 'number_one')
  }
}
