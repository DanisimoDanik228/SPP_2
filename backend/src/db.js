import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

export const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(moduleDir, '..', 'data'))
export const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? path.join(moduleDir, '..', 'uploads'))

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(uploadsDir, { recursive: true })

const dbPath = process.env.DB_PATH ?? path.join(dataDir, 'products.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS Products (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Description TEXT,
    Price REAL NOT NULL,
    Category TEXT NOT NULL,
    ImageUrl TEXT,
    CreatedAt TEXT NOT NULL
  );
`)

export default db