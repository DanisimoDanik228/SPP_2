import { Router } from 'express'
import nodemailer from 'nodemailer'
import { requireAuth, requireRole } from '../middlewares/auth.js'
import {
  AuthError,
  changeUserRole,
  listSessions,
  listUsers,
  login,
  register,
  requestPasswordReset,
  resetPassword,
  revokeSession,
  revokeToken,
} from '../services/authService.js'

const router = Router()

function getMailer() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = process.env.SMTP_SECURE === 'true'
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AuthError(503, 'Email delivery is not configured.')
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  })
}

async function sendResetEmail(email, token) {
  const mailer = getMailer()
  const resetText = token
    ? `Use this one-time password reset token in ProductHub:\n\n${token}\n\nIt expires in 30 minutes. If you did not request this, ignore this message.`
    : 'If an account exists for this address, a password reset message will be sent. If you did not request this, ignore this message.'

  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'ProductHub password reset',
    text: resetText,
  })
}

router.post('/register', async (req, res) => {
  const session = await register(req.body ?? {}, req.ip)
  res.status(201).json(session)
})

router.post('/login', async (req, res) => {
  const session = await login(req.body ?? {}, req.ip)
  res.json(session)
})

router.post('/logout', requireAuth, (req, res) => {
  revokeToken(req.authToken)
  res.status(204).end()
})

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

router.get('/sessions', requireAuth, (req, res) => {
  res.json(listSessions(req.user.id, req.authToken))
})

router.delete('/sessions/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AuthError(400, 'Session id must be a positive integer.')
  }
  if (!revokeSession(req.user.id, id)) {
    throw new AuthError(404, 'Session not found.')
  }
  res.status(204).end()
})

router.post('/password/forgot', async (req, res) => {
  await requestPasswordReset(req.body?.email, req.ip, sendResetEmail)
  res.status(202).json({
    message: 'If an account exists for this email, password reset instructions have been sent.',
  })
})

router.post('/password/reset', async (req, res) => {
  await resetPassword(req.body?.token, req.body?.password)
  res.status(204).end()
})

router.get('/users', requireAuth, requireRole('admin'), (_req, res) => {
  res.json(listUsers())
})

router.patch('/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AuthError(400, 'User id must be a positive integer.')
  }
  res.json(await changeUserRole(id, req.body?.role, req.user.id))
})

export default router
