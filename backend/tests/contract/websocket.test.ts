import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';
import { AddressInfo } from 'net';

describe('WebSocket Contract Tests', () => {
  let server: Server;
  let httpServer: ReturnType<typeof createServer>;
  let serverSocket: any;
  let clientSocket: any;
  let port: number;

  beforeAll((done) => {
    httpServer = createServer();
    server = new Server(httpServer);
    httpServer.listen(() => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll(() => {
    server.close();
    httpServer.close();
  });

  beforeEach((done) => {
    server.on('connection', (socket) => {
      serverSocket = socket;
    });

    clientSocket = Client(`http://localhost:${port}`, {
      auth: { token: 'valid-jwt-token' }, // TODO: Use real JWT
    });

    clientSocket.on('connect', done);
  });

  afterEach(() => {
    server.removeAllListeners();
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should establish connection with valid JWT token', () => {
      expect(clientSocket.connected).toBe(true);
    });

    it('should reject connection with invalid token', (done) => {
      const invalidClient = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
      });

      invalidClient.on('connect_error', (error) => {
        expect(error).toBeDefined();
        invalidClient.close();
        done();
      });

      invalidClient.on('connect', () => {
        fail('Should not connect with invalid token');
        invalidClient.close();
        done();
      });
    });
  });

  describe('Message Events', () => {
    it('should handle message_send event', (done) => {
      const messageData = {
        content: 'Hello, World!',
        chatRoomId: '123e4567-e89b-12d3-a456-426614174000',
        messageType: 'text',
        tempId: 'temp-123',
      };

      serverSocket.on('message_send', (data: any) => {
        expect(data).toMatchObject({
          content: 'Hello, World!',
          chatRoomId: expect.any(String),
          messageType: 'text',
          tempId: 'temp-123',
        });
        done();
      });

      clientSocket.emit('message_send', messageData);
    });

    it('should broadcast message_received event', (done) => {
      const messageData = {
        message: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          content: 'Hello from server',
          messageType: 'text',
          sender: {
            id: 'user-id',
            username: 'testuser',
          },
          chatRoomId: 'room-id',
          createdAt: new Date().toISOString(),
        },
      };

      clientSocket.on('message_received', (data: any) => {
        expect(data).toMatchObject({
          message: expect.objectContaining({
            id: expect.any(String),
            content: 'Hello from server',
            messageType: 'text',
            sender: expect.objectContaining({
              id: expect.any(String),
              username: expect.any(String),
            }),
          }),
        });
        done();
      });

      // Simulate server broadcasting message
      serverSocket.emit('message_received', messageData);
    });
  });

  describe('Presence Events', () => {
    it('should handle user_online event', (done) => {
      const presenceData = {
        user: {
          id: 'user-id',
          username: 'testuser',
          isOnline: true,
        },
        connectedAt: new Date().toISOString(),
      };

      clientSocket.on('user_online', (data: any) => {
        expect(data).toMatchObject({
          user: expect.objectContaining({
            id: expect.any(String),
            username: expect.any(String),
          }),
          connectedAt: expect.any(String),
        });
        done();
      });

      serverSocket.emit('user_online', presenceData);
    });

    it('should handle typing_start event', (done) => {
      const typingData = {
        chatRoomId: 'room-id',
      };

      serverSocket.on('typing_start', (data: any) => {
        expect(data).toMatchObject({
          chatRoomId: expect.any(String),
        });
        done();
      });

      clientSocket.emit('typing_start', typingData);
    });

    it('should broadcast user_typing event', (done) => {
      const typingIndicator = {
        userId: 'user-id',
        user: {
          id: 'user-id',
          username: 'testuser',
        },
        chatRoomId: 'room-id',
        isTyping: true,
        timestamp: new Date().toISOString(),
      };

      clientSocket.on('user_typing', (data: any) => {
        expect(data).toMatchObject({
          userId: expect.any(String),
          user: expect.objectContaining({
            username: expect.any(String),
          }),
          chatRoomId: expect.any(String),
          isTyping: true,
        });
        done();
      });

      serverSocket.emit('user_typing', typingIndicator);
    });
  });

  describe('Room Events', () => {
    it('should handle room_join event', (done) => {
      const joinData = {
        chatRoomId: 'room-id',
      };

      serverSocket.on('room_join', (data: any) => {
        expect(data).toMatchObject({
          chatRoomId: expect.any(String),
        });
        done();
      });

      clientSocket.emit('room_join', joinData);
    });

    it('should broadcast room_joined event', (done) => {
      const joinedData = {
        room: {
          id: 'room-id',
          name: 'Test Room',
          type: 'group',
        },
        participants: [
          {
            id: 'user1',
            username: 'user1',
          },
        ],
        onlineUsers: ['user1'],
        unreadCount: 0,
      };

      clientSocket.on('room_joined', (data: any) => {
        expect(data).toMatchObject({
          room: expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            type: expect.stringMatching(/^(direct|group|public)$/),
          }),
          participants: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              username: expect.any(String),
            }),
          ]),
          onlineUsers: expect.any(Array),
          unreadCount: expect.any(Number),
        });
        done();
      });

      serverSocket.emit('room_joined', joinedData);
    });
  });

  describe('File Upload Events', () => {
    it('should handle file_upload_start event', (done) => {
      const uploadData = {
        fileName: 'test.jpg',
        fileSize: 1024000,
        chatRoomId: 'room-id',
        uploadId: 'upload-123',
      };

      serverSocket.on('file_upload_start', (data: any) => {
        expect(data).toMatchObject({
          fileName: 'test.jpg',
          fileSize: 1024000,
          chatRoomId: expect.any(String),
          uploadId: 'upload-123',
        });
        done();
      });

      clientSocket.emit('file_upload_start', uploadData);
    });

    it('should broadcast file_upload_progress event', (done) => {
      const progressData = {
        uploadId: 'upload-123',
        userId: 'user-id',
        user: { id: 'user-id', username: 'testuser' },
        fileName: 'test.jpg',
        progress: 50,
        chatRoomId: 'room-id',
      };

      clientSocket.on('file_upload_progress', (data: any) => {
        expect(data).toMatchObject({
          uploadId: 'upload-123',
          progress: 50,
          fileName: 'test.jpg',
          chatRoomId: expect.any(String),
        });
        done();
      });

      serverSocket.emit('file_upload_progress', progressData);
    });
  });
});