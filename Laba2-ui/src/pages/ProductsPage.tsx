import { useCallback, useEffect, useRef, useState } from 'react'
import type { Product, ProductInput } from '../types/product'
import {
  ApiError,
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from '../services/api'
import { ProductCard } from '../components/ProductCard'
import { ProductForm } from '../components/ProductForm'
import { ProductModal } from '../components/ProductModal'
import { SearchBar } from '../components/SearchBar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Toast, type ToastMessage } from '../components/Toast'

type ModalState = { mode: 'create' } | { mode: 'edit'; product: Product } | null

const SKELETON_COUNT = 6

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const toastId = useRef(0)

  const load = useCallback(async (term: string) => {
    setStatus('loading')
    try {
      const data = await getProducts(term)
      setProducts(data)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = await getProducts('')
        if (active) {
          setProducts(data)
          setStatus('ready')
        }
      } catch {
        if (active) {
          setStatus('error')
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleSearch = useCallback(
    (term: string) => {
      setSearch(term)
      void load(term)
    },
    [load],
  )

  const notify = useCallback((kind: ToastMessage['kind'], text: string) => {
    const id = ++toastId.current
    setToasts((prev) => [...prev, { id, kind, text }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const handleCreate = useCallback(
    async (data: ProductInput) => {
      setSubmitting(true)
      setFieldErrors({})
      try {
        await createProduct(data)
        setModal(null)
        notify('success', 'Product created successfully')
        void load(search)
      } catch (error) {
        if (error instanceof ApiError && error.errors) {
          setFieldErrors(error.errors)
        } else {
          notify('error', error instanceof ApiError ? error.message : 'Failed to create product.')
        }
      } finally {
        setSubmitting(false)
      }
    },
    [load, notify, search],
  )

  const handleUpdate = useCallback(
    async (id: number, data: ProductInput) => {
      setSubmitting(true)
      setFieldErrors({})
      try {
        await updateProduct(id, data)
        setModal(null)
        notify('success', 'Product updated successfully')
        void load(search)
      } catch (error) {
        if (error instanceof ApiError && error.errors) {
          setFieldErrors(error.errors)
        } else {
          notify('error', error instanceof ApiError ? error.message : 'Failed to update product.')
        }
      } finally {
        setSubmitting(false)
      }
    },
    [load, notify, search],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return
    }
    const targetId = deleteTarget.id
    setSubmitting(true)
    try {
      await deleteProduct(targetId)
      setDeleteTarget(null)
      notify('success', 'Product deleted successfully')
      setProducts((prev) => prev.filter((product) => product.id !== targetId))
    } catch (error) {
      setDeleteTarget(null)
      notify('error', error instanceof ApiError ? error.message : 'Failed to delete product.')
    } finally {
      setSubmitting(false)
    }
  }, [deleteTarget, notify])

  const closeModal = useCallback(() => {
    setFieldErrors({})
    setModal(null)
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">ProductHub</h1>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <span className="btn-plus">+</span> Add Product
        </button>
      </header>

      <SearchBar onChange={handleSearch} disabled={status === 'loading'} />

      {status === 'error' && (
        <div className="state-block">
          <p className="state-text">Failed to load products</p>
          <button type="button" className="btn btn-primary" onClick={() => void load(search)}>
            Try again
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="product-grid">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div key={index} className="product-card skeleton" aria-hidden="true">
              <div className="skeleton-image"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
            </div>
          ))}
        </div>
      )}

      {status === 'ready' && products.length === 0 && (
        <div className="state-block">
          <p className="state-text">
            {search.trim() ? 'No products found for this search.' : 'No products found'}
          </p>
          {!search.trim() && (
            <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
              Create the first product
            </button>
          )}
        </div>
      )}

      {status === 'ready' && products.length > 0 && (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={(productToEdit) => {
                setFieldErrors({})
                setModal({ mode: 'edit', product: productToEdit })
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {modal && (
        <ProductModal
          title={modal.mode === 'edit' ? 'Edit product' : 'Add product'}
          onClose={closeModal}
        >
          <ProductForm
            initial={modal.mode === 'edit' ? modal.product : null}
            submitting={submitting}
            fieldErrors={fieldErrors}
            onSubmit={
              modal.mode === 'edit'
                ? (data) => handleUpdate(modal.product.id, data)
                : handleCreate
            }
            onCancel={closeModal}
          />
        </ProductModal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete product"
          message={`Are you sure you want to delete "${deleteTarget.name}"?`}
          busy={submitting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}