'use strict';

/**
 * Database initialization script
 * Checks if database exists, runs migration, seeds default data
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { migrate } = require('./migrate');

/**
 * Initialize database with migration and optional seeding
 * @param {string} dbPath - Path to SQLite database file
 * @param {boolean} seed - Whether to seed default data
 * @returns {Database} - Database instance
 */
function initDatabase(dbPath, seed = false) {
  const dataDir = path.dirname(dbPath);

  // Create data directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[DB] Created data directory: ${dataDir}`);
  }

  const dbExists = fs.existsSync(dbPath);
  console.log(`[DB] Database ${dbExists ? 'exists' : 'does not exist'} at ${dbPath}`);

  // Run migration
  const db = migrate(dbPath);

  // Seed default rooms if requested and database is new
  if (seed || !dbExists) {
    console.log('[DB] Seeding default rooms...');

    // Create a default user for seeding
    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (username, created_at) VALUES (?, ?)'
    );
    const now = Date.now();
    insertUser.run('system', now);

    const systemUser = db.prepare('SELECT id FROM users WHERE username = ?').get('system');

    // Insert default rooms
    const insertRoom = db.prepare(
      'INSERT OR IGNORE INTO rooms (name, created_at, created_by_user_id) VALUES (?, ?, ?)'
    );

    insertRoom.run('general', now, systemUser.id);
    insertRoom.run('random', now, systemUser.id);
    insertRoom.run('help', now, systemUser.id);

    console.log('[DB] Seeded default rooms: general, random, help');
  }

  return db;
}

// Run initialization if executed directly
if (require.main === module) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/chat.db');
  const shouldSeed = process.argv.includes('--seed');
  initDatabase(dbPath, shouldSeed);
  console.log('[DB] Initialization complete');
  process.exit(0);
}

module.exports = { initDatabase };
