'use strict';

/**
 * Database migration script for real-time chat system
 * Creates SQLite schema with WAL mode for concurrent access
 */

const Database = require('better-sqlite3');
const path = require('path');

/**
 * Run database migration
 * @param {string} dbPath - Path to SQLite database file
 * @returns {Database} - Database instance
 */
function migrate(dbPath) {
  console.log(`[DB] Running migration on ${dbPath}...`);

  const db = new Database(dbPath);

  // Enable WAL mode for concurrent reads during writes (DP-004)
  db.pragma('journal_mode = WAL');
  console.log('[DB] Enabled WAL mode for concurrent access');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NULL,
      CHECK(length(username) >= 3 AND length(username) <= 20)
    );
  `);
  console.log('[DB] Created users table');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
  console.log('[DB] Created index on users.username');

  // Create rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      deleted_at INTEGER NULL,
      CHECK(length(name) >= 3 AND length(name) <= 50),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  console.log('[DB] Created rooms table');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);
  `);
  console.log('[DB] Created index on rooms.name');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(deleted_at) WHERE deleted_at IS NULL;
  `);
  console.log('[DB] Created partial index on rooms.deleted_at for active rooms');

  // Create messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      content TEXT NOT NULL CHECK(length(content) > 0 AND length(content) <= 2000),
      timestamp INTEGER NOT NULL CHECK(timestamp > 0),
      delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending', 'sent', 'failed')),
      retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0 AND retry_count <= 3),
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );
  `);
  console.log('[DB] Created messages table');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages(room_id, timestamp);
  `);
  console.log('[DB] Created composite index on messages(room_id, timestamp)');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
  `);
  console.log('[DB] Created index on messages.user_id');

  console.log('[DB] Migration completed successfully');
  return db;
}

// Run migration if executed directly
if (require.main === module) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/chat.db');
  migrate(dbPath);
  process.exit(0);
}

module.exports = { migrate };
