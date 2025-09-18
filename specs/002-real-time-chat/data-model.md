# Data Model: Real-time Chat System

**Generated**: 2025-09-18
**Based on**: Feature specification and technical research findings

## Entity Definitions

### User
Represents a chat participant with authentication and profile information.

**Attributes**:
- `id`: UUID, primary key
- `username`: string, unique identifier for login (max 50 chars)
- `displayName`: string, optional friendly name (max 100 chars)
- `email`: string, optional for notifications
- `role`: enum ('member', 'moderator'), default 'member'
- `isOnline`: boolean, computed from presence data
- `lastSeen`: timestamp, last activity time
- `createdAt`: timestamp, account creation
- `updatedAt`: timestamp, last profile update

**Business Rules**:
- Username must be unique and contain only alphanumeric characters and underscores
- Moderators can block users and receive reported issues
- User presence determined by active WebSocket connections

**Relationships**:
- One-to-many with Messages (as sender)
- Many-to-many with ChatRooms (via ChatRoomParticipants)
- One-to-many with UserSessions
- One-to-many with FileAttachments (as uploader)

### Message
Contains message content with delivery tracking and metadata.

**Attributes**:
- `id`: UUID, primary key
- `content`: text, message body (max 2000 chars, required for text messages)
- `messageType`: enum ('text', 'system', 'file_attachment'), default 'text'
- `senderId`: UUID, foreign key to User
- `chatRoomId`: UUID, foreign key to ChatRoom
- `parentMessageId`: UUID, optional for threading/replies
- `deliveryStatus`: enum ('sent', 'delivered', 'failed'), default 'sent'
- `deliveredAt`: timestamp, when message reached recipients
- `editedAt`: timestamp, last edit time
- `deletedAt`: timestamp, soft deletion for retention
- `createdAt`: timestamp, message sent time
- `hasAttachments`: boolean, indicates file attachments

**Business Rules**:
- Text messages require content; system messages auto-generate content
- Messages cannot be edited after 5 minutes (configurable)
- Soft deletion maintains message history for 30 days
- System messages generated for user join/leave events

**Relationships**:
- Many-to-one with User (sender)
- Many-to-one with ChatRoom
- One-to-many with MessageReadStatus
- One-to-many with FileAttachments
- One-to-many with Messages (parent-child for threading)

### ChatRoom
Represents conversation spaces for direct or group communication.

**Attributes**:
- `id`: UUID, primary key
- `name`: string, room display name (max 100 chars)
- `type`: enum ('direct', 'group', 'public'), determines functionality
- `description`: text, optional room description (max 500 chars)
- `isActive`: boolean, room availability status
- `maxParticipants`: integer, participant limit (default 100)
- `createdById`: UUID, foreign key to User (room creator)
- `createdAt`: timestamp, room creation
- `updatedAt`: timestamp, last room modification

**Business Rules**:
- Direct rooms automatically named after participants
- Group rooms require explicit names
- Public rooms visible to all users
- Room creators have administrative privileges

**Relationships**:
- Many-to-many with Users (via ChatRoomParticipants)
- One-to-many with Messages
- Many-to-one with User (creator)

### ChatRoomParticipant
Junction entity managing user membership in chat rooms.

**Attributes**:
- `id`: UUID, primary key
- `chatRoomId`: UUID, foreign key to ChatRoom
- `userId`: UUID, foreign key to User
- `role`: enum ('member', 'admin'), default 'member'
- `joinedAt`: timestamp, when user joined room
- `leftAt`: timestamp, when user left (null if active)
- `lastReadMessageId`: UUID, foreign key to Message for unread tracking
- `notificationLevel`: enum ('all', 'mentions', 'none'), default 'all'
- `isMuted`: boolean, mute status for room

**Business Rules**:
- Users can be in maximum 50 rooms simultaneously
- Room admins can add/remove participants and manage settings
- Last read message enables unread count calculation

**Relationships**:
- Many-to-one with ChatRoom
- Many-to-one with User
- Many-to-one with Message (last read)

### MessageReadStatus
Tracks message read receipts for delivery confirmation.

**Attributes**:
- `messageId`: UUID, foreign key to Message (composite primary key)
- `userId`: UUID, foreign key to User (composite primary key)
- `readAt`: timestamp, when message was read
- `deliveredAt`: timestamp, when message was delivered to user

**Business Rules**:
- Only created for users who are room participants when message sent
- Enables "delivered" and "read" status indicators
- Automatically created when message sent (deliveredAt) and updated when read

**Relationships**:
- Many-to-one with Message
- Many-to-one with User

### UserSession
Manages WebSocket connection state and presence information.

**Attributes**:
- `id`: UUID, primary key
- `userId`: UUID, foreign key to User
- `socketId`: string, WebSocket connection identifier
- `deviceInfo`: JSON, client device and browser information
- `ipAddress`: string, connection IP address
- `userAgent`: string, client user agent
- `connectedAt`: timestamp, session start time
- `lastHeartbeat`: timestamp, last activity ping
- `disconnectedAt`: timestamp, session end time (null if active)
- `presenceStatus`: enum ('online', 'away', 'offline'), default 'online'

**Business Rules**:
- Multiple sessions allowed per user (multi-device support)
- Sessions automatically marked offline after 45 seconds without heartbeat
- Presence status aggregated across all user sessions

**Relationships**:
- Many-to-one with User

### FileAttachment
Stores file and media attachments with security metadata.

**Attributes**:
- `id`: UUID, primary key
- `messageId`: UUID, foreign key to Message
- `originalName`: string, user-provided filename (max 255 chars)
- `sanitizedName`: string, safe filename for storage
- `mimeType`: string, file content type (validated)
- `fileSize`: integer, bytes (max 10,485,760 = 10MB)
- `sha256Hash`: string, file integrity hash for deduplication
- `storageProvider`: enum ('local', 's3', 'cloudinary'), storage backend
- `storagePath`: string, file location in storage system
- `publicUrl`: string, optional CDN/public access URL
- `uploadStatus`: enum ('pending', 'processing', 'completed', 'failed')
- `uploadedById`: UUID, foreign key to User
- `accessCount`: integer, download/view counter
- `lastAccessedAt`: timestamp, last file access
- `createdAt`: timestamp, upload time
- `expiresAt`: timestamp, deletion time (30 days from creation)

**Business Rules**:
- File size limited to 10MB per attachment
- Allowed MIME types: images, documents, videos, audio (configurable)
- SHA-256 deduplication prevents storage of identical files
- Files expire after 30 days with message retention policy

**Relationships**:
- Many-to-one with Message
- Many-to-one with User (uploader)

## Entity Relationships Diagram

```
User ||--o{ Message : sends
User ||--o{ ChatRoomParticipant : participates
User ||--o{ UserSession : has
User ||--o{ FileAttachment : uploads
User ||--o{ MessageReadStatus : reads

ChatRoom ||--o{ Message : contains
ChatRoom ||--o{ ChatRoomParticipant : has
ChatRoom }o--|| User : created_by

Message ||--o{ MessageReadStatus : tracked_by
Message ||--o{ FileAttachment : has
Message }o--|| Message : replies_to (parent)

ChatRoomParticipant }o--|| Message : last_read

FileAttachment }o--|| Message : attached_to
```

## Data Validation Rules

### User Validation
- `username`: Required, 3-50 characters, alphanumeric + underscore only, unique
- `displayName`: Optional, max 100 characters
- `email`: Optional, valid email format
- `role`: Must be 'member' or 'moderator'

### Message Validation
- `content`: Required for text messages, max 2000 characters, not empty after trim
- `messageType`: Must be valid enum value
- `senderId` and `chatRoomId`: Must reference existing records
- `parentMessageId`: Must reference existing message in same room (if provided)

### ChatRoom Validation
- `name`: Required for group/public rooms, max 100 characters
- `type`: Must be 'direct', 'group', or 'public'
- `maxParticipants`: Integer between 2 and 500
- `description`: Max 500 characters if provided

### FileAttachment Validation
- `fileSize`: Must be ≤ 10,485,760 bytes (10MB)
- `mimeType`: Must be in allowed MIME types list
- `originalName`: Must have valid file extension matching MIME type
- `sha256Hash`: Must be 64-character hexadecimal string

## Indexing Strategy

### Primary Indexes
```sql
-- Message retrieval by room (most frequent query)
CREATE INDEX idx_messages_room_created ON messages (chat_room_id, created_at DESC)
WHERE deleted_at IS NULL;

-- User message history
CREATE INDEX idx_messages_sender_created ON messages (sender_id, created_at DESC);

-- Unread message counting
CREATE INDEX idx_participants_unread ON chat_room_participants (user_id, last_read_message_id);

-- File deduplication
CREATE UNIQUE INDEX idx_file_attachments_hash ON file_attachments (sha256_hash);

-- Session cleanup
CREATE INDEX idx_user_sessions_heartbeat ON user_sessions (last_heartbeat)
WHERE disconnected_at IS NULL;
```

### Full-Text Search
```sql
-- Message content search
CREATE INDEX idx_messages_content_fts ON messages
USING GIN (to_tsvector('english', content))
WHERE message_type = 'text' AND deleted_at IS NULL;
```

## Data Retention and Archiving

### Retention Policies
- **Messages**: 30 days active retention, then archived to compressed storage
- **File Attachments**: 30 days, then moved to cold storage or deleted
- **User Sessions**: 7 days inactive session cleanup
- **Message Read Status**: Archived with messages

### Archive Strategy
- Daily batch jobs at 2:00 AM process messages older than 30 days
- Parquet format with Snappy compression for archived messages
- Hierarchical storage: `/archives/year=YYYY/month=MM/day=DD/`
- Soft deletion with 7-day grace period before permanent removal

## Scalability Considerations

### Partitioning
- Messages table partitioned by `created_at` (monthly partitions)
- MessageReadStatus table partitioned by `read_at` (monthly partitions)
- Automatic partition management with pg_partman

### Performance Targets
- Support 10,000 concurrent users
- <100ms query response for message history
- <50ms message delivery latency
- 1,000+ messages per second throughput

This data model provides a comprehensive foundation for the real-time chat system while supporting all functional requirements including message delivery tracking, file attachments, user presence, and automated archiving.