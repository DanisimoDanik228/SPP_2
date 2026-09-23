import fs from 'node:fs'
import path from 'node:path'
import db, { uploadsDir } from '../db.js'
import { validateProduct } from '../utils/validation.js'

const insertStatement = db.prepare(`
  INSERT INTO Products (Name, Description, Price, Category, ImageUrl, CreatedAt)
  VALUES (@name, @description, @price, @category, @imageUrl, @createdAt)
`)

function rowToDto(row) {
  if (!row) {
    return null
  }
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description ?? null,
    price: Number(row.Price),
    category: row.Category,
    imageUrl: row.ImageUrl ?? null,
    createdAt: row.CreatedAt,
  }
}

export function getProducts(search) {
  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`
    const rows = db
      .prepare(
        `SELECT * FROM Products
         WHERE Name LIKE @term OR Description LIKE @term OR Category LIKE @term
         ORDER BY CreatedAt DESC, Id DESC`,
      )
      .all({ term })
    return rows.map(rowToDto)
  }

  const rows = db
    .prepare('SELECT * FROM Products ORDER BY CreatedAt DESC, Id DESC')
    .all()
  return rows.map(rowToDto)
}

export function getProductById(id) {
  return rowToDto(db.prepare('SELECT * FROM Products WHERE Id = ?').get(id))
}

export function createProduct({ name, description, price, category, imageUrl }) {
  const result = insertStatement.run({
    name: name.trim(),
    description: description ?? null,
    price: Number(price),
    category: category.trim(),
    imageUrl,
    createdAt: new Date().toISOString(),
  })
  return getProductById(Number(result.lastInsertRowid))
}

export function updateProduct(
  id,
  { name, description, price, category, imageUrl },
) {
  db.prepare(
    `UPDATE Products
     SET Name = @name, Description = @description, Price = @price,
         Category = @category, ImageUrl = @imageUrl
     WHERE Id = @id`,
  ).run({
    id,
    name: name.trim(),
    description: description ?? null,
    price: Number(price),
    category: category.trim(),
    imageUrl,
  })
  return getProductById(id)
}

export function deleteProduct(id) {
  const info = db.prepare('DELETE FROM Products WHERE Id = ?').run(id)
  return info.changes > 0
}

export function deleteImageFile(imageUrl) {
  if (!imageUrl) {
    return
  }
  try {
    const fullPath = path.join(uploadsDir, path.basename(imageUrl))
    fs.unlink(fullPath, () => {})
  } catch {
    // Deleting a file is best effort: it must never break the API call.
  }
}

export { validateProduct as validate }