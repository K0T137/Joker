import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'

export function makeJwt(user) {
  return jwt.sign(
    { id: user.id, username: user.username, avatarId: user.avatar_id ?? 1, isGuest: false },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
}

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
