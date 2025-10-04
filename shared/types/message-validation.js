'use strict';

/**
 * Message validation and sanitization utilities
 * Validates message content and sanitizes HTML to prevent XSS (SR-002)
 */

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Sanitize HTML entities to prevent XSS attacks
 * @param {string} content - Raw message content
 * @returns {string} Sanitized content
 */
function sanitizeContent(content) {
  if (typeof content !== 'string') {
    return '';
  }

  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate message content
 * @param {string} content - Message content to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}} Validation result with sanitized content
 */
function validateMessage(content) {
  if (typeof content !== 'string') {
    return { valid: false, error: 'Message content is required' };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  return {
    valid: true,
    sanitized: sanitizeContent(trimmed),
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  validateMessage,
  sanitizeContent,
};
