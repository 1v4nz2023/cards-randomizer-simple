import sqlite3 from 'sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dataDir = join(__dirname, '../data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const dbPath = process.env.DB_PATH || join(dataDir, 'app.db')

// Open SQLite database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message)
  } else {
    console.log('Connected to SQLite database at:', dbPath)
  }
})

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;')

// Helper to run query with params (INSERT, UPDATE, DELETE)
export function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

// Helper to get single row (SELECT)
export function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

// Helper to get all matching rows (SELECT)
export function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}

/**
 * Initialize database tables
 */
export async function initDb() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await dbRun(`
    CREATE TABLE IF NOT EXISTS inventory_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      card_code TEXT,
      quantity INTEGER DEFAULT 1,
      condition TEXT,
      set_name TEXT,
      rarity TEXT,
      binder_page INTEGER,
      binder_slot INTEGER,
      notes TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  console.log('SQLite database tables initialized successfully.')
}

export default db
