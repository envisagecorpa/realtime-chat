import request from 'supertest';
import { Express } from 'express';

let app: Express;
let authToken: string;
let userId: string;

describe('Chat Rooms Contract Tests', () => {
  beforeAll(async () => {
    // TODO: Import app once it's created
    // app = await createApp();
  });

  beforeEach(async () => {
    // Get auth token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser123' });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;
  });

  describe('GET /api/rooms', () => {
    it('should return user chat rooms', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((room: any) => {
        expect(room).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          type: expect.stringMatching(/^(direct|group|public)$/),
          createdBy: expect.objectContaining({
            id: expect.any(String),
            username: expect.any(String),
          }),
          createdAt: expect.any(String),
        });
      });
    });

    it('should filter by room type', async () => {
      const response = await request(app)
        .get('/api/rooms?type=group')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.forEach((room: any) => {
        expect(room.type).toBe('group');
      });
    });
  });

  describe('POST /api/rooms', () => {
    it('should create group chat room', async () => {
      const roomData = {
        name: 'Test Group Chat',
        type: 'group',
        description: 'A test group chat room',
        maxParticipants: 50,
      };

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roomData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Group Chat',
        type: 'group',
        description: 'A test group chat room',
        maxParticipants: 50,
        createdBy: expect.objectContaining({
          id: userId,
        }),
        createdAt: expect.any(String),
      });
    });

    it('should create public chat room', async () => {
      const roomData = {
        name: 'Public Discussion',
        type: 'public',
      };

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roomData)
        .expect(201);

      expect(response.body.type).toBe('public');
    });

    it('should reject invalid room type', async () => {
      const roomData = {
        name: 'Invalid Room',
        type: 'invalid_type',
      };

      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roomData)
        .expect(400);
    });

    it('should reject missing name', async () => {
      const roomData = {
        type: 'group',
      };

      await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roomData)
        .expect(400);
    });
  });

  describe('GET /api/rooms/{roomId}', () => {
    let roomId: string;

    beforeEach(async () => {
      // Create a test room
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Room',
          type: 'group',
        });

      roomId = response.body.id;
    });

    it('should return room details for participant', async () => {
      const response = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: roomId,
        name: 'Test Room',
        type: 'group',
        createdBy: expect.objectContaining({
          id: userId,
        }),
      });
    });

    it('should reject access to non-existent room', async () => {
      const fakeRoomId = '123e4567-e89b-12d3-a456-426614174000';

      await request(app)
        .get(`/api/rooms/${fakeRoomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/rooms/{roomId}', () => {
    let roomId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Room',
          type: 'group',
        });

      roomId = response.body.id;
    });

    it('should update room details by creator', async () => {
      const updateData = {
        name: 'Updated Room Name',
        description: 'Updated description',
      };

      const response = await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: roomId,
        name: 'Updated Room Name',
        description: 'Updated description',
      });
    });

    it('should reject update by non-admin', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'otheruser' });

      const otherToken = otherUserResponse.body.token;

      await request(app)
        .patch(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });
});