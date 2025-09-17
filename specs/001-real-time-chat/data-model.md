# Data Model: Real-time Chat System

## Core Entities

### User
**Purpose**: Represents a person participating in chat conversations
**Fields**:
- `id`: UUID - Primary key
- `username`: String (unique, 3-30 chars) - Display name
- `email`: String (unique) - Authentication identifier
- `passwordHash`: String - Encrypted password
- `createdAt`: DateTime - Account creation timestamp
- `lastActiveAt`: DateTime - Last activity timestamp
- `isOnline`: Boolean - Current online status

**Validation Rules**:
- Username must be alphanumeric with underscores/hyphens
- Email must be valid format
- Password minimum 8 characters
- Username uniqueness enforced

**Relationships**:
- One-to-many with Message (sender)
- Many-to-many with ChatRoom (participants)

### ChatRoom
**Purpose**: Container for messages between participants
**Fields**:
- `id`: UUID - Primary key
- `name`: String (optional, 1-100 chars) - Room display name
- `type`: Enum('direct', 'group') - Room type
- `createdAt`: DateTime - Room creation timestamp
- `lastMessageAt`: DateTime - Timestamp of most recent message
- `maxParticipants`: Integer - Maximum allowed participants (default 100)

**Validation Rules**:
- Group rooms require name
- Direct rooms limited to 2 participants
- Group rooms limited to maxParticipants

**Relationships**:
- One-to-many with Message
- Many-to-many with User (participants)

### Message
**Purpose**: Text content sent by users in conversations
**Fields**:
- `id`: UUID - Primary key
- `content`: Text (1-2000 chars) - Message text content
- `senderId`: UUID - Foreign key to User
- `chatRoomId`: UUID - Foreign key to ChatRoom
- `createdAt`: DateTime - Message timestamp
- `editedAt`: DateTime (nullable) - Last edit timestamp
- `messageType`: Enum('text', 'system') - Message type

**Validation Rules**:
- Content cannot be empty or only whitespace
- Content length limited to 2000 characters
- System messages can only be created by server

**Relationships**:
- Many-to-one with User (sender)
- Many-to-one with ChatRoom

### ChatRoomParticipant
**Purpose**: Junction table for user-room relationships with metadata
**Fields**:
- `userId`: UUID - Foreign key to User
- `chatRoomId`: UUID - Foreign key to ChatRoom
- `joinedAt`: DateTime - When user joined room
- `lastReadMessageId`: UUID (nullable) - Last message read by user
- `role`: Enum('member', 'admin') - User role in room

**Validation Rules**:
- Composite primary key (userId, chatRoomId)
- Admin role required for room management actions

### PresenceStatus
**Purpose**: Real-time indicator of user availability (stored in Redis)
**Fields**:
- `userId`: UUID - User identifier
- `status`: Enum('online', 'away', 'offline') - Presence state
- `lastSeen`: DateTime - Last activity timestamp
- `socketId`: String (nullable) - Current WebSocket connection ID
- `isTyping`: Boolean - Whether user is currently typing
- `typingInRoom`: UUID (nullable) - Room where user is typing

**State Transitions**:
- offline → online (user connects)
- online → away (after 5 minutes inactive)
- away → online (user activity detected)
- online/away → offline (user disconnects or 15 minutes inactive)

**TTL**: 24 hours (auto-expire in Redis)

## Database Schema Considerations

### Indexing Strategy
- `User.email` - Unique index for authentication
- `User.username` - Unique index for display
- `Message.chatRoomId, createdAt` - Composite index for room message history
- `Message.senderId` - Index for user's message history
- `ChatRoomParticipant.userId` - Index for user's rooms

### Data Retention
- Messages: 30 days automatic deletion
- User accounts: Retained until manual deletion
- Presence data: 24 hours TTL in Redis
- Session data: 7 days TTL in Redis

### Scalability Considerations
- Message table partitioning by date for large datasets
- Read replicas for message history queries
- Redis clustering for presence data at scale
- Connection pooling for database efficiency

## Event-Driven Architecture

### Domain Events
- `UserJoinedRoom` - User joins chat room
- `UserLeftRoom` - User leaves chat room
- `MessageSent` - New message created
- `UserTypingStarted` - User starts typing
- `UserTypingStopped` - User stops typing
- `UserPresenceChanged` - User online status changed

### Event Handlers
- Update presence status in Redis
- Broadcast real-time updates via WebSocket
- Update last activity timestamps
- Trigger push notifications (future feature)

## Security Model

### Access Control
- Users can only access rooms they're participants in
- Messages visible only to room participants
- Admin role required for room management
- User can only edit/delete own messages

### Data Privacy
- Message content not logged in application logs
- User email addresses not exposed in API responses
- Presence data automatically expires
- Support for message deletion/editing