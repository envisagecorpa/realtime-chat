'use strict';

/**
 * Room model for managing chat rooms
 * Provides room CRUD, soft delete, and active room queries
 */

const { validateRoomName } = require('../../../shared/types/room-validation');

/**
 * Room model class
 */
class Room {
  /**
   * Create a Room model instance
   * @param {Database} db - better-sqlite3 database instance
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new room
   * @param {string} name - Room name (3-50 alphanumeric + hyphen/underscore)
   * @param {number} createdByUserId - ID of user creating the room
   * @returns {{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: null}} Created room
   * @throws {Error} If name is invalid or already exists
   */
  create(name, createdByUserId) {
    const validation = validateRoomName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const stmt = this.db.prepare(`
      INSERT INTO rooms (name, created_at, created_by_user_id, deleted_at)
      VALUES (?, ?, ?, NULL)
    `);

    const now = Date.now();
    const result = stmt.run(name, now, createdByUserId);

    return {
      id: result.lastInsertRowid,
      name,
      created_at: now,
      created_by_user_id: createdByUserId,
      deleted_at: null,
    };
  }

  /**
   * Find room by ID (includes soft-deleted rooms)
   * @param {number} id - Room ID
   * @returns {{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: number|null}|null} Room or null
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE id = ?');
    return stmt.get(id) || null;
  }

  /**
   * Find room by name
   * @param {string} name - Room name
   * @returns {{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: number|null}|null} Room or null
   */
  findByName(name) {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE name = ?');
    return stmt.get(name) || null;
  }

  /**
   * Find all active (non-deleted) rooms
   * @returns {Array<{id: number, name: string, created_at: number, created_by_user_id: number, deleted_at: null}>} Active rooms
   */
  findAllActive() {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE deleted_at IS NULL ORDER BY created_at DESC');
    return stmt.all();
  }

  /**
   * Soft delete a room (set deleted_at timestamp)
   * @param {number} id - Room ID
   * @returns {boolean} True if soft deleted successfully
   */
  softDelete(id) {
    const stmt = this.db.prepare('UPDATE rooms SET deleted_at = ? WHERE id = ?');
    const now = Date.now();
    const result = stmt.run(now, id);
    return result.changes > 0;
  }

  /**
   * Restore a soft-deleted room (set deleted_at to NULL)
   * @param {number} id - Room ID
   * @returns {boolean} True if restored successfully
   */
  restore(id) {
    const stmt = this.db.prepare('UPDATE rooms SET deleted_at = NULL WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Hard delete a room (permanently remove)
   * @param {number} id - Room ID
   * @returns {boolean} True if deleted successfully
   */
  delete(id) {
    const stmt = this.db.prepare('DELETE FROM rooms WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

module.exports = Room;
