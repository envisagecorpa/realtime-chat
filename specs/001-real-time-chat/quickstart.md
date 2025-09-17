# Quickstart: Real-time Chat System

## Setup & Run

### Prerequisites
```bash
# Required software
node --version  # v18.0.0 or higher
npm --version   # v8.0.0 or higher
docker --version  # For PostgreSQL and Redis
```

### Database Setup
```bash
# Start PostgreSQL and Redis with Docker
docker run -d \
  --name postgres \
  -e POSTGRES_DB=chatdb \
  -e POSTGRES_USER=chatuser \
  -e POSTGRES_PASSWORD=chatpass \
  -p 5432:5432 \
  postgres:15

docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with database connection details

# Run database migrations
npm run migrate

# Start development server
npm run dev
# Server runs on http://localhost:3000
```

### Frontend Setup
```bash
# Navigate to frontend directory (new terminal)
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Frontend runs on http://localhost:5173
```

## User Test Scenarios

### Scenario 1: User Registration and Login
**Given**: Clean database
**When**: User completes registration flow
**Then**: User should be authenticated and see chat interface

**Steps**:
1. Open http://localhost:5173
2. Click "Sign Up"
3. Enter username: "testuser1", email: "test1@example.com", password: "password123"
4. Submit form
5. **Expected**: Redirected to chat dashboard
6. **Verify**: Username appears in header, empty room list shown

### Scenario 2: Create and Join Chat Room
**Given**: Authenticated user (testuser1)
**When**: User creates a group chat
**Then**: User should be able to send/receive messages

**Steps**:
1. Complete Scenario 1
2. Click "Create Room" button
3. Enter room name: "General Chat"
4. Select type: "Group"
5. Click "Create"
6. **Expected**: New room appears in sidebar, room opens automatically
7. **Verify**: Room header shows "General Chat", message input is visible

### Scenario 3: Real-time Messaging
**Given**: Two users in the same chat room
**When**: One user sends a message
**Then**: Other user sees message immediately

**Steps**:
1. Complete Scenario 2 with testuser1
2. Open new incognito window, register testuser2
3. Have testuser2 join "General Chat" room
4. testuser1 types message: "Hello everyone!"
5. Press Enter to send
6. **Expected**: Message appears for both users instantly
7. **Verify**: Message shows sender username and timestamp

### Scenario 4: User Presence
**Given**: Multiple users online
**When**: User joins/leaves or goes inactive
**Then**: Presence status updates for other users

**Steps**:
1. Have testuser1 and testuser2 in same room
2. Check participant list shows both as "online"
3. Close testuser2's browser tab
4. Wait 60 seconds
5. **Expected**: testuser2 shows as "offline" in participant list
6. **Verify**: Presence indicator changes color/status

### Scenario 5: Message History
**Given**: Room with existing messages
**When**: User joins room or refreshes page
**Then**: Previous messages are displayed

**Steps**:
1. Send 5 messages between testuser1 and testuser2
2. testuser1 refreshes browser
3. Logs in again, opens same room
4. **Expected**: All 5 previous messages are visible
5. **Verify**: Messages show in chronological order with correct timestamps

### Scenario 6: Typing Indicators
**Given**: Two users in same room
**When**: One user starts typing
**Then**: Other user sees typing indicator

**Steps**:
1. Have testuser1 and testuser2 in same room
2. testuser1 clicks in message input and starts typing
3. **Expected**: testuser2 sees "testuser1 is typing..." indicator
4. testuser1 stops typing for 3 seconds
5. **Expected**: Typing indicator disappears

## API Testing

### Authentication Test
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "apitest",
    "email": "api@example.com",
    "password": "password123"
  }'

# Expected: 201 status with user data and tokens
```

### Message Test
```bash
# Send message (use token from registration)
curl -X POST http://localhost:3000/api/rooms/{roomId}/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {accessToken}" \
  -d '{
    "content": "Hello from API"
  }'

# Expected: 201 status with message data
```

### WebSocket Test
```javascript
// Connect to WebSocket (run in browser console)
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connect', () => console.log('Connected'));
socket.on('message_received', (msg) => console.log('New message:', msg));

// Join room
socket.emit('join_room', { roomId: 'room-uuid' });

// Send message
socket.emit('send_message', {
  roomId: 'room-uuid',
  content: 'Hello WebSocket!'
});
```

## Performance Verification

### Load Test
```bash
# Install artillery for load testing
npm install -g artillery

# Test WebSocket connections
artillery run websocket-load-test.yml
# Expected: <100ms response time, 0% error rate for 100 concurrent users
```

### Database Performance
```sql
-- Test message query performance
EXPLAIN ANALYZE
SELECT * FROM messages
WHERE chat_room_id = 'room-uuid'
ORDER BY created_at DESC
LIMIT 50;

-- Expected: Query time <50ms with proper indexing
```

## Troubleshooting

### Common Issues
1. **Cannot connect to database**: Check Docker containers running
2. **WebSocket connection fails**: Verify JWT token and CORS settings
3. **Messages not appearing**: Check browser console for errors
4. **Slow performance**: Verify database indexes are created

### Debug Commands
```bash
# Check backend logs
npm run dev  # Watch console output

# Check database connections
docker exec -it postgres psql -U chatuser -d chatdb -c "SELECT COUNT(*) FROM users;"

# Check Redis connections
docker exec -it redis redis-cli ping
```

## Success Criteria Validation

✅ **Real-time messaging**: Messages appear instantly (<100ms)
✅ **User presence**: Online/offline status updates automatically
✅ **Message history**: Previous messages load on room entry
✅ **Multiple users**: Supports concurrent users in same room
✅ **Typing indicators**: Shows when users are typing
✅ **Authentication**: Secure login/registration flow
✅ **Data persistence**: Messages saved and retrieved correctly