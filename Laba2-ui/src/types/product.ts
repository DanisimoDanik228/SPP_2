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