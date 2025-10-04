'use strict';

/**
 * User model for managing chat participants
 * Provides CRUD operations for users with username validation
 */

const { validateUsername } = require('../../../shared/types/user-validation');

/**
 * User model class
 */
class User {
  /**
   * Create a User model instance
   * @param {Database} db - better-sqlite3 database instance
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new user
   * @param {string} username - Unique username (3-20 alphanumeric + underscore)
   * @returns {{id: number, username: string, created_at: number, last_seen_at: null}} Created user
   * @throws {Error} If username is invalid or already exists
   */
  create(username) {
    const validation = validateUsername(username);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const stmt = this.db.prepare(`
      INSERT INTO users (username, created_at, last_seen_at)
      VALUES (?, ?, NULL)
    `);

    const now = Date.now();
    const result = stmt.run(username, now);

    return {
      id: result.lastInsertRowid,
      username,
      created_at: now,
      last_seen_at: null,
    };
  }

  /**
   * Find user by username
   * @param {string} username - Username to search for
   * @returns {{id: number, username: string, created_at: number, last_seen_at: number|null}|null} User or null if not found
   */
  findByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) || null;
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {{id: number, username: string, created_at: number, last_seen_at: number|null}|null} User or null if not found
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) || null;
  }

  /**
   * Update user's last seen timestamp
   * @param {number} id - User ID
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {boolean} True if updated successfully
   */
  updateLastSeen(id, timestamp) {
    const stmt = this.db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?');
    const result = stmt.run(timestamp, id);
    return result.changes > 0;
  }

  /**
   * List all users
   * @returns {Array<{id: number, username: string, created_at: number, last_seen_at: number|null}>} Array of users
   */
  list() {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all();
  }

  /**
   * Delete user by ID
   * @param {number} id - User ID
   * @returns {boolean} True if deleted successfully
   */
  delete(id) {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

module.exports = User;
