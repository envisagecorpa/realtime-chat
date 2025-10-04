'use strict';

/**
 * Basic seed script for development
 * Creates sample users, rooms, and messages
 */

const Database = require('better-sqlite3');
const path = require('path');
const { initDatabase } = require('./init');

/**
 * Seed database with sample data
 * @param {string} dbPath - Path to SQLite database file
 */
function seed(dbPath) {
  const db = initDatabase(dbPath, true);

  console.log('[SEED] Starting basic seed...');

  const now = Date.now();

  // Create sample users
  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (username, created_at) VALUES (?, ?)'
  );

  const users = ['alice', 'bob', 'charlie'];
  users.forEach((username) => {
    insertUser.run(username, now);
  });
  console.log(`[SEED] Created ${users.length} sample users`);

  // Get user IDs
  const getUserId = db.prepare('SELECT id FROM users WHERE username = ?');
  const alice = getUserId.get('alice');
  const bob = getUserId.get('bob');
  const charlie = getUserId.get('charlie');

  // Get room IDs
  const getRoomId = db.prepare('SELECT id FROM rooms WHERE name = ?');
  const general = getRoomId.get('general');

  // Create sample messages
  const insertMessage = db.prepare(`
    INSERT INTO messages (user_id, room_id, content, timestamp, delivery_status, created_at)
    VALUES (?, ?, ?, ?, 'sent', ?)
  `);

  const messages = [
    { userId: alice.id, content: 'Hello everyone!' },
    { userId: bob.id, content: 'Hi Alice! How are you?' },
    { userId: charlie.id, content: 'Hey folks!' },
    { userId: alice.id, content: 'Doing great, thanks!' },
  ];

  messages.forEach((msg, index) => {
    insertMessage.run(msg.userId, general.id, msg.content, now + index * 1000, now + index * 1000);
  });

  console.log(`[SEED] Created ${messages.length} sample messages in general room`);
  console.log('[SEED] Basic seed completed');

  db.close();
}

// Run seed if executed directly
if (require.main === module) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/chat.db');
  seed(dbPath);
  process.exit(0);
}

module.exports = { seed };
