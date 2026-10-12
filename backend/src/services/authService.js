import crypto from 'node:crypto'
import { promisify } from 'node:util'
import db from '../db.js'
import { logEvent } from '../utils/logger.js'

const scrypt = promisify(crypto.scrypt)
const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_LENGTH = 128
const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 28_800) * 1000
const MAX_ACTIVE_SESSIONS = Number(process.env.AUTH_MAX_ACTIVE_SESSIONS ?? 3)
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_FAILURE_LIMIT = 5
const RESET_WINDOW_MS = 60 * 60 * 1000
const RESET_REQUEST_LIMIT = 3

if (!Number.isSafeInteger(SESSION_TTL_MS) || SESSION_TTL_MS < 60_000) {
  throw new Error('AUTH_SESSION_TTL_SECONDS must be at least 60 seconds.')
}
if (!Number.isSafeInteger(MAX_ACTIVE_SESSIONS) || MAX_ACTIVE_SESSIONS < 1) {
  throw new Error('AUTH_MAX_ACTIVE_SESSIONS must be a positive integer.')
}

const dummyPasswordHash = await hashPassword('not-a-real-user-password')

export class AuthError extends Error {
  constructor(status, message, headers = {}) {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.errors = headers.errors
    this.headers = Object.fromEntries(
      Object.entries(headers).filter(([name]) => name !== 'errors'),
    )
  }
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validateEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePassword(password) {
  return typeof password === 'string' &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    password.trim().length > 0
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = await scrypt(password, salt, 64)
  return `${salt.toString('base64url')}.${hash.toString('base64url')}`
}

async function verifyPassword(password, encodedHash) {
  const [encodedSalt, encodedKey] = (encodedHash ?? '').split('.')
  if (!encodedSalt || !encodedKey) {
    return false
  }

  const salt = Buffer.from(encodedSalt, 'base64url')
  const expected = Buffer.from(encodedKey, 'base64url')
  if (salt.length !== 16 || expected.length !== 64) {
    return false
  }
  const actual = await scrypt(password, salt, expected.length)
  return crypto.timingSafeEqual(actual, expected)
}

function publicUser(user) {
  return {
    id: user.Id,
    email: user.Email,
    role: user.Role,
    createdAt: user.CreatedAt,
  }
}

function bucketHash(bucket) {
  return crypto.createHash('sha256').update(bucket).digest('hex')
}

function enforceRateLimit(bucket, limit, windowMs) {
  const now = Date.now()
  db.prepare('DELETE FROM LoginAttempts WHERE WindowStartedAt + ? <= ? AND LockedUntil <= ?')
    .run(RESET_WINDOW_MS, now, now)
  const key = bucketHash(bucket)
  const current = db.prepare('SELECT * FROM LoginAttempts WHERE Bucket = ?').get(key)

  if (current?.LockedUntil > now) {
    const retryAfter = Math.ceil((current.LockedUntil - now) / 1000)
    throw new AuthError(429, 'Too many attempts. Please try again later.', {
      'Retry-After': String(retryAfter),
    })
  }

  if (!current || current.WindowStartedAt + windowMs <= now) {
    db.prepare(`
      INSERT INTO LoginAttempts (Bucket, WindowStartedAt, FailureCount, LockedUntil)
      VALUES (?, ?, 0, 0)
      ON CONFLICT(Bucket) DO UPDATE SET
        WindowStartedAt = excluded.WindowStartedAt,
        FailureCount = 0,
        LockedUntil = 0
    `).run(key, now)
  }
  return key
}

function consumeAttempt(bucket, limit, windowMs) {
  const key = enforceRateLimit(bucket, limit, windowMs)
  recordFailure(key, limit, windowMs)
  return key
}

function recordFailure(key, limit, windowMs) {
  const now = Date.now()
  const current = db.prepare('SELECT * FROM LoginAttempts WHERE Bucket = ?').get(key)
  const withinWindow = current && current.WindowStartedAt + windowMs > now
  const failures = withinWindow ? current.FailureCount + 1 : 1
  const windowStartedAt = withinWindow ? current.WindowStartedAt : now
  const lockedUntil = failures >= limit ? windowStartedAt + windowMs : 0
  db.prepare(`
    INSERT INTO LoginAttempts (Bucket, WindowStartedAt, FailureCount, LockedUntil)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(Bucket) DO UPDATE SET
      WindowStartedAt = excluded.WindowStartedAt,
      FailureCount = excluded.FailureCount,
      LockedUntil = excluded.LockedUntil
  `).run(key, windowStartedAt, failures, lockedUntil)
}

function clearFailure(key) {
  db.prepare('DELETE FROM LoginAttempts WHERE Bucket = ?').run(key)
}

function ipKey(ip) {
  return `ip:${ip || 'unknown'}`
}

function emailKey(email) {
  return `email:${email}`
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function register({ email: rawEmail, password }, ip) {
  const email = normalizeEmail(rawEmail)
  if (!validateEmail(email) || !validatePassword(password)) {
    throw new AuthError(400, 'Validation failed.', {
      errors: {
        ...(!validateEmail(email) ? { email: ['Enter a valid email address.'] } : {}),
        ...(!validatePassword(password) ? { password: ['Password must be 12–128 characters.'] } : {}),
      },
    })
  }

  consumeAttempt(`register:${ipKey(ip)}`, 5, RESET_WINDOW_MS)
  const passwordHash = await hashPassword(password)
  let result
  try {
    result = db.prepare(`
      INSERT INTO Users (Email, PasswordHash, Role, CreatedAt)
      VALUES (?, ?, 'viewer', ?)
    `).run(email, passwordHash, new Date().toISOString())
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AuthError(409, 'An account with this email already exists.')
    }
    throw error
  }

  const user = db.prepare('SELECT * FROM Users WHERE Id = ?').get(result.lastInsertRowid)
  return createSession(user)
}

export async function login({ email: rawEmail, password }, ip) {
  const email = normalizeEmail(rawEmail)
  if (!validateEmail(email) || typeof password !== 'string' || password.length > PASSWORD_MAX_LENGTH) {
    throw new AuthError(400, 'Email and password are required.')
  }

  const ipBucket = consumeAttempt(ipKey(ip), LOGIN_FAILURE_LIMIT, LOGIN_WINDOW_MS)
  const accountBucket = consumeAttempt(emailKey(email), LOGIN_FAILURE_LIMIT, LOGIN_WINDOW_MS)
  const user = db.prepare('SELECT * FROM Users WHERE Email = ?').get(email)
  const validPassword = await verifyPassword(password, user?.PasswordHash ?? dummyPasswordHash)

  if (!user || !validPassword) {
    throw new AuthError(401, 'Invalid email or password.')
  }

  clearFailure(ipBucket)
  clearFailure(accountBucket)
  return createSession(user)
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = db.transaction(() => {
    const now = Date.now()
    db.prepare('DELETE FROM AuthSessions WHERE ExpiresAt <= ?').run(now)
    const activeSessions = db.prepare(`
      SELECT COUNT(*) AS count FROM AuthSessions
      WHERE UserId = ? AND ExpiresAt > ?
    `).get(user.Id, now).count
    if (activeSessions >= MAX_ACTIVE_SESSIONS) {
      throw new AuthError(409, 'The maximum number of active sessions has been reached.')
    }

    const expires = now + SESSION_TTL_MS
    db.prepare(`
      INSERT INTO AuthSessions (UserId, TokenHash, CreatedAt, ExpiresAt)
      VALUES (?, ?, ?, ?)
    `).run(user.Id, tokenHash(token), now, expires)
    return expires
  })()

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: publicUser(user),
  }
}

export function authenticate(token) {
  const session = db.prepare(`
    SELECT Users.* FROM AuthSessions
    JOIN Users ON Users.Id = AuthSessions.UserId
    WHERE AuthSessions.TokenHash = ? AND AuthSessions.ExpiresAt > ?
  `).get(tokenHash(token), Date.now())
  return session ? publicUser(session) : null
}

export function listSessions(userId, currentToken) {
  const now = Date.now()
  db.prepare('DELETE FROM AuthSessions WHERE ExpiresAt <= ?').run(now)
  return db.prepare(`
    SELECT Id AS id, CreatedAt AS createdAt, ExpiresAt AS expiresAt, TokenHash
    FROM AuthSessions WHERE UserId = ? ORDER BY CreatedAt DESC
  `).all(userId).map((session) => ({
    id: session.id,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    current: session.TokenHash === tokenHash(currentToken),
  }))
}

export function revokeSession(userId, sessionId) {
  return db.prepare('DELETE FROM AuthSessions WHERE Id = ? AND UserId = ?')
    .run(sessionId, userId).changes > 0
}

export function revokeToken(token) {
  db.prepare('DELETE FROM AuthSessions WHERE TokenHash = ?').run(tokenHash(token))
}

export async function requestPasswordReset(rawEmail, ip, sendEmail) {
  const email = normalizeEmail(rawEmail)
  if (!validateEmail(email)) {
    throw new AuthError(400, 'Enter a valid email address.')
  }

  consumeAttempt(`reset:${ipKey(ip)}`, RESET_REQUEST_LIMIT, RESET_WINDOW_MS)
  const user = db.prepare('SELECT Id FROM Users WHERE Email = ?').get(email)
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + 30 * 60 * 1000

  if (user) {
    db.prepare(`
      INSERT INTO PasswordResetTokens (UserId, TokenHash, ExpiresAt)
      VALUES (?, ?, ?)
      ON CONFLICT(UserId) DO UPDATE SET
        TokenHash = excluded.TokenHash,
        ExpiresAt = excluded.ExpiresAt
    `).run(user.Id, tokenHash(token), expiresAt)
  }

  try {
    await sendEmail(email, user ? token : null)
  } catch (error) {
    if (user) {
      db.prepare('DELETE FROM PasswordResetTokens WHERE UserId = ?').run(user.Id)
    }
    logEvent('error', 'password_reset_email_delivery_failed', {
      error: error.name ?? 'Error',
      code: error.code,
    })
    throw new AuthError(503, 'Email delivery is temporarily unavailable.')
  }

}

export async function resetPassword(token, password) {
  if (typeof token !== 'string' || token.length > 128 || !validatePassword(password)) {
    throw new AuthError(400, 'Validation failed.', {
      errors: {
        ...(!validatePassword(password) ? { password: ['Password must be 12–128 characters.'] } : {}),
        ...((typeof token !== 'string' || !token) ? { token: ['Reset token is required.'] } : {}),
      },
    })
  }

  const resetToken = db.prepare(`
    SELECT UserId FROM PasswordResetTokens
    WHERE TokenHash = ? AND ExpiresAt > ?
  `).get(tokenHash(token), Date.now())
  if (!resetToken) {
    throw new AuthError(400, 'The reset token is invalid or has expired.')
  }

  const passwordHash = await hashPassword(password)
  const update = db.transaction(() => {
    db.prepare('UPDATE Users SET PasswordHash = ? WHERE Id = ?')
      .run(passwordHash, resetToken.UserId)
    db.prepare('DELETE FROM PasswordResetTokens WHERE UserId = ?').run(resetToken.UserId)
    db.prepare('DELETE FROM AuthSessions WHERE UserId = ?').run(resetToken.UserId)
  })
  update()
}

export async function changeUserRole(userId, role, currentUserId) {
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    throw new AuthError(400, 'Role must be admin, editor or viewer.')
  }
  if (userId === currentUserId) {
    throw new AuthError(400, 'You cannot change your own role.')
  }

  const target = db.prepare('SELECT Id, Role FROM Users WHERE Id = ?').get(userId)
  if (!target) {
    throw new AuthError(404, 'User not found.')
  }
  if (target.Role === 'admin' && role !== 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS count FROM Users WHERE Role = 'admin'").get().count
    if (admins <= 1) {
      throw new AuthError(409, 'At least one administrator must remain.')
    }
  }

  db.prepare('UPDATE Users SET Role = ? WHERE Id = ?').run(role, userId)
  return publicUser(db.prepare('SELECT * FROM Users WHERE Id = ?').get(userId))
}

export function listUsers() {
  return db.prepare('SELECT * FROM Users ORDER BY Id').all().map(publicUser)
}

export async function initializeAdmin() {
  const email = normalizeEmail(process.env.AUTH_ADMIN_EMAIL)
  const password = process.env.AUTH_ADMIN_PASSWORD
  if (!email && !password) {
    return
  }
  if (!validateEmail(email) || !validatePassword(password)) {
    throw new Error('Set a valid AUTH_ADMIN_EMAIL and an AUTH_ADMIN_PASSWORD of 12–128 characters.')
  }

  const existing = db.prepare('SELECT Id, Role FROM Users WHERE Email = ?').get(email)
  if (existing && existing.Role !== 'admin') {
    throw new Error('AUTH_ADMIN_EMAIL belongs to an account that is not an administrator.')
  }
  if (!existing) {
    const passwordHash = await hashPassword(password)
    db.prepare(`
      INSERT INTO Users (Email, PasswordHash, Role, CreatedAt)
      VALUES (?, ?, 'admin', ?)
    `).run(email, passwordHash, new Date().toISOString())
  }
}
