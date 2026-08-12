import { dbRun, dbGet } from '../db.js'

export async function createUser(email, passwordHash) {
  const createdAt = new Date().toISOString()
  const result = await dbRun(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
    [email, passwordHash, createdAt]
  )
  return {
    id: result.lastID,
    email,
    created_at: createdAt,
  }
}

export async function findUserByEmail(email) {
  return await dbGet('SELECT * FROM users WHERE email = ?', [email])
}

export async function findUserById(id) {
  return await dbGet('SELECT id, email, created_at FROM users WHERE id = ?', [id])
}
