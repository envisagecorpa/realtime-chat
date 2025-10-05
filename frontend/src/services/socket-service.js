/**
 * Socket.IO Client Service
 * Manages WebSocket connection to backend
 * Handles reconnection with max 5 retries (FR-016)
 */

import { io } from 'socket.io-client';

/**
 * Create Socket.IO service instance
 * @param {string} url - Backend URL (default: http://localhost:3000)
 * @param {object} options - Socket.IO options
 * @returns {object} Socket service API
 */
export function createSocketService(url = 'http://localhost:3000', options = {}) {
  // Default options
  const defaultOptions = {
    reconnectionAttempts: 5, // FR-016
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
    autoConnect: false, // Manual connection control
  };

  // Merge options
  const socketOptions = { ...defaultOptions, ...options };

  // Create socket instance
  const socket = io(url, socketOptions);

  // Track registered listeners for cleanup
  const registeredListeners = new Map();

  /**
   * Connect to server
   */
  function connect() {
    if (!socket.connected) {
      socket.connect();
    }
  }

  /**
   * Disconnect from server
   */
  function disconnect() {
    // Clean up all registered listeners
    registeredListeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        socket.off(event, handler);
      });
    });
    registeredListeners.clear();

    // Disconnect socket
    if (socket.connected) {
      socket.disconnect();
    }
  }

  /**
   * Check connection status
   * @returns {boolean}
   */
  function isConnected() {
    return socket.connected;
  }

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   */
  function on(event, handler) {
    socket.on(event, handler);

    // Track listener for cleanup
    if (!registeredListeners.has(event)) {
      registeredListeners.set(event, []);
    }
    registeredListeners.get(event).push(handler);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   */
  function off(event, handler) {
    socket.off(event, handler);

    // Remove from tracking
    if (registeredListeners.has(event)) {
      const handlers = registeredListeners.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        registeredListeners.delete(event);
      }
    }
  }

  /**
   * Emit event to server
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  function emit(event, data) {
    socket.emit(event, data);
  }

  /**
   * Get underlying socket instance (for advanced use)
   * @returns {Socket}
   */
  function getSocket() {
    return socket;
  }

  // Helper methods for common operations

  /**
   * Authenticate user
   * @param {object} credentials - { username }
   */
  function authenticate(credentials) {
    emit('authenticate', credentials);
  }

  /**
   * Join a room
   * @param {string} roomName - Room name
   */
  function joinRoom(roomName) {
    emit('join_room', { roomName });
  }

  /**
   * Leave current room
   */
  function leaveRoom() {
    emit('leave_room');
  }

  /**
   * Send message to current room
   * @param {string} content - Message content
   */
  function sendMessage(content) {
    emit('send_message', { content });
  }

  /**
   * Create a new room
   * @param {string} roomName - Room name
   */
  function createRoom(roomName) {
    emit('create_room', { roomName });
  }

  /**
   * Delete a room
   * @param {number} roomId - Room ID
   */
  function deleteRoom(roomId) {
    emit('delete_room', { roomId });
  }

  /**
   * Load message history
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Messages per page (50/100/200/500)
   */
  function loadMessages(page = 1, pageSize = 50) {
    emit('load_messages', { page, pageSize });
  }

  // Return public API
  return {
    connect,
    disconnect,
    isConnected,
    on,
    off,
    emit,
    getSocket,
    // Helper methods
    authenticate,
    joinRoom,
    leaveRoom,
    sendMessage,
    createRoom,
    deleteRoom,
    loadMessages,
  };
}

// Export singleton instance for app-wide use
let defaultInstance = null;

/**
 * Get default socket service instance
 * @param {string} url - Backend URL
 * @returns {object} Socket service
 */
export function getSocketService(url) {
  if (!defaultInstance) {
    defaultInstance = createSocketService(url);
  }
  return defaultInstance;
}

/**
 * Reset default instance (useful for testing)
 */
export function resetSocketService() {
  if (defaultInstance) {
    defaultInstance.disconnect();
    defaultInstance = null;
  }
}
