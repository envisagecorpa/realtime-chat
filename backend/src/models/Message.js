'use strict';

/**
 * Message model for managing chat messages
 * Provides message creation, pagination, status updates, and retry tracking
 */

/**
 * Message model class
 */
class Message {
  /**
   * Create a Message model instance
   * @param {Database} db - better-sqlite3 database instance
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new message
   * @param {{userId: number, roomId: number, content: string, timestamp: number}} data - Message data
   * @returns {{id: number, user_id: number, room_id: number, content: string, timestamp: number, delivery_status: string, retry_count: number, created_at: number}} Created message
   * @throws {Error} If constraints are violated
   */
  create(data) {
    const { userId, roomId, content, timestamp } = data;

    const stmt = this.db.prepare(`
      INSERT INTO messages (user_id, room_id, content, timestamp, delivery_status, retry_count, created_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `);

    const now = Date.now();
    const result = stmt.run(userId, roomId, content, timestamp, now);

    return {
      id: result.lastInsertRowid,
      user_id: userId,
      room_id: roomId,
      content,
      timestamp,
      delivery_status: 'pending',
      retry_count: 0,
      created_at: now,
    };
  }

  /**
   * Find messages by room with pagination
   * @param {number} roomId - Room ID
   * @param {{limit: number, offset: number}} options - Pagination options
   * @returns {{messages: Array, total: number, hasMore: boolean}} Paginated messages
   */
  findByRoomPaginated(roomId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    // Get total count
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE room_id = ?');
    const { count: total } = countStmt.get(roomId);

    // Get paginated messages ordered by timestamp DESC (most recent first)
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE room_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const messages = stmt.all(roomId, limit, offset);
    const hasMore = offset + messages.length < total;

    return {
      messages,
      total,
      hasMore,
    };
  }

  /**
   * Update message delivery status
   * @param {number} id - Message ID
   * @param {string} status - New status (pending, sent, failed)
   * @returns {boolean} True if updated successfully
   */
  updateDeliveryStatus(id, status) {
    const stmt = this.db.prepare('UPDATE messages SET delivery_status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  /**
   * Increment message retry count
   * @param {number} id - Message ID
   * @returns {boolean} True if updated successfully
   * @throws {Error} If retry count exceeds 3
   */
  incrementRetryCount(id) {
    const stmt = this.db.prepare('UPDATE messages SET retry_count = retry_count + 1 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Find message by ID
   * @param {number} id - Message ID
   * @returns {{id: number, user_id: number, room_id: number, content: string, timestamp: number, delivery_status: string, retry_count: number, created_at: number}|null} Message or null
   */
  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(id) || null;
  }
}

module.exports = Message;
