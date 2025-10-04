'use strict';

/**
 * Large seed script for testing pagination and performance
 * Creates 500+ messages for testing PR-002 (load history <2s)
 */

const Database = require('better-sqlite3');
const path = require('path');
const { initDatabase } = require('./init');

/**
 * Seed database with large dataset for performance testing
 * @param {string} dbPath - Path to SQLite database file
 */
function seedLarge(dbPath) {
  const db = initDatabase(dbPath, true);

  console.log('[SEED] Starting large dataset seed (500 messages)...');

  const now = Date.now();

  // Create more sample users
  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (username, created_at) VALUES (?, ?)'
  );

  const users = ['alice', 'bob', 'charlie', 'dave', 'eve', 'frank', 'grace', 'heidi'];
  users.forEach((username) => {
    insertUser.run(username, now);
  });
  console.log(`[SEED] Created/verified ${users.length} sample users`);

  // Get user IDs
  const getUserId = db.prepare('SELECT id FROM users WHERE username = ?');
  const userIds = users.map((username) => getUserId.get(username).id);

  // Get general room
  const getRoomId = db.prepare('SELECT id FROM rooms WHERE name = ?');
  const general = getRoomId.get('general');

  // Create 500 messages using transaction for performance
  const insertMessage = db.prepare(`
    INSERT INTO messages (user_id, room_id, content, timestamp, delivery_status, created_at)
    VALUES (?, ?, ?, ?, 'sent', ?)
  `);

  const insertMany = db.transaction((count) => {
    for (let i = 0; i < count; i++) {
      const userId = userIds[i % userIds.length];
      const content = `Test message ${i + 1} - Lorem ipsum dolor sit amet`;
      const timestamp = now + i * 100; // 100ms apart
      insertMessage.run(userId, general.id, content, timestamp, timestamp);
    }
  });

  insertMany(500);

  console.log('[SEED] Created 500 test messages in general room');
  console.log('[SEED] Large dataset seed completed');

  db.close();
}

// Run seed if executed directly
if (require.main === module) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/chat.db');
  seedLarge(dbPath);
  process.exit(0);
}

module.exports = { seedLarge };
