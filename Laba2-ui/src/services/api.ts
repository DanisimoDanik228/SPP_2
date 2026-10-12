import type {
  ApiErrorBody,
  AuthSession,
  AuthSessionSummary,
  AuthUser,
  Product,
  ProductInput,
} from '../types/product'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const AUTH_SESSION_KEY = 'producthub.auth'

function readStoredSession(): AuthSession | null {
  const value = sessionStorage.getItem(AUTH_SESSION_KEY)
  if (!value) return null
  try {
    return JSON.parse(value) as AuthSession
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
    return null
  }
}

export function getStoredUser(): AuthUser | null {
  return readStoredSession()?.user ?? null
}

export function setStoredSession(session: AuthSession | null): void {
  if (session) {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  } else {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
  }
}

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

function toFormData(data: ProductInput): FormData {
  const form = new FormData()
  form.append('name', data.name)
  if (data.description) {
    form.append('description', data.description)
  }
  form.append('price', String(data.price))
  form.append('category', data.category)
  if (data.image) {
    form.append('image', data.image)
  }
  return form
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const token = readStoredSession()?.token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Failed to connect to the server.', 0)
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`
    let errors: Record<string, string[]> | undefined
    try {
      const body = (await response.json()) as ApiErrorBody
      if (body.message) message = body.message
      errors = body.errors
    } catch {
      // Response body is not JSON — keep the generic message.
    }
    throw new ApiError(message, response.status, errors)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function imageSrc(url?: string | null): string {
  if (!url) {
    return ''
  }
  if (url.startsWith('http')) {
    return url
  }
  return `${BASE_URL}${url}`
}

export function getProducts(search?: string): Promise<Product[]> {
  const query = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
  return request<Product[]>(`/api/products${query}`)
}

export function getProduct(id: number): Promise<Product> {
  return request<Product>(`/api/products/${id}`)
}

export function createProduct(data: ProductInput): Promise<Product> {
  return request<Product>('/api/products', {
    method: 'POST',
    body: toFormData(data),
  })
}

export function updateProduct(id: number, data: ProductInput): Promise<Product> {
  return request<Product>(`/api/products/${id}`, {
    method: 'PUT',
    body: toFormData(data),
  })
}

export function deleteProduct(id: number): Promise<void> {
  return request<void>(`/api/products/${id}`, {
    method: 'DELETE',
  })
}

export function login(email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function register(email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' })
}

export function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me')
}

export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return request<{ message: string }>('/api/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(token: string, password: string): Promise<void> {
  return request<void>('/api/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export function getUsers(): Promise<AuthUser[]> {
  return request<AuthUser[]>('/api/auth/users')
}

export function updateUserRole(id: number, role: AuthUser['role']): Promise<AuthUser> {
  return request<AuthUser>(`/api/auth/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function getActiveSessions(): Promise<AuthSessionSummary[]> {
  return request<AuthSessionSummary[]>('/api/auth/sessions')
}

export function revokeActiveSession(id: number): Promise<void> {
  return request<void>(`/api/auth/sessions/${id}`, { method: 'DELETE' })
}