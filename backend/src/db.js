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
db.pragma('foreign_keys = ON')
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

  CREATE TABLE IF NOT EXISTS Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    PasswordHash TEXT NOT NULL,
    Role TEXT NOT NULL CHECK (Role IN ('admin', 'editor', 'viewer')),
    CreatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS AuthSessions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
    TokenHash TEXT NOT NULL UNIQUE,
    CreatedAt INTEGER NOT NULL,
    ExpiresAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_expiry
    ON AuthSessions(UserId, ExpiresAt);

  CREATE TABLE IF NOT EXISTS LoginAttempts (
    Bucket TEXT PRIMARY KEY,
    WindowStartedAt INTEGER NOT NULL,
    FailureCount INTEGER NOT NULL,
    LockedUntil INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_login_attempts_window
    ON LoginAttempts(WindowStartedAt);

  CREATE TABLE IF NOT EXISTS PasswordResetTokens (
    UserId INTEGER PRIMARY KEY REFERENCES Users(Id) ON DELETE CASCADE,
    TokenHash TEXT NOT NULL UNIQUE,
    ExpiresAt INTEGER NOT NULL
  );
`)

export default db