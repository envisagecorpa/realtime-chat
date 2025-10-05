'use strict';

/**
 * Authentication handler for Socket.IO
 * Handles authenticate event, creates/gets user, stores username in socket data
 */

const { validateUsername } = require('../../../shared/types/user-validation');
const User = require('../models/User');
const StorageService = require('../services/StorageService');

// Track connected users to enforce single session (FR-017)
const connectedUsers = new Map(); // username (lowercase) → socket.id

/**
 * Register authentication event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {object} deps - Dependencies (userModel)
 */
function authHandler(socket, deps = {}) {
  // Use injected dependencies or create new ones (for backward compatibility with tests)
  let userModel = deps.userModel;

  if (!userModel) {
    const dbPath = process.env.DB_PATH || ':memory:';
    const storageService = new StorageService(dbPath);
    const db = storageService.getDatabase();
    userModel = new User(db);
  }

  /**
   * Handle authenticate event
   */
  socket.on('authenticate', async (data) => {
    try {
      const { username } = data || {};

      // Validate username
      const validation = validateUsername(username);
      if (!validation.valid) {
        socket.emit('auth_error', { error: validation.error });
        return;
      }

      const normalizedUsername = username.toLowerCase();

      // Check if username already connected (case-insensitive)
      if (connectedUsers.has(normalizedUsername)) {
        socket.emit('auth_error', {
          error: 'Username already connected',
        });
        return;
      }

      // Create or get user
      let user = userModel.findByUsername(username);
      if (!user) {
        user = userModel.create(username);
      }

      // Store authentication data in socket
      socket.data.authenticated = true;
      socket.data.username = username;
      socket.data.userId = user.id;

      // Track connected user
      connectedUsers.set(normalizedUsername, socket.id);

      // Update last seen
      userModel.updateLastSeen(user.id);

      // Emit success
      socket.emit('authenticated', {
        username: user.username,
        userId: user.id,
      });
    } catch (error) {
      socket.emit('auth_error', {
        error: error.message || 'Authentication failed',
      });
    }
  });

  /**
   * Clean up on disconnect
   */
  socket.on('disconnect', () => {
    if (socket.data.username) {
      const normalizedUsername = socket.data.username.toLowerCase();
      connectedUsers.delete(normalizedUsername);
    }
  });
}

module.exports = authHandler;
