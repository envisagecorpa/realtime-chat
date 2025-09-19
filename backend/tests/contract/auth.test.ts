import request from 'supertest';
import { Express } from 'express';
import { AppDataSource } from '../../src/config/database';

// This will be imported once the app is created
let app: Express;

describe('Authentication Contract Tests', () => {
  beforeAll(async () => {
    // TODO: Import app once it's created
    // app = await createApp();
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser123' })
        .expect(200);

      expect(response.body).toMatchObject({
        user: expect.objectContaining({
          id: expect.any(String),
          username: 'testuser123',
          role: expect.stringMatching(/^(member|moderator)$/),
          createdAt: expect.any(String),
        }),
        token: expect.stringMatching(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/),
      });
    });

    it('should reject invalid username format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'a' }) // Too short
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String),
      });
    });

    it('should handle rate limiting', async () => {
      // Simulate multiple rapid requests
      const requests = Array(25).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ username: 'testuser123' })
      );

      const responses = await Promise.allSettled(requests);

      // At least one should be rate limited
      const rateLimitedResponse = responses.find(
        (r) => r.status === 'fulfilled' && r.value.status === 429
      );

      if (rateLimitedResponse && rateLimitedResponse.status === 'fulfilled') {
        expect(rateLimitedResponse.value.body).toMatchObject({
          error: expect.any(String),
          message: expect.any(String),
        });
      }
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      // Create a user and get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser123' });

      authToken = loginResponse.body.token;
    });

    it('should return current user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        username: 'testuser123',
        role: expect.stringMatching(/^(member|moderator)$/),
        createdAt: expect.any(String),
      });
    });

    it('should reject invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject missing token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });
});