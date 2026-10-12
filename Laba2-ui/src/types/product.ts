export interface Product {
  id: number
  name: string
  description?: string | null
  price: number
  category: string
  imageUrl?: string | null
  createdAt: string
}

export interface ProductInput {
  name: string
  description?: string
  price: number
  category: string
  image?: File | null
}

export interface ApiErrorBody {
  message?: string
  errors?: Record<string, string[]>
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface AuthUser {
  id: number
  email: string
  role: UserRole
  createdAt: string
}

export interface AuthSession {
  token: string
  expiresAt: string
  user: AuthUser
}

export interface AuthSessionSummary {
  id: number
  createdAt: string
  expiresAt: string
  current: boolean
}