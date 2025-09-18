# Contract Tests Specification

**Generated**: 2025-09-18
**Purpose**: Define contract tests to validate API endpoints and WebSocket events against specifications

## Test Strategy

### TDD Approach
- All contract tests written before implementation
- Tests must fail initially (red phase)
- Implementation makes tests pass (green phase)
- Refactoring maintains passing tests

### Test Organization
```
backend/tests/contract/
├── auth.test.ts           # Authentication endpoints
├── users.test.ts          # User management endpoints
├── rooms.test.ts          # Chat room endpoints
├── messages.test.ts       # Message endpoints
├── files.test.ts          # File upload endpoints
├── admin.test.ts          # Moderation endpoints
└── websocket.test.ts      # WebSocket event contracts
```

## REST API Contract Tests

### Authentication Contracts

#### POST /api/auth/login
```typescript
describe('POST /api/auth/login', () => {
  it('should authenticate user with valid username', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser123' })
      .expect(200);

    expect(response.body).toMatchSchema({
      type: 'object',
      required: ['user', 'token'],
      properties: {
        user: { $ref: 'User' },
        token: { type: 'string' }
      }
    });

    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('username', 'testuser123');
    expect(response.body.token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
  });

  it('should reject invalid username format', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ username: 'a' }) // Too short
      .expect(400)
      .expect((res) => {
        expect(res.body).toMatchSchema({
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        });
      });
  });

  it('should handle rate limiting', async () => {
    // Simulate multiple rapid requests
    const requests = Array(10).fill().map(() =>
      request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser123' })
    );

    const responses = await Promise.allSettled(requests);
    const rateLimitedResponse = responses.find(r =>
      r.status === 'fulfilled' && r.value.status === 429
    );

    if (rateLimitedResponse) {
      expect(rateLimitedResponse.value.body).toMatchSchema({
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: { enum: ['RATE_LIMIT_EXCEEDED'] },
          message: { type: 'string' }
        }
      });
    }
  });
});
```

#### GET /api/auth/me
```typescript
describe('GET /api/auth/me', () => {
  it('should return current user profile with valid token', async () => {
    const token = await getValidJwtToken('testuser123');

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchSchema({
      type: 'object',
      required: ['id', 'username', 'role', 'createdAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        username: { type: 'string' },
        displayName: { type: 'string' },
        role: { enum: ['member', 'moderator'] },
        isOnline: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    });
  });

  it('should reject invalid token', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });
});
```

### Users Management Contracts

#### GET /api/users
```typescript
describe('GET /api/users', () => {
  it('should return paginated user list', async () => {
    const token = await getValidJwtToken('testuser123');

    const response = await request(app)
      .get('/api/users?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchSchema({
      type: 'object',
      required: ['data', 'meta'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: 'User' }
        },
        meta: {
          type: 'object',
          required: ['page', 'limit', 'total', 'totalPages'],
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            total: { type: 'integer' },
            totalPages: { type: 'integer' }
          }
        }
      }
    });
  });

  it('should filter by online status', async () => {
    const token = await getValidJwtToken('testuser123');

    const response = await request(app)
      .get('/api/users?online=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    response.body.data.forEach(user => {
      expect(user.isOnline).toBe(true);
    });
  });
});
```

### Chat Rooms Contracts

#### POST /api/rooms
```typescript
describe('POST /api/rooms', () => {
  it('should create group chat room', async () => {
    const token = await getValidJwtToken('testuser123');

    const response = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Group Chat',
        type: 'group',
        description: 'A test group chat room'
      })
      .expect(201);

    expect(response.body).toMatchSchema({
      type: 'object',
      required: ['id', 'name', 'type', 'createdBy', 'createdAt'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        type: { enum: ['group'] },
        description: { type: 'string' },
        maxParticipants: { type: 'integer', minimum: 2, maximum: 500 },
        createdBy: { $ref: 'User' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    });

    expect(response.body.name).toBe('Test Group Chat');
    expect(response.body.type).toBe('group');
  });

  it('should reject invalid room type', async () => {
    const token = await getValidJwtToken('testuser123');

    await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Invalid Room',
        type: 'invalid_type'
      })
      .expect(400);
  });
});
```

### Messages Contracts

#### GET /api/rooms/{roomId}/messages
```typescript
describe('GET /api/rooms/{roomId}/messages', () => {
  it('should return room message history', async () => {
    const token = await getValidJwtToken('testuser123');
    const roomId = await createTestRoom();

    const response = await request(app)
      .get(`/api/rooms/${roomId}/messages?limit=20`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchSchema({
      type: 'object',
      required: ['data', 'hasMore'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: 'Message' }
        },
        hasMore: { type: 'boolean' },
        nextCursor: { type: 'string', format: 'date-time' }
      }
    });
  });

  it('should respect pagination with before parameter', async () => {
    const token = await getValidJwtToken('testuser123');
    const roomId = await createTestRoom();
    const beforeTimestamp = new Date().toISOString();

    const response = await request(app)
      .get(`/api/rooms/${roomId}/messages?before=${beforeTimestamp}&limit=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    response.body.data.forEach(message => {
      expect(new Date(message.createdAt).getTime())
        .toBeLessThan(new Date(beforeTimestamp).getTime());
    });
  });

  it('should reject access to unauthorized room', async () => {
    const token = await getValidJwtToken('testuser123');
    const privateRoomId = await createPrivateRoom(); // Room user is not in

    await request(app)
      .get(`/api/rooms/${privateRoomId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
```

### File Upload Contracts

#### POST /api/files/upload
```typescript
describe('POST /api/files/upload (tus.io)', () => {
  it('should create upload session with valid metadata', async () => {
    const token = await getValidJwtToken('testuser123');
    const fileSize = 1024 * 1024; // 1MB
    const metadata = Buffer.from('filename test.jpg,filetype image/jpeg').toString('base64');

    const response = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Upload-Length', fileSize.toString())
      .set('Upload-Metadata', metadata)
      .set('Tus-Resumable', '1.0.0')
      .expect(201);

    expect(response.headers).toHaveProperty('location');
    expect(response.headers).toHaveProperty('upload-offset', '0');
    expect(response.headers['location']).toMatch(/\/api\/files\/upload\/[a-f0-9-]+$/);
  });

  it('should reject files exceeding size limit', async () => {
    const token = await getValidJwtToken('testuser123');
    const fileSize = 11 * 1024 * 1024; // 11MB (exceeds 10MB limit)

    await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Upload-Length', fileSize.toString())
      .set('Tus-Resumable', '1.0.0')
      .expect(413);
  });
});
```

### Moderation Contracts

#### POST /api/admin/users/{userId}/block
```typescript
describe('POST /api/admin/users/{userId}/block', () => {
  it('should block user with moderator permissions', async () => {
    const moderatorToken = await getModeratorToken('moderator123');
    const targetUserId = await createTestUser('targetuser');

    await request(app)
      .post(`/api/admin/users/${targetUserId}/block`)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({
        reason: 'Inappropriate behavior',
        duration: 1440 // 24 hours in minutes
      })
      .expect(204);
  });

  it('should reject block attempt from regular user', async () => {
    const userToken = await getValidJwtToken('regularuser');
    const targetUserId = await createTestUser('targetuser');

    await request(app)
      .post(`/api/admin/users/${targetUserId}/block`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        reason: 'Test block'
      })
      .expect(403);
  });
});
```

## WebSocket Contract Tests

### Connection Management
```typescript
describe('WebSocket Connection', () => {
  it('should establish connection with valid JWT token', async () => {
    const token = await getValidJwtToken('testuser123');
    const client = io('ws://localhost:3001', {
      auth: { token },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      client.on('connect', resolve);
      client.on('connect_error', reject);
      setTimeout(reject, 5000); // 5 second timeout
    });

    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it('should reject connection with invalid token', async () => {
    const client = io('ws://localhost:3001', {
      auth: { token: 'invalid-token' },
      transports: ['websocket']
    });

    await expect(new Promise((resolve, reject) => {
      client.on('connect', reject);
      client.on('connect_error', resolve);
      setTimeout(reject, 5000);
    })).resolves.toBeDefined();
  });
});
```

### Messaging Events
```typescript
describe('WebSocket Messaging', () => {
  it('should send and receive messages', async () => {
    const [sender, receiver] = await createConnectedClients(['user1', 'user2']);
    const roomId = await createSharedRoom(['user1', 'user2']);

    // Both clients join the room
    await Promise.all([
      joinRoom(sender, roomId),
      joinRoom(receiver, roomId)
    ]);

    // Set up message reception
    const messagePromise = new Promise((resolve) => {
      receiver.on('message_received', resolve);
    });

    // Send message
    sender.emit('message_send', {
      content: 'Hello, World!',
      chatRoomId: roomId,
      messageType: 'text',
      tempId: 'temp-123'
    });

    // Verify message received
    const receivedMessage = await messagePromise;
    expect(receivedMessage).toMatchObject({
      message: {
        content: 'Hello, World!',
        messageType: 'text',
        sender: expect.objectContaining({ username: 'user1' }),
        chatRoomId: roomId
      }
    });
  });

  it('should handle message editing', async () => {
    const client = await createConnectedClient('testuser');
    const roomId = await createTestRoom();
    const messageId = await sendTestMessage(client, roomId, 'Original message');

    const editPromise = new Promise((resolve) => {
      client.on('message_edited', resolve);
    });

    // Edit message via REST API
    const token = await getValidJwtToken('testuser');
    await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Edited message' });

    const editedMessage = await editPromise;
    expect(editedMessage).toMatchObject({
      messageId,
      content: 'Edited message',
      editedAt: expect.any(String)
    });
  });
});
```

### Presence Events
```typescript
describe('WebSocket Presence', () => {
  it('should broadcast user online status', async () => {
    const observer = await createConnectedClient('observer');

    const presencePromise = new Promise((resolve) => {
      observer.on('user_online', resolve);
    });

    // New user connects
    const newUser = await createConnectedClient('newuser');

    const presenceUpdate = await presencePromise;
    expect(presenceUpdate).toMatchObject({
      user: expect.objectContaining({ username: 'newuser' }),
      connectedAt: expect.any(String)
    });

    newUser.disconnect();
  });

  it('should handle typing indicators', async () => {
    const [typer, observer] = await createConnectedClients(['typer', 'observer']);
    const roomId = await createSharedRoom(['typer', 'observer']);

    await Promise.all([
      joinRoom(typer, roomId),
      joinRoom(observer, roomId)
    ]);

    const typingPromise = new Promise((resolve) => {
      observer.on('user_typing', resolve);
    });

    typer.emit('typing_start', { chatRoomId: roomId });

    const typingIndicator = await typingPromise;
    expect(typingIndicator).toMatchObject({
      userId: expect.any(String),
      chatRoomId: roomId,
      isTyping: true
    });
  });
});
```

### File Sharing Events
```typescript
describe('WebSocket File Sharing', () => {
  it('should broadcast file upload progress', async () => {
    const [uploader, observer] = await createConnectedClients(['uploader', 'observer']);
    const roomId = await createSharedRoom(['uploader', 'observer']);

    const progressPromise = new Promise((resolve) => {
      observer.on('file_upload_progress', resolve);
    });

    uploader.emit('file_upload_start', {
      fileName: 'test.jpg',
      fileSize: 1024000,
      chatRoomId: roomId,
      uploadId: 'upload-123'
    });

    // Simulate progress update from server
    // (This would typically come from the file upload service)

    const progress = await progressPromise;
    expect(progress).toMatchObject({
      uploadId: 'upload-123',
      fileName: 'test.jpg',
      progress: expect.any(Number),
      chatRoomId: roomId
    });
  });
});
```

## Schema Validation Helpers

```typescript
// Test utilities for schema validation
export const schemas = {
  User: {
    type: 'object',
    required: ['id', 'username', 'role', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      username: { type: 'string' },
      displayName: { type: 'string' },
      role: { enum: ['member', 'moderator'] },
      isOnline: { type: 'boolean' },
      lastSeen: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },

  Message: {
    type: 'object',
    required: ['id', 'sender', 'chatRoomId', 'messageType', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      content: { type: 'string' },
      messageType: { enum: ['text', 'system', 'file_attachment'] },
      sender: { $ref: '#/definitions/User' },
      chatRoomId: { type: 'string', format: 'uuid' },
      hasAttachments: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  }
};

// Custom matchers
expect.extend({
  toMatchSchema(received, schema) {
    const ajv = new Ajv({ allErrors: true, verbose: true });
    const validate = ajv.compile(schema);
    const valid = validate(received);

    if (valid) {
      return {
        message: () => `Expected data not to match schema`,
        pass: true
      };
    } else {
      return {
        message: () => `Schema validation failed: ${ajv.errorsText(validate.errors)}`,
        pass: false
      };
    }
  }
});
```

## Test Environment Setup

### Database Fixtures
```typescript
// Create test data before each test suite
beforeAll(async () => {
  await setupTestDatabase();
  await seedTestUsers();
  await seedTestRooms();
});

afterAll(async () => {
  await cleanupTestDatabase();
});

// Reset state between tests
beforeEach(async () => {
  await resetTestData();
});
```

### Mock Services
```typescript
// Mock external dependencies
jest.mock('../src/services/FileStorageService');
jest.mock('../src/services/NotificationService');
jest.mock('../src/services/ModerationService');
```

These contract tests ensure that both REST API endpoints and WebSocket events conform to their specifications, providing confidence that the implementation meets the defined contracts. All tests are designed to fail initially and pass only when proper implementation is provided.