import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createUser, findUserByEmail, findUserById } from './userModel.js'
import { authMiddleware, JWT_SECRET } from './authMiddleware.js'

const router = Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña son obligatorios.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres.' })
    }

    const existingUser = await findUserByEmail(cleanEmail)
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El email ya está registrado.' })
    }

    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)
    const user = await createUser(cleanEmail, passwordHash)

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, created_at: user.created_at }
    })
  } catch (err) {
    console.error('Error en registro:', err)
    res.status(500).json({ success: false, error: 'Error al registrar usuario.' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña son obligatorios.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await findUserByEmail(cleanEmail)

    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas.' })
    }

    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas.' })
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, created_at: user.created_at }
    })
  } catch (err) {
    console.error('Error en login:', err)
    res.status(500).json({ success: false, error: 'Error al iniciar sesión.' })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' })
    }
    res.json({ success: true, user })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener usuario.' })
  }
})

export default router
