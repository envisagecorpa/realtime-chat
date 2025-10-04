'use strict';

/**
 * MessageService - Business logic for message operations
 * Handles validation, sanitization, retry logic
 */

const { validateMessage, sanitizeContent } = require('../../../shared/types/message-validation');

/**
 * MessageService class
 */
class MessageService {
  /**
   * Create MessageService instance
   * @param {Message} messageModel - Message model instance
   */
  constructor(messageModel) {
    this.messageModel = messageModel;
  }

  /**
   * Send a new message
   * @param {{userId: number, roomId: number, content: string, timestamp: number}} data - Message data
   * @returns {{id: number, user_id: number, room_id: number, content: string, timestamp: number, delivery_status: string, retry_count: number, created_at: number}} Created message
   * @throws {Error} If validation fails
   */
  sendMessage(data) {
    const { userId, roomId, content, timestamp } = data;

    // Validate and sanitize content (SR-002)
    const validation = validateMessage(content);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Create message with sanitized content
    const message = this.messageModel.create({
      userId,
      roomId,
      content: validation.sanitized,
      timestamp,
    });

    // Mark as sent immediately (FR-012)
    this.messageModel.updateDeliveryStatus(message.id, 'sent');

    // Return updated message
    return {
      ...message,
      delivery_status: 'sent',
    };
  }

  /**
   * Get message history for a room with pagination
   * @param {number} roomId - Room ID
   * @param {{limit: number, offset: number}} options - Pagination options (default: limit=50, offset=0)
   * @returns {{messages: Array, total: number, hasMore: boolean}} Paginated messages
   */
  getMessageHistory(roomId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    return this.messageModel.findByRoomPaginated(roomId, { limit, offset });
  }

  /**
   * Mark message as sent
   * @param {number} messageId - Message ID
   * @returns {boolean} True if updated successfully
   */
  markAsSent(messageId) {
    return this.messageModel.updateDeliveryStatus(messageId, 'sent');
  }

  /**
   * Mark message as failed
   * @param {number} messageId - Message ID
   * @returns {boolean} True if updated successfully
   */
  markAsFailed(messageId) {
    return this.messageModel.updateDeliveryStatus(messageId, 'failed');
  }

  /**
   * Increment retry count for a message
   * @param {number} messageId - Message ID
   * @returns {boolean} True if updated successfully
   * @throws {Error} If retry count exceeds maximum (3)
   */
  incrementRetryCount(messageId) {
    return this.messageModel.incrementRetryCount(messageId);
  }

  /**
   * Check if message can be retried (retry_count < 3)
   * @param {number} messageId - Message ID
   * @returns {boolean} True if message can be retried
   */
  canRetry(messageId) {
    const message = this.messageModel.findById(messageId);
    if (!message) {
      return false;
    }
    return message.retry_count < 3;
  }
}

module.exports = MessageService;
