import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'yu-gi-oh-secret-key-change-me'

export function authMiddleware(req, res, next) {
  let token = null
  const authHeader = req.headers.authorization || req.headers.Authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]
  } else if (req.query && req.query.token) {
    token = req.query.token
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token']
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Acceso no autorizado. Token de autenticación requerido.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Sesión expirada o token inválido. Por favor inicia sesión de nuevo.' })
  }
}
