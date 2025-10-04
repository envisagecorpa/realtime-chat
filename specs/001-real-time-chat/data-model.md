# Data Model: Real-Time Chat System

**Date**: 2025-10-04
**Storage**: SQLite (file-based), Redis (in-memory sessions)

## Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐       ┌────────────────────┐
│     User        │       │     Message      │       │       Room         │
├─────────────────┤       ├──────────────────┤       ├────────────────────┤
│ id (PK)         │───┐   │ id (PK)          │   ┌───│ id (PK)            │
│ username (UNQ)  │   └──<│ user_id (FK)     │   │   │ name (UNQ)         │
│ created_at      │       │ room_id (FK)     │>──┘   │ created_at         │
│ last_seen_at    │       │ content          │       │ created_by_user_id │
└─────────────────┘       │ timestamp        │       │ deleted_at         │
                          │ delivery_status  │       └────────────────────┘
                          │ retry_count      │
                          │ created_at       │
                          └──────────────────┘

┌─────────────────────────┐
│   Session (Redis)       │
├─────────────────────────┤
│ session_id (PK)         │
│ username                │
│ socket_id               │
│ current_room_id         │
│ expires_at              │
└─────────────────────────┘
```

## Entities

### 1. User
Represents a chat participant with unique username (no password).

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `username`: TEXT NOT NULL UNIQUE (indexed for fast lookup)
- `created_at`: INTEGER NOT NULL (Unix timestamp in milliseconds)
- `last_seen_at`: INTEGER NULL (last activity timestamp; updated on disconnect for "last seen" feature)

**Constraints**:
- Username must be 3-20 characters, alphanumeric + underscores only
- Username uniqueness enforced at database level

**Relationships**:
- One user can send many messages (1:N with Message)
- One user can create many rooms (1:N with Room)

**SQLite Schema**:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NULL,
  CHECK(length(username) >= 3 AND length(username) <= 20)
);

CREATE INDEX idx_users_username ON users(username);
```

---

### 2. Message
A text communication sent by a user to a room.

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id`: INTEGER NOT NULL (foreign key to User)
- `room_id`: INTEGER NOT NULL (foreign key to Room)
- `content`: TEXT NOT NULL (max 2000 characters)
- `timestamp`: INTEGER NOT NULL (client-provided Unix timestamp in milliseconds; used for ordering per FR-008)
- `delivery_status`: TEXT NOT NULL DEFAULT 'pending' (`pending`, `sent`, `failed`)
- `retry_count`: INTEGER NOT NULL DEFAULT 0 (number of send attempts; max 3 per FR-019)
- `created_at`: INTEGER NOT NULL (server timestamp for audit trail)

**Constraints**:
- Content cannot be empty; max 2000 characters
- Timestamp must be positive integer
- Delivery status must be one of: `pending`, `sent`, `failed`
- Retry count must be between 0 and 3

**Relationships**:
- Many messages belong to one user (N:1 with User)
- Many messages belong to one room (N:1 with Room)

**Indexing**:
- Index on `room_id, timestamp` for efficient message history queries with pagination
- Index on `user_id` for user-specific queries

**SQLite Schema**:
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  content TEXT NOT NULL CHECK(length(content) > 0 AND length(content) <= 2000),
  timestamp INTEGER NOT NULL CHECK(timestamp > 0),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0 AND retry_count <= 3),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_room_timestamp ON messages(room_id, timestamp);
CREATE INDEX idx_messages_user ON messages(user_id);
```

---

### 3. Room
A communication space where users exchange messages.

**Attributes**:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT NOT NULL UNIQUE (room name, e.g., "general", "random")
- `created_at`: INTEGER NOT NULL (Unix timestamp in milliseconds)
- `created_by_user_id`: INTEGER NOT NULL (foreign key to User; user who created room)
- `deleted_at`: INTEGER NULL (soft delete timestamp; NULL if room active, timestamp if deleted per FR-015)

**Constraints**:
- Room name must be 3-50 characters, alphanumeric + hyphens/underscores
- Room name uniqueness enforced at database level
- Soft delete: rooms with deleted_at != NULL are hidden from room lists but messages preserved

**Relationships**:
- One room contains many messages (1:N with Message)
- One user can create many rooms (N:1 with User)

**SQLite Schema**:
```sql
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  deleted_at INTEGER NULL,
  CHECK(length(name) >= 3 AND length(name) <= 50),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_rooms_name ON rooms(name);
CREATE INDEX idx_rooms_active ON rooms(deleted_at) WHERE deleted_at IS NULL;
```

---

### 4. Session (Redis)
Represents an active user session with Socket.IO connection state (ephemeral, not persisted to SQLite).

**Attributes**:
- `session_id`: STRING (Express session ID, e.g., `sess:abc123`)
- `username`: STRING (authenticated username)
- `socket_id`: STRING (Socket.IO socket ID for disconnect enforcement)
- `current_room_id`: INTEGER (room user is currently in; null if not in any room)
- `expires_at`: INTEGER (Unix timestamp for session expiration)

**Redis Storage**:
```javascript
// Stored as JSON in Redis
redis.setex(`session:${sessionId}`, 86400, JSON.stringify({
  username: 'alice',
  socketId: 'abc123',
  currentRoomId: 42,
  expiresAt: Date.now() + 86400000
}));

// Additional mapping for single-session enforcement
redis.setex(`user:${username}:socket`, 86400, socketId);
```

**Ephemeral Nature**:
- Sessions expire after 24 hours (TTL enforced by Redis)
- Not persisted to SQLite; regenerated on login

---

## Presence Status (In-Memory)
User presence is tracked in-memory on the server (not persisted).

**Structure**:
```javascript
// Map: roomId → Set<username>
const roomPresence = new Map();

// Example:
roomPresence.set('1', new Set(['alice', 'bob', 'charlie']));
roomPresence.set('2', new Set(['dave', 'eve']));
```

**Lifecycle**:
- **join_room event**: Add username to room's Set; broadcast `user_joined`
- **leave_room event**: Remove username from room's Set; broadcast `user_left`
- **disconnect event**: Remove username from all rooms; broadcast `user_left`

---

## Validation Rules

### User
- Username: `/^[a-zA-Z0-9_]{3,20}$/` (alphanumeric + underscore, 3-20 chars)
- Username uniqueness: Enforced by database UNIQUE constraint

### Message
- Content: Non-empty, max 2000 characters
- Content sanitization: Escape HTML entities to prevent XSS (SR-002)
- Timestamp: Positive integer (Unix ms); validated to be within ±5 minutes of server time to prevent clock skew

### Room
- Name: `/^[a-zA-Z0-9_-]{3,50}$/` (alphanumeric + hyphen/underscore, 3-50 chars)
- Name uniqueness: Enforced by database UNIQUE constraint

---

## State Transitions

### Message Delivery Status
```
pending → sent (when Socket.IO confirms delivery to all room participants)
pending → failed (after 3 retry attempts; FR-019)
```

**Triggers**:
- `pending`: Message created but not yet delivered via Socket.IO
- `sent`: Server received acknowledgment from all active room participants
- `failed`: Retry count exceeded; client displays error message

---

## Pagination Strategy

### Message History (FR-020)
Retrieve messages from SQLite in descending order by `timestamp`, then reverse for display.

**Query**:
```sql
SELECT m.id, m.content, m.timestamp, m.delivery_status, u.username
FROM messages m
JOIN users u ON m.user_id = u.id
WHERE m.room_id = ?
ORDER BY m.timestamp DESC
LIMIT ? OFFSET ?;
```

**Parameters**:
- `LIMIT`: Page size (50, 100, 200, or 500; default 50)
- `OFFSET`: `(page - 1) * pageSize`

**Example**:
- Page 1 (most recent 50): `LIMIT 50 OFFSET 0`
- Page 2 (next 50): `LIMIT 50 OFFSET 50`

**Performance**:
- Index on `(room_id, timestamp)` ensures fast query (<2s for thousands of messages; PR-002)

---

## Concurrent Write Handling (DP-004)

### SQLite WAL Mode
Enable Write-Ahead Logging to allow concurrent reads during writes:
```sql
PRAGMA journal_mode = WAL;
```

### Transaction Batching
Use transactions for bulk inserts (<100ms write target; PR-005):
```javascript
const insertMessage = db.prepare('INSERT INTO messages (...) VALUES (...)');
const insertMany = db.transaction((messages) => {
  for (const msg of messages) insertMessage.run(...msg);
});

insertMany([msg1, msg2, msg3]); // Single transaction
```

---

## Data Retention (FR-014)

**Messages**: Retained permanently (no automatic deletion)
**Rooms**: Soft delete (mark `deleted_at` timestamp; messages preserved but room hidden from lists)
**Users**: Retained permanently (no automatic deletion)
**Sessions**: Expire after 24 hours (Redis TTL)

**Room Deletion Queries**:
```sql
-- Soft delete a room (FR-015)
UPDATE rooms SET deleted_at = ? WHERE id = ?;

-- Query active rooms only (exclude deleted)
SELECT * FROM rooms WHERE deleted_at IS NULL;

-- Restore a soft-deleted room
UPDATE rooms SET deleted_at = NULL WHERE id = ?;

-- Hard delete (permanent; removes all messages via CASCADE)
DELETE FROM rooms WHERE id = ?;
```

**Future Consideration**:
- Implement room archival (move old messages to separate table/file after N days)
- Add admin API for manual message deletion (GDPR compliance)

---

## Migration Schema

Initial database creation script:

```sql
-- Enable WAL mode for concurrent access
PRAGMA journal_mode = WAL;

-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NULL,
  CHECK(length(username) >= 3 AND length(username) <= 20)
);
CREATE INDEX idx_users_username ON users(username);

-- Rooms table
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  deleted_at INTEGER NULL,
  CHECK(length(name) >= 3 AND length(name) <= 50),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_rooms_name ON rooms(name);
CREATE INDEX idx_rooms_active ON rooms(deleted_at) WHERE deleted_at IS NULL;

-- Messages table
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  content TEXT NOT NULL CHECK(length(content) > 0 AND length(content) <= 2000),
  timestamp INTEGER NOT NULL CHECK(timestamp > 0),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0 AND retry_count <= 3),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_room_timestamp ON messages(room_id, timestamp);
CREATE INDEX idx_messages_user ON messages(user_id);
```

---

## Summary

| Entity | Storage | Persistence | Relationships |
|--------|---------|-------------|---------------|
| **User** | SQLite | Permanent | 1:N Messages, 1:N Rooms |
| **Message** | SQLite | Permanent | N:1 User, N:1 Room |
| **Room** | SQLite | Permanent | 1:N Messages, N:1 User (creator) |
| **Session** | Redis | 24-hour TTL | Ephemeral (not persisted) |
| **Presence** | In-Memory | Ephemeral | Recalculated on join/leave |
