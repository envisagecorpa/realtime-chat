import request from 'supertest';
import { Express } from 'express';
import Client from 'socket.io-client';

let app: Express;
let authToken1: string;
let authToken2: string;
let user1Id: string;
let user2Id: string;
let roomId: string;

describe('Real-time Messaging Integration Tests', () => {
  beforeAll(async () => {
    // TODO: Import app once it's created
    // app = await createApp();
  });

  beforeEach(async () => {
    // Create two test users
    const user1Response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice' });

    const user2Response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob' });

    authToken1 = user1Response.body.token;
    authToken2 = user2Response.body.token;
    user1Id = user1Response.body.user.id;
    user2Id = user2Response.body.user.id;

    // Create a shared room
    const roomResponse = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        name: 'Test Chat Room',
        type: 'group',
      });

    roomId = roomResponse.body.id;

    // Add second user to room
    await request(app)
      .post(`/api/rooms/${roomId}/participants`)
      .set('Authorization', `Bearer ${authToken1}`)
      .send({ userId: user2Id });
  });

  describe('End-to-End Message Flow', () => {
    it('should handle complete message exchange via WebSocket and REST', (done) => {
      let messagesReceived = 0;
      const expectedMessage = {
        content: 'Hello from Alice!',
        messageType: 'text',
        chatRoomId: roomId,
      };

      // Connect both users via WebSocket
      const client1 = Client('http://localhost:3001', {
        auth: { token: authToken1 },
      });

      const client2 = Client('http://localhost:3001', {
        auth: { token: authToken2 },
      });

      // User 2 listens for messages
      client2.on('message_received', (data: any) => {
        expect(data.message).toMatchObject({
          content: expectedMessage.content,
          messageType: expectedMessage.messageType,
          sender: expect.objectContaining({
            id: user1Id,
          }),
          chatRoomId: roomId,
        });

        messagesReceived++;
        if (messagesReceived === 1) {
          client1.close();
          client2.close();
          done();
        }
      });

      // Both users join the room
      Promise.all([
        new Promise((resolve) => {
          client1.emit('room_join', { chatRoomId: roomId });
          client1.on('room_joined', resolve);
        }),
        new Promise((resolve) => {
          client2.emit('room_join', { chatRoomId: roomId });
          client2.on('room_joined', resolve);
        }),
      ]).then(() => {
        // User 1 sends a message
        client1.emit('message_send', {
          ...expectedMessage,
          tempId: 'temp-123',
        });
      });
    });

    it('should persist messages and retrieve via REST API', async () => {
      // Send message via WebSocket (simulated)
      const messageData = {
        content: 'This message should be persisted',
        messageType: 'text',
        senderId: user1Id,
        chatRoomId: roomId,
      };

      // TODO: Send via WebSocket once implemented
      // For now, simulate by directly calling message endpoint

      // Retrieve message history via REST
      const historyResponse = await request(app)
        .get(`/api/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(historyResponse.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            content: expect.any(String),
            messageType: 'text',
            sender: expect.objectContaining({
              id: expect.any(String),
            }),
            chatRoomId: roomId,
          }),
        ]),
        hasMore: expect.any(Boolean),
      });
    });
  });

  describe('Presence and Typing Integration', () => {
    it('should track user presence across WebSocket connections', (done) => {
      const client1 = Client('http://localhost:3001', {
        auth: { token: authToken1 },
      });

      const client2 = Client('http://localhost:3001', {
        auth: { token: authToken2 },
      });

      // User 2 should see user 1 come online
      client2.on('user_online', (data: any) => {
        expect(data.user.id).toBe(user1Id);

        client1.close();
        client2.close();
        done();
      });

      // User 1 connects (should trigger user_online event)
      client1.on('connect', () => {
        // Connection established
      });
    });

    it('should handle typing indicators between users', (done) => {
      const client1 = Client('http://localhost:3001', {
        auth: { token: authToken1 },
      });

      const client2 = Client('http://localhost:3001', {
        auth: { token: authToken2 },
      });

      // Both users join the same room
      Promise.all([
        new Promise((resolve) => {
          client1.emit('room_join', { chatRoomId: roomId });
          client1.on('room_joined', resolve);
        }),
        new Promise((resolve) => {
          client2.emit('room_join', { chatRoomId: roomId });
          client2.on('room_joined', resolve);
        }),
      ]).then(() => {
        // User 2 listens for typing indicators
        client2.on('user_typing', (data: any) => {
          expect(data).toMatchObject({
            userId: user1Id,
            chatRoomId: roomId,
            isTyping: true,
          });

          client1.close();
          client2.close();
          done();
        });

        // User 1 starts typing
        client1.emit('typing_start', { chatRoomId: roomId });
      });
    });
  });

  describe('Message Delivery Status', () => {
    it('should track message delivery and read status', async () => {
      // This test will verify the complete message lifecycle:
      // 1. Send message
      // 2. Mark as delivered
      // 3. Mark as read
      // 4. Verify status updates

      // TODO: Implement once message services are available

      // For now, create a placeholder test
      expect(true).toBe(true); // Will be replaced with actual implementation
    });
  });

  describe('Error Handling', () => {
    it('should handle network disconnections gracefully', (done) => {
      const client = Client('http://localhost:3001', {
        auth: { token: authToken1 },
      });

      client.on('connect', () => {
        // Simulate network disconnection
        client.disconnect();
      });

      client.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });
    });

    it('should handle invalid room access attempts', async () => {
      const fakeRoomId = '123e4567-e89b-12d3-a456-426614174000';

      await request(app)
        .get(`/api/rooms/${fakeRoomId}/messages`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(404);
    });
  });
});