import { Router }  from 'express'
import jwt          from 'jsonwebtoken'
import bcrypt       from 'bcryptjs'
import pool         from '../db.js'

const router     = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'

function makeJwt(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email ?? null, avatarId: user.avatar_id ?? 1, isGuest: false },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// GET /api/profile — full profile (email + avatar)
router.get('/', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' })
  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, avatar_id, avatar_data,
              (password_hash IS NOT NULL) AS has_password
       FROM users WHERE id = $1`,
      [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('[profile GET]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/profile — update username / email / password
router.put('/', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' })
  try {
    const { username, email, currentPassword, newPassword } = req.body ?? {}

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])
    const user = rows[0]
    if (!user) return res.status(404).json({ error: 'Not found' })

    const updates = {}

    if (username !== undefined) {
      const u = username.trim()
      if (!u || u.length > 30) return res.status(400).json({ error: 'Username must be 1-30 chars' })
      updates.username = u
    }

    if (email !== undefined) {
      updates.email = email.trim() || null
    }

    if (newPassword !== undefined) {
      if (!user.password_hash) return res.status(400).json({ error: 'Cannot set password on a Google account here' })
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }
      if (newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 chars' })
      updates.password_hash = await bcrypt.hash(newPassword, 10)
    }

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' })

    const fields = Object.keys(updates)
    const values = Object.values(updates)
    const set    = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')

    const { rows: updated } = await pool.query(
      `UPDATE users SET ${set} WHERE id = $1 RETURNING *`,
      [req.user.id, ...values]
    )

    res.json({ token: makeJwt(updated[0]) })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already taken' })
    console.error('[profile PUT]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/profile/avatar — set preset (avatarId 1-8) or custom base64 image
router.put('/avatar', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' })
  try {
    const { avatarId, avatarData } = req.body ?? {}
    const updates = {}

    if (avatarId !== undefined) {
      if (!Number.isInteger(avatarId) || avatarId < 1 || avatarId > 8) {
        return res.status(400).json({ error: 'avatarId must be 1-8' })
      }
      updates.avatar_id   = avatarId
      updates.avatar_data = null
    }

    if (avatarData !== undefined) {
      if (typeof avatarData !== 'string' || avatarData.length > 300_000) {
        return res.status(400).json({ error: 'Avatar image too large (max ~200KB)' })
      }
      updates.avatar_data = avatarData
    }

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' })

    const fields = Object.keys(updates)
    const values = Object.values(updates)
    const set    = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')

    const { rows } = await pool.query(
      `UPDATE users SET ${set} WHERE id = $1 RETURNING *`,
      [req.user.id, ...values]
    )

    res.json({ token: makeJwt(rows[0]), avatarId: rows[0].avatar_id, avatarData: rows[0].avatar_data })
  } catch (err) {
    console.error('[profile avatar]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
