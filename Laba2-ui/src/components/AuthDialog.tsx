import { useState, type FormEvent } from 'react'
import {
  ApiError,
  login,
  register,
  requestPasswordReset,
  resetPassword,
  setStoredSession,
} from '../services/api'
import type { AuthSession } from '../types/product'
import { ProductModal } from './ProductModal'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

interface AuthDialogProps {
  onClose: () => void
  onAuthenticated: (session: AuthSession) => void
}

const titles: Record<Mode, string> = {
  login: 'Sign in',
  register: 'Create account',
  forgot: 'Reset password',
  reset: 'Choose a new password',
}

export function AuthDialog({ onClose, onAuthenticated }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'login' || mode === 'register') {
        const session = mode === 'login'
          ? await login(email, password)
          : await register(email, password)
        setStoredSession(session)
        onAuthenticated(session)
      } else if (mode === 'forgot') {
        const response = await requestPasswordReset(email)
        setMessage(response.message)
      } else {
        await resetPassword(token, password)
        setPassword('')
        setToken('')
        setMode('login')
        setMessage('Password updated. Sign in with your new password.')
      }
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProductModal title={titles[mode]} onClose={onClose}>
      <form className="product-form" onSubmit={(event) => void submit(event)}>
        {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
          <div className="form-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        )}
        {(mode === 'login' || mode === 'register' || mode === 'reset') && (
          <div className="form-field">
            <label htmlFor="auth-password">{mode === 'login' ? 'Password' : 'Password (12 characters minimum)'}</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        )}
        {mode === 'reset' && (
          <div className="form-field">
            <label htmlFor="auth-reset-token">One-time reset token</label>
            <input
              id="auth-reset-token"
              autoComplete="off"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        {message && <p className="field-hint" role="status">{message}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'forgot' ? 'Send instructions' : mode === 'reset' ? 'Update password' : titles[mode]}
          </button>
        </div>
      </form>
      <div className="auth-links">
        {mode === 'login' && (
          <>
            <button type="button" className="auth-link" onClick={() => setMode('forgot')}>Forgot password?</button>
            <button type="button" className="auth-link" onClick={() => setMode('register')}>Create an account</button>
          </>
        )}
        {mode !== 'login' && (
          <button type="button" className="auth-link" onClick={() => { setMode('login'); setError(''); setMessage('') }}>
            Back to sign in
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="auth-link" onClick={() => setMode('reset')}>I have a reset token</button>
        )}
      </div>
    </ProductModal>
  )
}
