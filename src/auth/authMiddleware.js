import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'yu-gi-oh-secret-key-change-me'

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Acceso no autorizado. Token requerido.' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado.' })
  }
}
