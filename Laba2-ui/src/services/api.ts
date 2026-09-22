import type { ApiErrorBody, Product, ProductInput } from '../types/product'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

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
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, init)
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