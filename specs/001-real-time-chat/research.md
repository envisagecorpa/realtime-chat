# Research: Real-Time Chat System

**Date**: 2025-10-04
**Status**: Complete

## Overview
Research findings for implementing real-time chat with Socket.IO, SQLite, Redis, Vue.js, and TailwindCSS.

## 1. Socket.IO Room Management and Presence Tracking

### Decision
Use Socket.IO's built-in room management with Redis adapter for multi-instance support (future scalability).

### Rationale
- **Native Rooms**: `socket.join(roomId)` and `socket.leave(roomId)` provide automatic broadcast scoping
- **Presence Tracking**: Maintain in-memory Map of `roomId → Set<username>` on server; broadcast presence updates on join/leave
- **Single Room Constraint**: Before joining new room, call `socket.leave(currentRoomId)` to enforce one-room-at-a-time per user (FR-017)
- **Redis Adapter**: `socket.io-redis` enables sticky sessions across multiple Node.js instances (deferred for initial release; single instance sufficient for 10 concurrent users)

### Alternatives Considered
- **Manual Tracking**: Store room memberships in SQLite → Rejected (adds database overhead for ephemeral presence data)
- **Pub/Sub Pattern**: Use Redis pub/sub for presence → Rejected (Socket.IO rooms already provide efficient broadcast mechanism)

### Implementation Notes
```javascript
// Server-side presence tracking
const roomPresence = new Map(); // roomId → Set([username1, username2])

socket.on('join_room', (roomId, username) => {
  // Leave current room
  const currentRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
  currentRooms.forEach(room => socket.leave(room));

  // Join new room
  socket.join(roomId);

  // Update presence
  if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Set());
  roomPresence.get(roomId).add(username);

  // Broadcast presence to room
  io.to(roomId).emit('user_joined', { roomId, username, users: Array.from(roomPresence.get(roomId)) });
});
```

---

## 2. SQLite Connection Pooling and Concurrent Write Handling

### Decision
Use `better-sqlite3` (synchronous) instead of `sqlite3` (asynchronous) with Write-Ahead Logging (WAL) mode.

### Rationale
- **Synchronous API**: Simpler error handling; no callback hell or async/await complexity
- **Performance**: `better-sqlite3` is 2-3x faster than `sqlite3` for typical workloads
- **WAL Mode**: Allows concurrent reads during writes; prevents `SQLITE_BUSY` errors (DP-004 requirement)
- **Connection Pooling**: Not needed for SQLite (single-file database); one connection per process sufficient
- **Write Performance**: Batch inserts with transactions (`BEGIN...COMMIT`) to meet <100ms write target (PR-005)

### Alternatives Considered
- **sqlite3 (async)**: Standard library → Rejected (slower, complex async handling for synchronous database)
- **PostgreSQL**: Full RDBMS → Rejected (overkill for file-based storage requirement; SQLite meets FR-003, DP-001)

### Implementation Notes
```javascript
const Database = require('better-sqlite3');
const db = new Database('./data/chat.db');
db.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging

// Batch insert with transaction
const insertMessage = db.prepare('INSERT INTO messages (room_id, username, content, timestamp) VALUES (?, ?, ?, ?)');
const insertMany = db.transaction((messages) => {
  for (const msg of messages) insertMessage.run(msg.roomId, msg.username, msg.content, msg.timestamp);
});
```

---

## 3. Redis Session Management for WebSocket Authentication

### Decision
Use Redis to store session data (username → sessionId) with Express session middleware (`express-session` + `connect-redis`).

### Rationale
- **Session Persistence**: Redis provides fast in-memory storage for session data; survives Node.js restarts
- **WebSocket Auth**: Socket.IO shares Express session via `socket.handshake.session.username`
- **Single Session Enforcement**: Store `username → socketId` mapping in Redis; disconnect previous socket on new login (FR-017)
- **TTL Management**: Set session expiration (e.g., 24 hours) to auto-cleanup inactive users

### Alternatives Considered
- **JWT Tokens**: Stateless authentication → Rejected (requires token refresh logic; session invalidation harder for single-session enforcement)
- **In-Memory Sessions**: Store sessions in Node.js process → Rejected (lost on restart; doesn't scale to multiple instances)

### Implementation Notes
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient();
redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 } // 24 hours
}));

// Share session with Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

socket.on('connect', () => {
  const username = socket.request.session.username;
  if (!username) return socket.disconnect(); // Not authenticated

  // Enforce single session per user
  const existingSocketId = await redisClient.get(`user:${username}:socket`);
  if (existingSocketId) io.sockets.sockets.get(existingSocketId)?.disconnect();
  await redisClient.set(`user:${username}:socket`, socket.id);
});
```

---

## 4. Vue 3 Composition API for Real-Time Data Binding

### Decision
Use Vue 3 Composition API with `ref` and `reactive` for managing real-time message and presence state.

### Rationale
- **Reactivity**: Vue's reactive system automatically updates UI when Socket.IO events modify state
- **Composables**: Extract Socket.IO logic into reusable composables (`useMessages`, `usePresence`, `useSocket`)
- **TypeScript Support**: Composition API provides better TypeScript inference (even with JSDoc in plain JS)
- **Performance**: `ref` optimized for primitive values (message count, active room); `reactive` for objects (message list, user list)

### Alternatives Considered
- **Options API**: Classic Vue 2 style → Rejected (less composable; harder to extract shared logic)
- **Pinia (Vuex)**: Global state management → Rejected (overkill for single-view chat app; Composition API sufficient)

### Implementation Notes
```javascript
// composables/useMessages.js
import { ref, onMounted, onUnmounted } from 'vue';
import { socket } from '@/services/socket-service.js';

export function useMessages(roomId) {
  const messages = ref([]);
  const isLoading = ref(false);

  const handleNewMessage = (msg) => {
    messages.value.push(msg);
    // Sort by timestamp (client-side ordering per FR-008)
    messages.value.sort((a, b) => a.timestamp - b.timestamp);
  };

  onMounted(() => {
    socket.on('new_message', handleNewMessage);
    socket.emit('join_room', roomId);
  });

  onUnmounted(() => {
    socket.off('new_message', handleNewMessage);
    socket.emit('leave_room', roomId);
  });

  return { messages, isLoading };
}
```

---

## 5. TailwindCSS Component Architecture for Chat Interfaces

### Decision
Use Tailwind utility classes directly in Vue components with extracted reusable classes in `tailwind.config.js` for design tokens.

### Rationale
- **Utility-First**: Rapid prototyping with inline classes; no separate CSS files to maintain
- **Design System**: Define color palette, spacing, typography in Tailwind config for consistency (Constitution III)
- **Component Reuse**: Extract common patterns (buttons, input fields) into Vue components with Tailwind classes
- **Responsive Design**: Tailwind's responsive modifiers (`md:`, `lg:`) handle tablet/desktop layouts (UI-011)

### Alternatives Considered
- **CSS Modules**: Scoped CSS per component → Rejected (adds build complexity; Tailwind utilities faster)
- **Styled Components**: CSS-in-JS → Rejected (runtime overhead; Tailwind's JIT compiler faster)

### Implementation Notes
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',    // Blue for active elements
        secondary: '#10B981',  // Green for success/checkmarks
        danger: '#EF4444',     // Red for errors
        muted: '#6B7280',      // Gray for timestamps
      },
      spacing: {
        'chat-input': '4rem',  // Fixed height for input area
        'sidebar': '16rem',    // Fixed width for room list
      }
    }
  }
};

// MessageList.vue component
<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <!-- Messages area with scroll -->
    <div class="flex-1 overflow-y-auto p-4 space-y-2">
      <div v-for="msg in messages" :key="msg.id"
           class="flex items-start space-x-2 p-2 hover:bg-gray-100 rounded">
        <span class="font-semibold text-primary">{{ msg.username }}</span>
        <span class="text-gray-700">{{ msg.content }}</span>
        <span class="text-xs text-muted ml-auto">{{ formatTime(msg.timestamp) }}</span>
        <span v-if="msg.delivered" class="text-secondary">✓</span>
      </div>
    </div>
  </div>
</template>
```

---

## 6. Jest/Vitest Testing Strategies for Socket.IO Applications

### Decision
Use Jest for backend Socket.IO tests with `socket.io-client` for simulating client connections; Vitest for frontend Vue component tests.

### Rationale
- **Backend Contract Tests**: `socket.io-client` in tests connects to Socket.IO server, emits events, asserts responses (TDD workflow)
- **Test Isolation**: Each test spawns isolated Socket.IO server instance on random port; teardown after test
- **Mock Databases**: Use in-memory SQLite (`:memory:`) and Redis mock (`redis-mock`) for fast, isolated tests
- **Vitest for Vue**: Drop-in Vite replacement for Jest; faster HMR, native ES modules support, better Vue integration

### Alternatives Considered
- **Supertest Only**: HTTP-level testing → Rejected (doesn't test WebSocket connections; Socket.IO needs socket.io-client)
- **Playwright/Cypress**: E2E testing → Deferred (contract/integration tests sufficient for TDD; E2E slower and flakier)

### Implementation Notes
```javascript
// backend/tests/contract/socket-events.test.js
const io = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');

describe('Socket.IO Event Contracts', () => {
  let ioServer, serverSocket, clientSocket, httpServer;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`);
      ioServer.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    ioServer.close();
    clientSocket.close();
  });

  test('join_room event should broadcast user_joined', (done) => {
    clientSocket.on('user_joined', (data) => {
      expect(data).toMatchObject({
        roomId: 'room1',
        username: 'alice',
        users: expect.arrayContaining(['alice'])
      });
      done();
    });

    clientSocket.emit('join_room', { roomId: 'room1', username: 'alice' });
  });
});
```

---

## Summary Table

| Technology | Decision | Rationale |
|------------|----------|-----------|
| **Room Management** | Socket.IO native rooms | Built-in broadcast scoping; enforces single-room constraint with `socket.leave()` |
| **Database** | better-sqlite3 + WAL mode | Faster than sqlite3; WAL enables concurrent reads; synchronous API simpler |
| **Session Storage** | Redis + express-session | Persistent sessions; single-session enforcement; survives restarts |
| **Frontend State** | Vue 3 Composition API | Reactive data binding; composables for Socket.IO logic reuse |
| **Styling** | TailwindCSS utility classes | Rapid development; design token consistency; responsive utilities |
| **Testing** | Jest (backend) + Vitest (frontend) | socket.io-client for WebSocket contract tests; Vitest faster for Vue |

---

## Next Steps (Phase 1)
1. Generate `data-model.md` with SQLite schema for User, Message, Room tables
2. Define Socket.IO event contracts in `contracts/socket-events.yaml`
3. Write contract tests validating event payloads
4. Create `quickstart.md` manual testing guide
5. Update `CLAUDE.md` agent context file
