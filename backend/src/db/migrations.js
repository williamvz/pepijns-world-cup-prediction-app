import { populateFifaRankings } from './fifaRankings.js'

export function initDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT DEFAULT 'ball1',
      favorite_team TEXT,
      role TEXT DEFAULT 'player' CHECK(role IN ('admin','player')),
      created_at TEXT DEFAULT current_timestamp
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      group_name TEXT,
      flag_emoji TEXT,
      continent TEXT
    );

    CREATE TABLE IF NOT EXISTS phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      multiplier REAL DEFAULT 1.0,
      is_unlocked INTEGER DEFAULT 0,
      unlock_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_id INTEGER REFERENCES phases(id),
      group_name TEXT,
      home_team_id INTEGER REFERENCES teams(id),
      away_team_id INTEGER REFERENCES teams(id),
      match_datetime TEXT NOT NULL,
      venue TEXT,
      city TEXT,
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','live','finished')),
      home_score INTEGER,
      away_score INTEGER,
      match_number INTEGER
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      match_id INTEGER REFERENCES matches(id),
      predicted_home INTEGER NOT NULL,
      predicted_away INTEGER NOT NULL,
      points_earned REAL,
      is_locked INTEGER DEFAULT 0,
      submitted_at TEXT DEFAULT current_timestamp,
      UNIQUE(user_id, match_id)
    );

    CREATE TABLE IF NOT EXISTS bonus_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      type TEXT CHECK(type IN ('champion','topscorer')),
      predicted_value TEXT NOT NULL,
      is_correct INTEGER,
      points_earned REAL DEFAULT 0,
      submitted_at TEXT DEFAULT current_timestamp,
      UNIQUE(user_id, type)
    );

    CREATE TABLE IF NOT EXISTS achievement_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      category TEXT,
      rarity TEXT DEFAULT 'common'
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      achievement_key TEXT REFERENCES achievement_definitions(key),
      unlocked_at TEXT DEFAULT current_timestamp,
      UNIQUE(user_id, achievement_key)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT current_timestamp
    );
  `)

  // ── Migration: add tokens_valid_after column to users (idempotent) ────────
  // JWTs are stateless, so changing a password does not by itself end existing
  // sessions. This column stores a unix timestamp (seconds); any token whose
  // `iat` (issued-at) is older than it is rejected by the auth middleware. That
  // lets an admin force a re-login for one user or everyone, and makes a
  // password change end that user's other sessions automatically.
  const userColumns = db.prepare('PRAGMA table_info(users)').all()
  if (!userColumns.some((c) => c.name === 'tokens_valid_after')) {
    db.exec('ALTER TABLE users ADD COLUMN tokens_valid_after INTEGER')
  }

  // ── Migration: add fifa_ranking column to teams (idempotent) ──────────────
  // The teams table predates this column on existing databases. Adding it via
  // ALTER TABLE only when missing keeps already-seeded data fully intact.
  const teamColumns = db.prepare('PRAGMA table_info(teams)').all()
  if (!teamColumns.some((c) => c.name === 'fifa_ranking')) {
    db.exec('ALTER TABLE teams ADD COLUMN fifa_ranking INTEGER')
  }
  // Backfill rankings for any team still missing one (no-op on a fresh DB,
  // where teams are inserted later by the seed script).
  populateFifaRankings(db)

  // ── Migration: ensure the knockout phase list includes the Round of 16 ────
  // Older databases were seeded with phases that jumped straight from "Ronde van
  // 32" to "Kwartfinales", skipping the Round of 16. Insert "Achtste finales" in
  // the right spot and renumber unlock_order so the rounds stay in sequence.
  // Only touches an already-seeded phases table — a fresh DB is filled by the
  // seed script (which already lists the correct phases), so this is a no-op
  // there. is_unlocked is left untouched, so an already-released phase stays
  // released.
  const phaseCount = db.prepare('SELECT COUNT(*) AS c FROM phases').get().c
  if (phaseCount > 0) {
    const hasR16 = db.prepare("SELECT id FROM phases WHERE name = 'Achtste finales'").get()
    if (!hasR16) {
      db.prepare(
        "INSERT INTO phases (name, multiplier, is_unlocked, unlock_order) VALUES ('Achtste finales', 1.75, 0, 3)"
      ).run()
    }
    const phaseOrder = ['Groepsfase', 'Ronde van 32', 'Achtste finales', 'Kwartfinales', 'Halve finales', 'Troostfinale', 'Finale']
    const setOrder = db.prepare('UPDATE phases SET unlock_order = ? WHERE name = ?')
    phaseOrder.forEach((name, i) => setOrder.run(i + 1, name))
  }

  // Seed achievement definitions if empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM achievement_definitions').get()
  if (count.cnt === 0) {
    const insertAchievement = db.prepare(`
      INSERT INTO achievement_definitions (key, name, description, icon, category, rarity)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const achievements = [
      ['first_shot', 'Eerste Schot', 'Je eerste voorspelling ingevoerd', '🎯', 'getting_started', 'common'],
      ['full_day', 'Volledig Ingevuld', 'Alle wedstrijden van een speeldag voorspeld', '📋', 'getting_started', 'uncommon'],
      ['marathon', 'Marathon', 'Alle groepsfase-wedstrijden voorspeld', '🏟️', 'getting_started', 'rare'],
      ['oracle_start', 'Waarzegger', 'Je eerste bonusvoorspelling ingevuld', '🔮', 'getting_started', 'common'],
      ['good_guess', 'Goede Gok', 'Je eerste juiste winnaar voorspeld', '✅', 'quality', 'common'],
      ['sharpshooter', 'Scherpschutter', 'Je eerste exacte score voorspeld', '🎯', 'quality', 'uncommon'],
      ['on_fire_3', 'Op Dreef', '3 juiste voorspellingen op rij', '🔥', 'quality', 'uncommon'],
      ['on_fire_5', 'Onstopbaar', '5 juiste voorspellingen op rij', '🔥🔥', 'quality', 'rare'],
      ['on_fire_10', 'Legende', '10 juiste voorspellingen op rij', '🔥🔥🔥', 'quality', 'legendary'],
      ['diamond_eye', 'Diamanten Oog', '3 exacte scores voorspeld', '💎', 'quality', 'rare'],
      ['oracle', 'Orakel', '5 exacte scores voorspeld', '👑', 'quality', 'legendary'],
      ['champion_fan', 'Kampioen!', 'Je favoriete land wordt wereldkampioen', '🏆', 'moments', 'legendary'],
      ['bitter_pill', 'Bittere Pil', 'Je favoriete land vliegt eruit in de groepsfase', '💔', 'moments', 'common'],
      ['goodbye', 'Tot Ziens', 'Je favoriete land vliegt eruit in de knockoutfase', '👋', 'moments', 'uncommon'],
      ['world_citizen', 'Wereldburger', 'Wedstrijden voorspeld van minstens 20 landen', '🌍', 'moments', 'rare'],
      ['underdog', 'Underdog-fluisteraar', 'Correcte voorspelling van een verrassing', '🎉', 'moments', 'rare'],
      ['number_one', 'Nummer Één', 'Eerste keer bovenaan de ranglijst', '🥇', 'leaderboard', 'uncommon'],
      ['climber', 'Klimmer', '3 posities gestegen in één speeldag', '📈', 'leaderboard', 'common'],
      ['rocket_start', 'Raketstart', 'Na de eerste speeldag bovenaan staan', '🚀', 'leaderboard', 'rare'],
      ['comeback_kid', 'Comeback Kid', 'Van de onderste helft naar de top 3 klimmen', '🐢', 'leaderboard', 'legendary'],
    ]

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertAchievement.run(...item)
      }
    })
    insertMany(achievements)
  }
}
