import { Router } from 'express'
import { uploadSingleImage, discardUpload } from '../middlewares/upload.js'
import {
  createProduct,
  deleteProduct,
  deleteImageFile,
  getProductById,
  getProducts,
  updateProduct,
  validate,
} from '../services/productService.js'

const router = Router()

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function validationError(errors) {
  return {
    status: 400,
    body: {
      message: 'Validation failed',
      errors,
    },
  }
}

// GET /api/products
router.get('/', (req, res) => {
  const products = getProducts(req.query.search)
  res.json(products)
})

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    res.status(404).json({ message: `Product with id ${req.params.id} was not found.` })
    return
  }

  const product = getProductById(id)
  if (!product) {
    res.status(404).json({ message: `Product with id ${id} was not found.` })
    return
  }

  res.json(product)
})

// POST /api/products
router.post('/', uploadSingleImage, (req, res) => {
  const { name, description, price, category } = req.body
  const errors = validate({ name, description, price, category })

  if (Object.keys(errors).length > 0) {
    discardUpload(req.file)
    const { status, body } = validationError(errors)
    res.status(status).json(body)
    return
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null
  const product = createProduct({ name, description, price, category, imageUrl })
  res.status(201).location(`/api/products/${product.id}`).json(product)
})

// PUT /api/products/:id
router.put('/:id', uploadSingleImage, (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    discardUpload(req.file)
    res.status(404).json({ message: `Product with id ${req.params.id} was not found.` })
    return
  }

  const existing = getProductById(id)
  if (!existing) {
    discardUpload(req.file)
    res.status(404).json({ message: `Product with id ${id} was not found.` })
    return
  }

  const { name, description, price, category } = req.body
  const errors = validate({ name, description, price, category })

  if (Object.keys(errors).length > 0) {
    discardUpload(req.file)
    const { status, body } = validationError(errors)
    res.status(status).json(body)
    return
  }

  let imageUrl = existing.imageUrl
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`
    if (existing.imageUrl) {
      deleteImageFile(existing.imageUrl)
    }
  }

  const product = updateProduct(id, { name, description, price, category, imageUrl })
  res.json(product)
})

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    res.status(404).json({ message: `Product with id ${req.params.id} was not found.` })
    return
  }

  const existing = getProductById(id)
  if (!existing) {
    res.status(404).json({ message: `Product with id ${id} was not found.` })
    return
  }

  deleteProduct(id)
  deleteImageFile(existing.imageUrl)
  res.status(204).end()
})

export default router