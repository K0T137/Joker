import { Router } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pool, { claimDailyBonus, restoreLoginStreak, createPasswordResetToken, consumePasswordResetToken, getUserByEmail } from '../db.js'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev'

const router = Router()

const JWT_SECRET   = process.env.JWT_SECRET   || 'dev-secret-change-in-prod'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

function makeJwt(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email ?? null, avatarId: user.avatar_id ?? 1, isGuest: false },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  '/api/auth/google/callback',
      proxy:        true,
    },
    async (_access, _refresh, profile, done) => {
      try {
        const googleId = profile.id
        const email    = profile.emails?.[0]?.value ?? null
        const username = profile.displayName ?? `Player${googleId.slice(-5)}`

        const { rows } = await pool.query(
          `INSERT INTO users (google_id, email, username)
           VALUES ($1, $2, $3)
           ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email
           RETURNING *`,
          [googleId, email, username]
        )

        await pool.query(
          `INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [rows[0].id]
        )

        done(null, rows[0])
      } catch (err) {
        done(err)
      }
    }
  ))
}

router.get('/google', (req, res, next) => {
  console.log('[auth] /google hit, CLIENT_ID set:', !!process.env.GOOGLE_CLIENT_ID)
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google auth not configured' })
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/?error=auth_failed`,
  })(req, res, next)
}, (req, res) => {
  const token = makeJwt(req.user)
  res.redirect(`${FRONTEND_URL}/?token=${token}`)
})

// POST /api/auth/register  { username, email, password }
router.post('/register', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Accounts are not available yet — database not configured' })
  }
  try {
    const { username, email, password } = req.body ?? {}
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' })
    }
    if (username.trim().length > 30) {
      return res.status(400).json({ error: 'Username too long (max 30 chars)' })
    }
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username.trim(), email?.trim() || null, hash]
    )
    await pool.query(
      `INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [rows[0].id]
    )
    res.json({ token: makeJwt(rows[0]) })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already taken' })
    }
    console.error('[register]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/login  { username, password }
router.post('/login', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Accounts are not available yet — database not configured' })
  }
  try {
    const { username, password } = req.body ?? {}
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE username = $1 AND password_hash IS NOT NULL`,
      [username.trim()]
    )
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }
    res.json({ token: makeJwt(user) })
  } catch (err) {
    console.error('[login]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/me', (req, res) => {
  const header = req.headers.authorization ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    res.json(jwt.verify(token, JWT_SECRET))
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// GET /api/auth/daily-bonus — claim daily login reward and return streak info
router.get('/daily-bonus', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ claimed: false })
  const header = req.headers.authorization ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const { id } = jwt.verify(token, JWT_SECRET)
    const result = await claimDailyBonus(id)
    res.json(result)
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// POST /api/auth/restore-streak — spend 300 tokens to restore a broken streak
router.post('/restore-streak', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' })
  const header = req.headers.authorization ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const { id } = jwt.verify(token, JWT_SECRET)
    const result = await restoreLoginStreak(id)
    if (!result.ok) return res.status(400).json({ error: result.reason })
    res.json(result)
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// POST /api/auth/forgot-password  { email }
router.post('/forgot-password', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' })
  // Always return 200 to avoid user enumeration
  res.json({ ok: true })

  try {
    const { email } = req.body ?? {}
    if (!email?.trim()) return
    const user = await getUserByEmail(email)
    if (!user || !user.email) return
    if (!resend) return

    const token = await createPasswordResetToken(user.id)
    const resetUrl = `${FRONTEND_URL}/?reset_token=${token}`

    await resend.emails.send({
      from: FROM_EMAIL,
      to:   user.email,
      subject: 'Reset your Joker password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#c9a84c">Reset your password</h2>
          <p>Hi <strong>${user.username}</strong>,</p>
          <p>Click the button below to reset your Joker password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#c9a84c;color:#0a0a0f;font-weight:700;text-decoration:none;border-radius:8px">
            Reset Password
          </a>
          <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[forgot-password]', err.message)
  }
})

// POST /api/auth/reset-password  { token, password }
router.post('/reset-password', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' })
  try {
    const { token, password } = req.body ?? {}
    if (!token || !password?.trim()) return res.status(400).json({ error: 'Token and password are required' })
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' })

    const userId = await consumePasswordResetToken(token)
    if (!userId) return res.status(400).json({ error: 'Invalid or expired reset link' })

    const hash = await bcrypt.hash(password, 10)
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, userId])

    const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId])
    res.json({ token: makeJwt(rows[0]) })
  } catch (err) {
    console.error('[reset-password]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
