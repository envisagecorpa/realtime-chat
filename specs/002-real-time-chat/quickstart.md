# Quickstart Guide: Real-time Chat System

**Generated**: 2025-09-18
**Purpose**: Testing scenarios and validation guide for real-time chat system implementation

## Prerequisites

### Development Environment
- Node.js 18+ with npm/yarn
- PostgreSQL 15+ running on port 5432
- Redis 7+ running on port 6379
- Git for version control

### Quick Setup Commands
```bash
# Clone and setup project
git clone <repository-url>
cd realtime-chat

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Setup environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Initialize database
cd backend
npm run migrate:up
npm run seed:dev

# Start services
npm run dev:all  # Starts backend, frontend, and development servers
```

## Testing Scenarios

### 1. User Authentication Flow

#### Scenario: Username-only Login
```bash
# Test valid login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser123"}'

# Expected Response (200 OK):
{
  "user": {
    "id": "uuid",
    "username": "testuser123",
    "role": "member",
    "createdAt": "2025-09-18T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Test invalid username
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "a"}'

# Expected Response (400 Bad Request):
{
  "error": "VALIDATION_ERROR",
  "message": "Username must be 3-50 characters"
}
```

#### Scenario: Profile Management
```bash
# Get current user profile
export TOKEN="your-jwt-token"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/auth/me

# Update profile
curl -X PATCH http://localhost:3001/api/users/{userId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "John Doe", "email": "john@example.com"}'
```

### 2. Real-time Messaging

#### Scenario: Direct Message Exchange
```html
<!-- Frontend test with Socket.IO -->
<script src="/socket.io/socket.io.js"></script>
<script>
// Connect with authentication
const socket = io('ws://localhost:3001', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);

  // Join a direct message room
  socket.emit('room_join', { chatRoomId: 'room-uuid' });
});

socket.on('room_joined', (data) => {
  console.log('Joined room:', data.room.name);
  console.log('Online users:', data.onlineUsers);
  console.log('Unread count:', data.unreadCount);

  // Send a message
  socket.emit('message_send', {
    content: 'Hello from quickstart test!',
    chatRoomId: data.room.id,
    messageType: 'text',
    tempId: 'temp-' + Date.now()
  });
});

socket.on('message_received', (data) => {
  console.log('New message:', data.message);
  // Verify message structure matches schema
  console.assert(data.message.id, 'Message has ID');
  console.assert(data.message.content, 'Message has content');
  console.assert(data.message.sender, 'Message has sender');
});

socket.on('user_typing', (data) => {
  console.log('User typing:', data.user.username);
});
</script>
```

#### Scenario: Group Chat Operations
```bash
# Create group chat room
curl -X POST http://localhost:3001/api/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Development Team",
    "type": "group",
    "description": "Team collaboration space",
    "maxParticipants": 20
  }'

# Add participants
curl -X POST http://localhost:3001/api/rooms/{roomId}/participants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "participant-uuid", "role": "member"}'

# Get message history
curl "http://localhost:3001/api/rooms/{roomId}/messages?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. User Presence Tracking

#### Scenario: Online Status Monitoring
```javascript
// Monitor presence changes
socket.on('user_online', (data) => {
  console.log(`${data.user.username} came online at ${data.connectedAt}`);
  updateUserList(data.user, 'online');
});

socket.on('user_offline', (data) => {
  console.log(`${data.user.username} went offline at ${data.lastSeen}`);
  updateUserList(data.user, 'offline');
});

socket.on('user_presence_update', (data) => {
  console.log(`${data.user.username} status: ${data.status}`);
  updateUserStatus(data.userId, data.status);
});

// Test heartbeat mechanism
setInterval(() => {
  // Heartbeat is automatic with Socket.IO, but you can monitor
  console.log('Connection active:', socket.connected);
}, 30000);
```

#### Scenario: Typing Indicators
```javascript
let typingTimeout;

// Start typing indicator
function onTypingStart(roomId) {
  socket.emit('typing_start', { chatRoomId: roomId });

  // Auto-stop typing after 3 seconds of inactivity
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing_stop', { chatRoomId: roomId });
  }, 3000);
}

// Listen for typing indicators from others
socket.on('user_typing', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.user.username);
  } else {
    hideTypingIndicator(data.user.username);
  }
});
```

### 4. File Upload and Sharing

#### Scenario: File Upload with tus.io
```javascript
// Frontend file upload
import { Upload } from 'tus-js-client';

function uploadFile(file, roomId, token) {
  const upload = new Upload(file, {
    endpoint: 'http://localhost:3001/api/files/upload',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    metadata: {
      filename: file.name,
      filetype: file.type,
      roomId: roomId
    },
    chunkSize: 1024 * 1024, // 1MB chunks

    onProgress: (bytesUploaded, bytesTotal) => {
      const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
      console.log('Upload progress:', percentage + '%');

      // Notify room of progress
      socket.emit('file_upload_progress', {
        uploadId: upload.url.split('/').pop(),
        progress: percentage,
        roomId: roomId
      });
    },

    onSuccess: () => {
      console.log('Upload completed successfully');
      socket.emit('file_upload_complete', {
        fileId: upload.url.split('/').pop(),
        roomId: roomId
      });
    },

    onError: (error) => {
      console.error('Upload failed:', error);
      socket.emit('file_upload_error', {
        uploadId: upload.url.split('/').pop(),
        error: error.message,
        roomId: roomId
      });
    }
  });

  upload.start();
  return upload;
}

// Test file size validation
const maxSize = 10 * 1024 * 1024; // 10MB
if (file.size > maxSize) {
  alert('File too large. Maximum size is 10MB.');
  return;
}
```

#### Scenario: File Download and Access
```bash
# Download file attachment
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/files/{fileId} \
  --output downloaded_file.jpg

# Get file metadata
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/files/{fileId}/info
```

### 5. Message History and Search

#### Scenario: Conversation History
```bash
# Get recent messages
curl "http://localhost:3001/api/rooms/{roomId}/messages?limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Get messages before specific timestamp
curl "http://localhost:3001/api/rooms/{roomId}/messages?before=2025-09-18T10:00:00Z&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Get messages after specific timestamp (for real-time sync)
curl "http://localhost:3001/api/rooms/{roomId}/messages?after=2025-09-18T09:00:00Z" \
  -H "Authorization: Bearer $TOKEN"
```

#### Scenario: Message Editing and Deletion
```javascript
// Edit message (within 5-minute window)
socket.on('message_received', (data) => {
  const messageId = data.message.id;

  setTimeout(async () => {
    // Edit message via REST API
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: 'Edited message content' })
    });

    if (response.ok) {
      console.log('Message edited successfully');
    }
  }, 1000); // Edit after 1 second
});

// Listen for edit notifications
socket.on('message_edited', (data) => {
  console.log('Message edited:', data.messageId, data.content);
  updateMessageInUI(data.messageId, data.content, data.editedAt);
});
```

### 6. Moderation Features

#### Scenario: User Reporting
```bash
# Report a user (any user can report)
curl -X POST http://localhost:3001/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportedUserId": "user-uuid",
    "reason": "Inappropriate behavior in chat",
    "messageId": "message-uuid"
  }'
```

#### Scenario: Moderator Actions
```bash
# Block user (moderator only)
curl -X POST http://localhost:3001/api/admin/users/{userId}/block \
  -H "Authorization: Bearer $MODERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Spam and inappropriate content",
    "duration": 1440
  }'

# View reports (moderator only)
curl "http://localhost:3001/api/admin/reports?status=pending" \
  -H "Authorization: Bearer $MODERATOR_TOKEN"

# Resolve report
curl -X PATCH http://localhost:3001/api/admin/reports/{reportId} \
  -H "Authorization: Bearer $MODERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved", "action": "warning_issued"}'
```

## Validation Checklist

### Functional Requirements Validation

#### FR-001: Real-time messaging
- [ ] Messages appear instantly in recipient's chat window
- [ ] Message delivery latency < 100ms
- [ ] Messages persist to database
- [ ] Offline users receive messages when reconnecting

#### FR-002: User presence tracking
- [ ] Online/offline status updates in real-time
- [ ] Visual indicators show user availability
- [ ] Presence maintained across browser refresh
- [ ] Away status after 5 minutes of inactivity

#### FR-003: Message persistence
- [ ] All messages saved to PostgreSQL
- [ ] Message history loads correctly
- [ ] Conversation continuity across sessions
- [ ] 30-day retention policy enforced

#### FR-004: Instant delivery
- [ ] No page refresh required for new messages
- [ ] WebSocket connection handles reconnection
- [ ] Message queue processes during disconnection
- [ ] Real-time delivery confirmed via read receipts

#### FR-005: Conversation history
- [ ] Complete message history displays when opening chat
- [ ] Pagination works with large message volumes
- [ ] Search functionality finds relevant messages
- [ ] Media attachments display correctly in history

#### FR-006: Typing indicators
- [ ] Typing indicators appear/disappear correctly
- [ ] Multiple users typing shows properly
- [ ] Indicators timeout after 10 seconds
- [ ] No interference between different rooms

#### FR-007: Direct and group messages
- [ ] Direct message rooms created automatically
- [ ] Group rooms support multiple participants
- [ ] Room permissions enforced correctly
- [ ] Maximum participant limits respected

#### FR-008: Message timestamps
- [ ] All messages have accurate timestamps
- [ ] Timestamps display in user's timezone
- [ ] Chronological order maintained
- [ ] Edited messages show edit timestamp

#### FR-009: Delivery status
- [ ] Sent/delivered/read status tracked
- [ ] Status indicators update in real-time
- [ ] Group message status shows per participant
- [ ] Failed delivery handled gracefully

#### FR-010: Session management
- [ ] User sessions persist across reconnections
- [ ] Multiple device support works correctly
- [ ] Session cleanup after disconnection
- [ ] Auto-reconnect on network restoration

### Performance Validation

#### Concurrency Testing
```bash
# Load test with 100 concurrent connections
npm run test:load -- --connections 100 --duration 60s

# Expected results:
# - All connections established successfully
# - Message delivery < 100ms p95
# - No connection drops
# - Memory usage < 200MB per 100 connections
```

#### Message Throughput
```bash
# Test message broadcasting
npm run test:throughput -- --users 50 --messages-per-second 100

# Expected results:
# - 1000+ messages/second throughput
# - No message loss
# - Ordered delivery maintained
# - CPU usage < 70%
```

### Security Validation

#### Authentication Testing
- [ ] Invalid JWT tokens rejected
- [ ] Expired tokens require re-authentication
- [ ] User sessions isolated properly
- [ ] Rate limiting prevents abuse

#### Authorization Testing
- [ ] Users can only access authorized rooms
- [ ] Message editing restricted to sender
- [ ] Moderator privileges enforced correctly
- [ ] File access permissions validated

#### Input Validation
- [ ] Message content sanitized
- [ ] File upload validation working
- [ ] SQL injection prevention active
- [ ] XSS protection implemented

## Troubleshooting Guide

### Common Issues

#### WebSocket Connection Problems
```javascript
// Debug connection issues
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);

  // Check common causes:
  // 1. Invalid/expired JWT token
  // 2. Server not running
  // 3. Network connectivity
  // 4. CORS configuration
});

// Monitor connection status
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server initiated disconnect, manually reconnect
    socket.connect();
  }
});
```

#### Message Delivery Issues
- Verify WebSocket connection is established
- Check room membership for users
- Confirm database connectivity
- Monitor Redis connection for presence data

#### File Upload Problems
- Ensure tus.io server configuration is correct
- Check file size limits (10MB max)
- Verify MIME type allowlist
- Confirm storage service accessibility

#### Performance Degradation
- Monitor database query performance
- Check Redis memory usage
- Verify WebSocket connection pooling
- Review message queue processing

### Development Tools

#### Database Queries
```sql
-- Check message delivery status
SELECT m.id, m.content, m.delivery_status, mrs.read_at
FROM messages m
LEFT JOIN message_read_status mrs ON m.id = mrs.message_id
WHERE m.chat_room_id = 'room-uuid'
ORDER BY m.created_at DESC;

-- Monitor user presence
SELECT u.username, us.presence_status, us.last_heartbeat
FROM users u
JOIN user_sessions us ON u.id = us.user_id
WHERE us.disconnected_at IS NULL;
```

#### Redis Monitoring
```bash
# Monitor real-time commands
redis-cli monitor

# Check presence data
redis-cli keys "presence:*"
redis-cli smembers "presence:online"

# Monitor typing indicators
redis-cli keys "typing:*"
```

This quickstart guide provides comprehensive testing scenarios and validation procedures to ensure the real-time chat system meets all functional requirements and performance targets.