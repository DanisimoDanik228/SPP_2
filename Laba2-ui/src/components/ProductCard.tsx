import type { Product } from '../types/product'
import { imageSrc } from '../services/api'

interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  return (
    <article className="product-card">
      <div className="product-image">
        {product.imageUrl ? (
          <img
            src={imageSrc(product.imageUrl)}
            alt={product.name}
            loading="lazy"
          />
        ) : (
          <div className="product-image-placeholder">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 5h16v14H4z M4 17l5-5 4 4 3-3 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="9.5" cy="9.5" r="1.6" fill="currentColor" />
            </svg>
          </div>
        )}
        <span className="product-category">{product.category}</span>
      </div>

      <div className="product-body">
        <h3 className="product-name" title={product.name}>
          {product.name}
        </h3>
        {product.description && (
          <p className="product-description">{product.description}</p>
        )}
        <div className="product-footer">
          <span className="product-price">{priceFormatter.format(product.price)}</span>
          <div className="product-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onEdit(product)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger-outline"
              onClick={() => onDelete(product)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}