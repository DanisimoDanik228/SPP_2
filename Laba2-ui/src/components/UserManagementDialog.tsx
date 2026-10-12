import { useEffect, useState } from 'react'
import { ApiError, getUsers, updateUserRole } from '../services/api'
import type { AuthUser, UserRole } from '../types/product'
import { ProductModal } from './ProductModal'

interface UserManagementDialogProps {
  currentUserId: number
  onClose: () => void
}

const roles: UserRole[] = ['viewer', 'editor', 'admin']

export function UserManagementDialog({ currentUserId, onClose }: UserManagementDialogProps) {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void getUsers()
      .then((data) => { if (active) setUsers(data) })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof ApiError ? requestError.message : 'Could not load users.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function changeRole(user: AuthUser, role: UserRole) {
    setError('')
    try {
      const updated = await updateUserRole(user.id, role)
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Could not update the role.')
    }
  }

  return (
    <ProductModal title="Manage users" onClose={onClose}>
      {loading && <p className="field-hint">Loading users…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {!loading && users.map((user) => (
        <div className="user-row" key={user.id}>
          <span>{user.email}</span>
          <select
            aria-label={`Role for ${user.email}`}
            value={user.role}
            disabled={user.id === currentUserId}
            onChange={(event) => void changeRole(user, event.target.value as UserRole)}
          >
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>
      ))}
    </ProductModal>
  )
}
