export const MAX_NAME_LENGTH = 100
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_CATEGORY_LENGTH = 50
export const MAX_PRICE = 1_000_000

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

export function isAllowedImage(originalName, mimeType) {
  const extension = pathExtension(originalName)
  return (
    ALLOWED_IMAGE_EXTENSIONS.has(extension) &&
    ALLOWED_IMAGE_MIME_TYPES.has(mimeType)
  )
}

export function pathExtension(fileName) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName ?? '')
  return match ? `.${match[1].toLowerCase()}` : ''
}

/**
 * Returns a map of field name -> error messages. Empty map means valid.
 */
export function validateProduct({ name, description, price, category }) {
  const errors = {}

  const add = (field, message) => {
    if (!errors[field]) {
      errors[field] = []
    }
    errors[field].push(message)
  }

  if (name === undefined || name === null || name.trim() === '') {
    add('name', 'Name is required.')
  } else {
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > MAX_NAME_LENGTH) {
      add('name', `Name must be between 2 and ${MAX_NAME_LENGTH} characters.`)
    }
  }

  if (
    description !== undefined &&
    description !== null &&
    description.trim() !== '' &&
    description.trim().length > MAX_DESCRIPTION_LENGTH
  ) {
    add('description', `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`)
  }

  if (price === undefined || price === null || price === '') {
    add('price', 'Price is required.')
  } else {
    const parsed = Number(price)
    if (Number.isNaN(parsed)) {
      add('price', 'Price must be a valid number.')
    } else if (parsed <= 0) {
      add('price', 'Price must be greater than 0.')
    } else if (parsed > MAX_PRICE) {
      add('price', `Price must be at most ${MAX_PRICE}.`)
    }
  }

  if (category === undefined || category === null || category.trim() === '') {
    add('category', 'Category is required.')
  } else {
    const trimmed = category.trim()
    if (trimmed.length < 2 || trimmed.length > MAX_CATEGORY_LENGTH) {
      add('category', `Category must be between 2 and ${MAX_CATEGORY_LENGTH} characters.`)
    }
  }

  return errors
}