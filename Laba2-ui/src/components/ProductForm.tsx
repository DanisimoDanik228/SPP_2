import { useEffect, useRef, useState } from 'react'
import type { Product, ProductInput } from '../types/product'
import { imageSrc } from '../services/api'

interface ProductFormProps {
  initial?: Product | null
  submitting: boolean
  fieldErrors?: Record<string, string[]>
  onSubmit: (data: ProductInput) => void
  onCancel: () => void
}

type LocalErrors = Partial<Record<'name' | 'price' | 'category' | 'image', string>>

export function ProductForm({
  initial,
  submitting,
  fieldErrors,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>(initial?.imageUrl ?? '')
  const [errors, setErrors] = useState<LocalErrors>({})
  const objectUrlRef = useRef('')

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = ''
    setFile(selected)
    if (selected) {
      const objectUrl = URL.createObjectURL(selected)
      objectUrlRef.current = objectUrl
      setPreview(objectUrl)
    } else {
      setPreview(initial?.imageUrl ?? '')
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const nextErrors: LocalErrors = {}
    if (!name.trim()) {
      nextErrors.name = 'Name is required.'
    }
    const priceValue = Number(price)
    if (!price || Number.isNaN(priceValue)) {
      nextErrors.price = 'Price is required.'
    } else if (priceValue <= 0) {
      nextErrors.price = 'Price must be greater than 0.'
    }
    if (!category.trim()) {
      nextErrors.category = 'Category is required.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      price: priceValue,
      category: category.trim(),
      image: file ?? undefined,
    })
  }

  const errorText = (field: 'name' | 'description' | 'price' | 'category' | 'image'): string | undefined => {
    const server = fieldErrors?.[field]?.[0]
    const local = errors[field as keyof LocalErrors]
    return server ?? local
  }

  const hasFieldError = (field: 'name' | 'description' | 'price' | 'category' | 'image'): boolean =>
    Boolean(fieldErrors?.[field]?.length) || Boolean(errors[field as keyof LocalErrors])

  return (
    <form className="product-form" onSubmit={handleSubmit} noValidate>
      <div className={`form-field${hasFieldError('name') ? ' has-error' : ''}`}>
        <label htmlFor="product-name">Name</label>
        <input
          id="product-name"
          type="text"
          value={name}
          placeholder="e.g. MacBook Pro"
          onChange={(event) => setName(event.target.value)}
        />
        {errorText('name') && <p className="field-error">{errorText('name')}</p>}
      </div>

      <div className={`form-field${hasFieldError('description') ? ' has-error' : ''}`}>
        <label htmlFor="product-description">Description</label>
        <textarea
          id="product-description"
          rows={3}
          value={description}
          placeholder="Short description (optional)"
          onChange={(event) => setDescription(event.target.value)}
        />
        {errorText('description') && <p className="field-error">{errorText('description')}</p>}
      </div>

      <div className="form-row">
        <div className={`form-field${hasFieldError('price') ? ' has-error' : ''}`}>
          <label htmlFor="product-price">Price</label>
          <input
            id="product-price"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={price}
            placeholder="0.00"
            onChange={(event) => setPrice(event.target.value)}
          />
          {errorText('price') && <p className="field-error">{errorText('price')}</p>}
        </div>

        <div className={`form-field${hasFieldError('category') ? ' has-error' : ''}`}>
          <label htmlFor="product-category">Category</label>
          <input
            id="product-category"
            type="text"
            value={category}
            placeholder="e.g. Laptops"
            onChange={(event) => setCategory(event.target.value)}
          />
          {errorText('category') && <p className="field-error">{errorText('category')}</p>}
        </div>
      </div>

      <div className={`form-field${hasFieldError('image') ? ' has-error' : ''}`}>
        <label htmlFor="product-image">Image</label>
        {preview && (
          <div className="image-preview">
            <img src={imageSrc(preview)} alt="Preview" />
          </div>
        )}
        <input
          id="product-image"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
        />
        <p className="field-hint">JPG, PNG, GIF or WEBP. Max 5 MB.</p>
        {errorText('image') && <p className="field-error">{errorText('image')}</p>}
      </div>

      <div className="modal-actions form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : initial ? 'Save changes' : 'Create product'}
        </button>
      </div>
    </form>
  )
}