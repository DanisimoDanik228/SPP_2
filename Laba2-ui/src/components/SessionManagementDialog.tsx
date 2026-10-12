import { useEffect, useState } from 'react'
import { ApiError, getActiveSessions, revokeActiveSession } from '../services/api'
import type { AuthSessionSummary } from '../types/product'
import { ProductModal } from './ProductModal'

interface SessionManagementDialogProps {
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function SessionManagementDialog({ onClose }: SessionManagementDialogProps) {
  const [sessions, setSessions] = useState<AuthSessionSummary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void getActiveSessions()
      .then((data) => { if (active) setSessions(data) })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof ApiError ? requestError.message : 'Could not load sessions.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function revoke(session: AuthSessionSummary) {
    setError('')
    setRevokingId(session.id)
    try {
      await revokeActiveSession(session.id)
      setSessions((current) => current.filter((item) => item.id !== session.id))
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not revoke this session.')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <ProductModal title="Active sessions" onClose={onClose}>
      {loading && <p className="field-hint">Loading sessions…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {!loading && sessions.length === 0 && <p className="field-hint">No active sessions.</p>}
      {!loading && sessions.map((session) => (
        <div className="session-row" key={session.id}>
          <div>
            <strong>{session.current ? 'This session' : 'Signed in'}</strong>
            <p className="field-hint">
              Started {dateFormatter.format(new Date(session.createdAt))}<br />
              Expires {dateFormatter.format(new Date(session.expiresAt))}
            </p>
          </div>
          {!session.current && (
            <button
              type="button"
              className="btn btn-sm btn-danger-outline"
              disabled={revokingId !== null}
              onClick={() => void revoke(session)}
            >
              {revokingId === session.id ? 'Revoking…' : 'Revoke'}
            </button>
          )}
        </div>
      ))}
    </ProductModal>
  )
}
