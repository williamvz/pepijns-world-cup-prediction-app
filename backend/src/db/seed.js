import dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'
import db from './database.js'

// ── 0. GUARD: only seed a FRESH database ─────────────────────────────────────
// /data/wkpool.db is persistent across restarts and rebuilds. We must NEVER
// wipe user data (predictions, results, accounts) on startup. If the database
// is already populated, leave everything untouched and exit.
//
// (The schema has no UNIQUE constraints on teams.code / matches.match_number /
// phases.name, so the INSERT OR IGNORE statements below would create duplicates
// on a second run — hence this hard guard rather than relying on them.)
const alreadySeeded = db.prepare('SELECT COUNT(*) AS c FROM matches').get().c > 0
if (alreadySeeded) {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  const predCount = db.prepare('SELECT COUNT(*) AS c FROM predictions').get().c
  console.log('✅ Database is al gevuld — seed overgeslagen (geen data gewist).')
  console.log(`   Gebruikers   : ${userCount} (behouden)`)
  console.log(`   Voorspellingen: ${predCount} (behouden)`)
  process.exit(0)
}

// Fresh/empty database below this point. Clear any partial leftovers in
// FK-safe order, then populate from scratch.
db.exec(`
  DELETE FROM achievements;
  DELETE FROM notifications;
  DELETE FROM bonus_predictions;
  DELETE FROM predictions;
  DELETE FROM matches;
  DELETE FROM teams;
  DELETE FROM phases;
  DELETE FROM users;
`)

// ── 1. PHASES ────────────────────────────────────────────────────────────────
const insertPhase = db.prepare(`
  INSERT OR IGNORE INTO phases (name, multiplier, is_unlocked, unlock_order)
  VALUES (?, ?, ?, ?)
`)

const phaseData = [
  ['Groepsfase',    1.0, 1, 1],
  ['Ronde van 32',  1.5, 0, 2],
  ['Kwartfinales',  2.0, 0, 3],
  ['Halve finales', 2.5, 0, 4],
  ['Troostfinale',  3.0, 0, 5],
  ['Finale',        3.0, 0, 6],
]

const insertPhases = db.transaction(() => {
  for (const p of phaseData) insertPhase.run(...p)
})
insertPhases()

const groupPhase = db.prepare("SELECT id FROM phases WHERE name = 'Groepsfase'").get()
const groupPhaseId = groupPhase.id

// ── 2. TEAMS (48 teams, 12 groups of 4) ──────────────────────────────────────
const insertTeam = db.prepare(`
  INSERT OR IGNORE INTO teams (name, code, group_name, flag_emoji, continent)
  VALUES (?, ?, ?, ?, ?)
`)

const teamsData = [
  // Group A
  ['Mexico',           'MEX', 'A', '🇲🇽', 'CONCACAF'],
  ['South Africa',     'RSA', 'A', '🇿🇦', 'CAF'],
  ['South Korea',      'KOR', 'A', '🇰🇷', 'AFC'],
  ['Czech Republic',   'CZE', 'A', '🇨🇿', 'UEFA'],
  // Group B
  ['Canada',           'CAN', 'B', '🇨🇦', 'CONCACAF'],
  ['Bosnia-Herzegovina','BIH','B', '🇧🇦', 'UEFA'],
  ['Qatar',            'QAT', 'B', '🇶🇦', 'AFC'],
  ['Switzerland',      'SUI', 'B', '🇨🇭', 'UEFA'],
  // Group C
  ['Brazil',           'BRA', 'C', '🇧🇷', 'CONMEBOL'],
  ['Morocco',          'MAR', 'C', '🇲🇦', 'CAF'],
  ['Haiti',            'HAI', 'C', '🇭🇹', 'CONCACAF'],
  ['Scotland',         'SCO', 'C', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'UEFA'],
  // Group D
  ['United States',    'USA', 'D', '🇺🇸', 'CONCACAF'],
  ['Paraguay',         'PAR', 'D', '🇵🇾', 'CONMEBOL'],
  ['Australia',        'AUS', 'D', '🇦🇺', 'AFC'],
  ['Turkey',           'TUR', 'D', '🇹🇷', 'UEFA'],
  // Group E
  ['Germany',          'GER', 'E', '🇩🇪', 'UEFA'],
  ['Curaçao',          'CUW', 'E', '🇨🇼', 'CONCACAF'],
  ['Ivory Coast',      'CIV', 'E', '🇨🇮', 'CAF'],
  ['Ecuador',          'ECU', 'E', '🇪🇨', 'CONMEBOL'],
  // Group F
  ['Netherlands',      'NED', 'F', '🇳🇱', 'UEFA'],
  ['Japan',            'JPN', 'F', '🇯🇵', 'AFC'],
  ['Sweden',           'SWE', 'F', '🇸🇪', 'UEFA'],
  ['Tunisia',          'TUN', 'F', '🇹🇳', 'CAF'],
  // Group G
  ['Belgium',          'BEL', 'G', '🇧🇪', 'UEFA'],
  ['Egypt',            'EGY', 'G', '🇪🇬', 'CAF'],
  ['Iran',             'IRN', 'G', '🇮🇷', 'AFC'],
  ['New Zealand',      'NZL', 'G', '🇳🇿', 'OFC'],
  // Group H
  ['Spain',            'ESP', 'H', '🇪🇸', 'UEFA'],
  ['Cape Verde',       'CPV', 'H', '🇨🇻', 'CAF'],
  ['Saudi Arabia',     'KSA', 'H', '🇸🇦', 'AFC'],
  ['Uruguay',          'URU', 'H', '🇺🇾', 'CONMEBOL'],
  // Group I
  ['France',           'FRA', 'I', '🇫🇷', 'UEFA'],
  ['Senegal',          'SEN', 'I', '🇸🇳', 'CAF'],
  ['Iraq',             'IRQ', 'I', '🇮🇶', 'AFC'],
  ['Norway',           'NOR', 'I', '🇳🇴', 'UEFA'],
  // Group J
  ['Argentina',        'ARG', 'J', '🇦🇷', 'CONMEBOL'],
  ['Algeria',          'ALG', 'J', '🇩🇿', 'CAF'],
  ['Austria',          'AUT', 'J', '🇦🇹', 'UEFA'],
  ['Jordan',           'JOR', 'J', '🇯🇴', 'AFC'],
  // Group K
  ['Portugal',         'POR', 'K', '🇵🇹', 'UEFA'],
  ['Congo DR',         'COD', 'K', '🇨🇩', 'CAF'],
  ['Uzbekistan',       'UZB', 'K', '🇺🇿', 'AFC'],
  ['Colombia',         'COL', 'K', '🇨🇴', 'CONMEBOL'],
  // Group L
  ['England',          'ENG', 'L', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'UEFA'],
  ['Croatia',          'CRO', 'L', '🇭🇷', 'UEFA'],
  ['Ghana',            'GHA', 'L', '🇬🇭', 'CAF'],
  ['Panama',           'PAN', 'L', '🇵🇦', 'CONCACAF'],
]

const insertTeams = db.transaction(() => {
  for (const t of teamsData) insertTeam.run(...t)
})
insertTeams()

// Helper: look up team id by code
const getTeamId = (code) => {
  const row = db.prepare('SELECT id FROM teams WHERE code = ?').get(code)
  if (!row) throw new Error(`Team not found: ${code}`)
  return row.id
}

// ── 3. MATCHES (72 group stage matches) ──────────────────────────────────────
const insertMatch = db.prepare(`
  INSERT OR IGNORE INTO matches
    (phase_id, group_name, home_team_id, away_team_id, match_datetime, venue, city, status, home_score, away_score, match_number)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', NULL, NULL, ?)
`)

// [match_number, group, home_code, away_code, datetime, venue, city]
const matchesData = [
  // GROUP A
  [1,  'A', 'MEX', 'RSA', '2026-06-11T21:00:00', 'Azteca Stadium',            'Mexico City'],
  [2,  'A', 'KOR', 'CZE', '2026-06-12T04:00:00', 'Estadio Akron',             'Guadalajara'],
  [3,  'A', 'CZE', 'RSA', '2026-06-18T18:00:00', 'Mercedes-Benz Stadium',     'Atlanta'],
  [4,  'A', 'MEX', 'KOR', '2026-06-19T03:00:00', 'Estadio Akron',             'Guadalajara'],
  [5,  'A', 'CZE', 'MEX', '2026-06-25T03:00:00', 'Azteca Stadium',            'Mexico City'],
  [6,  'A', 'RSA', 'KOR', '2026-06-25T03:00:00', 'Estadio BBVA',              'Monterrey'],
  // GROUP B
  [7,  'B', 'CAN', 'BIH', '2026-06-12T21:00:00', 'BMO Field',                 'Toronto'],
  [8,  'B', 'QAT', 'SUI', '2026-06-13T21:00:00', "Levi's Stadium",            'San Francisco'],
  [9,  'B', 'SUI', 'BIH', '2026-06-18T21:00:00', 'Rose Bowl',                 'Los Angeles'],
  [10, 'B', 'CAN', 'QAT', '2026-06-19T00:00:00', 'BC Place',                  'Vancouver'],
  [11, 'B', 'SUI', 'CAN', '2026-06-24T21:00:00', 'BC Place',                  'Vancouver'],
  [12, 'B', 'BIH', 'QAT', '2026-06-24T21:00:00', 'Lumen Field',               'Seattle'],
  // GROUP C
  [13, 'C', 'BRA', 'MAR', '2026-06-14T00:00:00', 'MetLife Stadium',           'New York'],
  [14, 'C', 'HAI', 'SCO', '2026-06-14T03:00:00', 'Gillette Stadium',          'Boston'],
  [15, 'C', 'SCO', 'MAR', '2026-06-20T00:00:00', 'Gillette Stadium',          'Boston'],
  [16, 'C', 'BRA', 'HAI', '2026-06-20T02:30:00', 'Lincoln Financial Field',   'Philadelphia'],
  [17, 'C', 'SCO', 'BRA', '2026-06-25T00:00:00', 'Hard Rock Stadium',         'Miami'],
  [18, 'C', 'MAR', 'HAI', '2026-06-25T00:00:00', 'Mercedes-Benz Stadium',     'Atlanta'],
  // GROUP D
  [19, 'D', 'USA', 'PAR', '2026-06-13T03:00:00', 'Rose Bowl',                 'Los Angeles'],
  [20, 'D', 'AUS', 'TUR', '2026-06-14T06:00:00', 'BC Place',                  'Vancouver'],
  [21, 'D', 'USA', 'AUS', '2026-06-19T21:00:00', 'Lumen Field',               'Seattle'],
  [22, 'D', 'TUR', 'PAR', '2026-06-20T05:00:00', "Levi's Stadium",            'San Francisco'],
  [23, 'D', 'TUR', 'USA', '2026-06-26T04:00:00', 'Rose Bowl',                 'Los Angeles'],
  [24, 'D', 'PAR', 'AUS', '2026-06-26T04:00:00', "Levi's Stadium",            'San Francisco'],
  // GROUP E
  [25, 'E', 'GER', 'CUW', '2026-06-14T19:00:00', 'NRG Stadium',               'Houston'],
  [26, 'E', 'CIV', 'ECU', '2026-06-15T01:00:00', 'Lincoln Financial Field',   'Philadelphia'],
  [27, 'E', 'GER', 'CIV', '2026-06-20T22:00:00', 'BMO Field',                 'Toronto'],
  [28, 'E', 'ECU', 'CUW', '2026-06-21T02:00:00', 'Arrowhead Stadium',         'Kansas City'],
  [29, 'E', 'CUW', 'CIV', '2026-06-25T22:00:00', 'Lincoln Financial Field',   'Philadelphia'],
  [30, 'E', 'ECU', 'GER', '2026-06-25T22:00:00', 'MetLife Stadium',           'New York'],
  // GROUP F
  [31, 'F', 'NED', 'JPN', '2026-06-14T22:00:00', 'AT&T Stadium',              'Dallas'],
  [32, 'F', 'SWE', 'TUN', '2026-06-15T04:00:00', 'Estadio BBVA',              'Monterrey'],
  [33, 'F', 'NED', 'SWE', '2026-06-20T19:00:00', 'NRG Stadium',               'Houston'],
  [34, 'F', 'TUN', 'JPN', '2026-06-21T06:00:00', 'Estadio BBVA',              'Monterrey'],
  [35, 'F', 'JPN', 'SWE', '2026-06-26T01:00:00', 'AT&T Stadium',              'Dallas'],
  [36, 'F', 'TUN', 'NED', '2026-06-26T01:00:00', 'Arrowhead Stadium',         'Kansas City'],
  // GROUP G
  [37, 'G', 'BEL', 'EGY', '2026-06-15T21:00:00', 'Lumen Field',               'Seattle'],
  [38, 'G', 'IRN', 'NZL', '2026-06-16T03:00:00', 'Rose Bowl',                 'Los Angeles'],
  [39, 'G', 'BEL', 'IRN', '2026-06-21T21:00:00', 'Rose Bowl',                 'Los Angeles'],
  [40, 'G', 'NZL', 'EGY', '2026-06-22T03:00:00', 'BC Place',                  'Vancouver'],
  [41, 'G', 'EGY', 'IRN', '2026-06-27T05:00:00', 'Lumen Field',               'Seattle'],
  [42, 'G', 'NZL', 'BEL', '2026-06-27T05:00:00', 'BC Place',                  'Vancouver'],
  // GROUP H
  [43, 'H', 'ESP', 'CPV', '2026-06-15T18:00:00', 'Mercedes-Benz Stadium',     'Atlanta'],
  [44, 'H', 'KSA', 'URU', '2026-06-16T00:00:00', 'Hard Rock Stadium',         'Miami'],
  [45, 'H', 'ESP', 'KSA', '2026-06-21T18:00:00', 'Mercedes-Benz Stadium',     'Atlanta'],
  [46, 'H', 'URU', 'CPV', '2026-06-22T00:00:00', 'Hard Rock Stadium',         'Miami'],
  [47, 'H', 'CPV', 'KSA', '2026-06-27T02:00:00', 'NRG Stadium',               'Houston'],
  [48, 'H', 'URU', 'ESP', '2026-06-27T02:00:00', 'Estadio Akron',             'Guadalajara'],
  // GROUP I
  [49, 'I', 'FRA', 'SEN', '2026-06-16T21:00:00', 'MetLife Stadium',           'New York'],
  [50, 'I', 'IRQ', 'NOR', '2026-06-17T00:00:00', 'Gillette Stadium',          'Boston'],
  [51, 'I', 'FRA', 'IRQ', '2026-06-22T23:00:00', 'Lincoln Financial Field',   'Philadelphia'],
  [52, 'I', 'NOR', 'SEN', '2026-06-23T02:00:00', 'MetLife Stadium',           'New York'],
  [53, 'I', 'NOR', 'FRA', '2026-06-26T21:00:00', 'Gillette Stadium',          'Boston'],
  [54, 'I', 'SEN', 'IRQ', '2026-06-26T21:00:00', 'BMO Field',                 'Toronto'],
  // GROUP J
  [55, 'J', 'ARG', 'ALG', '2026-06-17T03:00:00', 'Arrowhead Stadium',         'Kansas City'],
  [56, 'J', 'AUT', 'JOR', '2026-06-17T06:00:00', "Levi's Stadium",            'San Francisco'],
  [57, 'J', 'ARG', 'AUT', '2026-06-22T19:00:00', 'AT&T Stadium',              'Dallas'],
  [58, 'J', 'JOR', 'ALG', '2026-06-23T05:00:00', "Levi's Stadium",            'San Francisco'],
  [59, 'J', 'ALG', 'AUT', '2026-06-28T04:00:00', 'Arrowhead Stadium',         'Kansas City'],
  [60, 'J', 'JOR', 'ARG', '2026-06-28T04:00:00', 'AT&T Stadium',              'Dallas'],
  // GROUP K
  [61, 'K', 'POR', 'COD', '2026-06-17T19:00:00', 'NRG Stadium',               'Houston'],
  [62, 'K', 'UZB', 'COL', '2026-06-18T04:00:00', 'Azteca Stadium',            'Mexico City'],
  [63, 'K', 'POR', 'UZB', '2026-06-23T19:00:00', 'NRG Stadium',               'Houston'],
  [64, 'K', 'COL', 'COD', '2026-06-24T04:00:00', 'Estadio Akron',             'Guadalajara'],
  [65, 'K', 'COL', 'POR', '2026-06-28T01:30:00', 'Hard Rock Stadium',         'Miami'],
  [66, 'K', 'COD', 'UZB', '2026-06-28T01:30:00', 'Mercedes-Benz Stadium',     'Atlanta'],
  // GROUP L
  [67, 'L', 'ENG', 'CRO', '2026-06-17T22:00:00', 'AT&T Stadium',              'Dallas'],
  [68, 'L', 'GHA', 'PAN', '2026-06-18T01:00:00', 'BMO Field',                 'Toronto'],
  [69, 'L', 'ENG', 'GHA', '2026-06-23T22:00:00', 'Gillette Stadium',          'Boston'],
  [70, 'L', 'PAN', 'CRO', '2026-06-24T01:00:00', 'BMO Field',                 'Toronto'],
  [71, 'L', 'PAN', 'ENG', '2026-06-27T23:00:00', 'MetLife Stadium',           'New York'],
  [72, 'L', 'CRO', 'GHA', '2026-06-27T23:00:00', 'Lincoln Financial Field',   'Philadelphia'],
]

const insertMatches = db.transaction(() => {
  for (const [num, grp, home, away, dt, venue, city] of matchesData) {
    insertMatch.run(
      groupPhaseId,
      grp,
      getTeamId(home),
      getTeamId(away),
      dt,
      venue,
      city,
      num
    )
  }
})
insertMatches()

// ── 4. USERS ─────────────────────────────────────────────────────────────────
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password_hash, avatar, favorite_team, role)
  VALUES (?, ?, ?, ?, ?)
`)

const adminHash = bcrypt.hashSync('admin123', 10)
insertUser.run('william', adminHash, 'trophy', 'Netherlands', 'admin')

// ── 5. SUMMARY ───────────────────────────────────────────────────────────────
const phaseCount = db.prepare('SELECT COUNT(*) AS c FROM phases').get().c
const teamCount  = db.prepare('SELECT COUNT(*) AS c FROM teams').get().c
const matchCount = db.prepare('SELECT COUNT(*) AS c FROM matches').get().c
const userCount  = db.prepare('SELECT COUNT(*) AS c FROM users').get().c

console.log('✅ Seed complete:')
console.log(`   Phases : ${phaseCount}`)
console.log(`   Teams  : ${teamCount}`)
console.log(`   Matches: ${matchCount}`)
console.log(`   Users  : ${userCount}`)
