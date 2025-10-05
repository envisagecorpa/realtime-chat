'use strict';

/**
 * Real-time Chat Server
 * Express + Socket.IO server with SQLite persistence
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

// Handlers
const authHandler = require('./handlers/authHandler');
const roomHandler = require('./handlers/roomHandler');
const messageHandler = require('./handlers/messageHandler');

// Database initialization
const { initDatabase } = require('./db/init');

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/chat.db');

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Real-time Chat API',
    version: '1.0.0',
    environment: NODE_ENV,
    socketIO: {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    },
  });
});

// Serve static files in production
if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Initialize database ONCE
console.log('[Server] Initializing database...');
initDatabase(DB_PATH, true); // true = seed default rooms
console.log('[Server] Database initialized');

// Create shared database connection for all handlers (fixes multiple migration issue)
const StorageService = require('./services/StorageService');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const MessageService = require('./services/MessageService');
const RoomService = require('./services/RoomService');
const PresenceService = require('./services/PresenceService');

const storageService = new StorageService(DB_PATH);
const db = storageService.getDatabase();

// Initialize models
const userModel = new User(db);
const roomModel = new Room(db);
const messageModel = new Message(db);

// Initialize services
const messageService = new MessageService(messageModel);
const roomService = new RoomService(roomModel);
const presenceService = new PresenceService();

console.log('[Server] Shared database instances created');

// Socket.IO connection handling
io.on('connection', (socket) => {
  const clientId = socket.id.substring(0, 8);
  console.log(`[Socket] Client connected: ${clientId}`);

  // Register all event handlers with shared dependencies (dependency injection)
  authHandler(socket, { userModel });
  roomHandler(socket, { roomModel, roomService, presenceService, messageService });
  messageHandler(socket, { messageModel, messageService, userModel });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Client disconnected: ${clientId} (${reason})`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`[Socket] Error from ${clientId}:`, error);
  });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Real-time Chat Server');
  console.log('='.repeat(60));
  console.log(`  Environment:     ${NODE_ENV}`);
  console.log(`  HTTP Server:     http://localhost:${PORT}`);
  console.log(`  Socket.IO:       ws://localhost:${PORT}`);
  console.log(`  Database:        ${DB_PATH}`);
  console.log(`  CORS Origin:     ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('[Server] Ready to accept connections');
  console.log('[Server] Press Ctrl+C to stop');
  console.log('');
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Server] Shutting down gracefully...');

  // Close Socket.IO connections
  io.close(() => {
    console.log('[Server] Socket.IO connections closed');
  });

  // Close HTTP server
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors (OR-001, OR-002)
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  if (NODE_ENV === 'production') {
    // Log to monitoring service in production
    // TODO: Integrate with error tracking service (e.g., Sentry)
  }
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  if (NODE_ENV === 'production') {
    // Log to monitoring service in production
    // TODO: Integrate with error tracking service (e.g., Sentry)
  }
});

module.exports = { app, httpServer, io };
