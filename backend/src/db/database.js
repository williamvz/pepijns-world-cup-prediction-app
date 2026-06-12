import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { initDatabase } from './migrations.js'

const dbPath = process.env.DB_PATH || './data/wkpool.db'
mkdirSync(dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

initDatabase(db)

export default db
