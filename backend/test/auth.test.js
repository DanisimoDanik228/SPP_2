import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { test } from 'node:test'

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'producthub-auth-'))
process.env.DATA_DIR = testDataDir
process.env.UPLOADS_DIR = path.join(testDataDir, 'uploads')
process.env.DB_PATH = path.join(testDataDir, 'products.db')
process.env.AUTH_SESSION_TTL_SECONDS = '600'
process.env.AUTH_MAX_ACTIVE_SESSIONS = '3'
process.env.AUTH_ADMIN_EMAIL = 'admin@example.test'
process.env.AUTH_ADMIN_PASSWORD = 'admin-test-password-123'

const [{ default: app }, { initializeAdmin, requestPasswordReset, resetPassword }, { default: db }] = await Promise.all([
  import('../src/app.js'),
  import('../src/services/authService.js'),
  import('../src/db.js'),
])

test('authentication, roles, session limits, lockout and HTTP errors', async (t) => {
  await initializeAdmin()
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    db.close()
    fs.rmSync(testDataDir, { recursive: true, force: true })
  })

  const origin = `http://127.0.0.1:${server.address().port}`
  const json = (body) => ({
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const request = (route, init) => fetch(`${origin}${route}`, init)

  const health = await request('/health')
  assert.equal(health.status, 200)

  const malformed = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
  assert.equal(malformed.status, 400)
  assert.ok(malformed.headers.get('x-request-id'))

  const registration = await request('/api/auth/register', {
    method: 'POST',
    ...json({ email: 'viewer@example.test', password: 'viewer-test-password-123' }),
  })
  assert.equal(registration.status, 201)
  const viewer = await registration.json()
  assert.equal(viewer.user.role, 'viewer')
  assert.ok(viewer.expiresAt)

  const publicProducts = await request('/api/products')
  assert.equal(publicProducts.status, 200)
  assert.equal((await request('/api/products/not-an-id')).status, 400)

  const deniedWrite = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${viewer.token}` },
  })
  assert.equal(deniedWrite.status, 403)

  const firstLogin = await request('/api/auth/login', {
    method: 'POST',
    ...json({ email: 'viewer@example.test', password: 'viewer-test-password-123' }),
  })
  const secondLogin = await request('/api/auth/login', {
    method: 'POST',
    ...json({ email: 'viewer@example.test', password: 'viewer-test-password-123' }),
  })
  assert.equal(firstLogin.status, 200)
  assert.equal(secondLogin.status, 200)

  const overLimit = await request('/api/auth/login', {
    method: 'POST',
    ...json({ email: 'viewer@example.test', password: 'viewer-test-password-123' }),
  })
  assert.equal(overLimit.status, 409)

  const sessionsResponse = await request('/api/auth/sessions', {
    headers: { Authorization: `Bearer ${viewer.token}` },
  })
  const sessions = await sessionsResponse.json()
  assert.equal(sessions.length, 3)
  assert.equal(sessions.filter((session) => session.current).length, 1)
  const revoke = await request(`/api/auth/sessions/${sessions[1].id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${viewer.token}` },
  })
  assert.equal(revoke.status, 204)

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    ...json({ email: 'admin@example.test', password: 'admin-test-password-123' }),
  })
  assert.equal(adminLogin.status, 200)
  const admin = await adminLogin.json()
  const promote = await request(`/api/auth/users/${viewer.user.id}/role`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'editor' }),
  })
  assert.equal(promote.status, 200)
  assert.equal((await promote.json()).role, 'editor')

  const productForm = new FormData()
  productForm.set('name', 'Sample product')
  productForm.set('price', '10')
  productForm.set('category', 'Sample')
  const created = await request('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${viewer.token}` },
    body: productForm,
  })
  assert.equal(created.status, 201)

  const resetUnavailable = await request('/api/auth/password/forgot', {
    method: 'POST',
    ...json({ email: 'viewer@example.test' }),
  })
  assert.equal(resetUnavailable.status, 503)

  let resetToken
  await requestPasswordReset('viewer@example.test', 'test-reset-ip', async (_email, token) => {
    resetToken = token
  })
  assert.equal(typeof resetToken, 'string')
  await resetPassword(resetToken, 'viewer-new-password-123')
  const oldPasswordLogin = await request('/api/auth/login', {
    method: 'POST',
    ...json({ email: 'viewer@example.test', password: 'viewer-test-password-123' }),
  })
  assert.equal(oldPasswordLogin.status, 401)
  const newPasswordLogin = await request('/api/auth/login', {
    method: 'POST',
    ...json({ email: 'viewer@example.test', password: 'viewer-new-password-123' }),
  })
  assert.equal(newPasswordLogin.status, 200)
  const newPasswordSession = await newPasswordLogin.json()
  assert.equal((await request('/api/auth/password/reset', {
    method: 'POST',
    ...json({ token: resetToken, password: 'another-new-password-123' }),
  })).status, 400)

  const loggedOut = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${newPasswordSession.token}` },
  })
  assert.equal(loggedOut.status, 204)
  const revokedToken = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${viewer.token}` },
  })
  assert.equal(revokedToken.status, 401)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await request('/api/auth/login', {
      method: 'POST',
      ...json({ email: 'unknown@example.test', password: 'wrong-password-123' }),
    })
    assert.equal(failed.status, 401)
  }
  const throttled = await request('/api/auth/login', {
    method: 'POST',
    ...json({ email: 'unknown@example.test', password: 'wrong-password-123' }),
  })
  assert.equal(throttled.status, 429)
  assert.ok(Number(throttled.headers.get('retry-after')) > 0)
})
