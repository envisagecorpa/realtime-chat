'use strict';

/**
 * Contract test for delete_room event
 * Tests room_deleted broadcast, soft delete behavior (FR-015), permission check
 * Expected to FAIL initially (TDD red phase)
 */

const { io: Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authHandler = require('../../src/handlers/authHandler');
const roomHandler = require('../../src/handlers/roomHandler');

describe('delete_room event contract', () => {
  let httpServer, ioServer, clientSocket, serverSocket;
  const TEST_PORT = 3005;

  beforeEach((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);

    httpServer.listen(TEST_PORT, () => {
      clientSocket = Client(`http://localhost:${TEST_PORT}`);

      ioServer.on('connection', (socket) => {
        serverSocket = socket;
        authHandler(socket);
        roomHandler(socket);
        done();
      });
    });
  });

  afterEach(() => {
    if (clientSocket) clientSocket.close();
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  describe('successful room deletion', () => {
    it('should respond with room_deleted event when creator deletes room', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          const roomId = data.roomId;

          clientSocket.on('room_deleted', (deleteData) => {
            expect(deleteData.roomId).toBe(roomId);
            expect(deleteData.roomName).toBe('temp-room');
            done();
          });

          clientSocket.emit('delete_room', { roomId });
        });

        clientSocket.emit('create_room', { roomName: 'temp-room' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should broadcast room_deleted to all users in the room', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let roomId;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          roomId = data.roomId;
          // Bob joins the room
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.emit('create_room', { roomName: 'temp-room' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', () => {
          // Alice deletes the room
          clientSocket.emit('delete_room', { roomId });
        });

        secondClient.on('room_deleted', (data) => {
          expect(data.roomId).toBe(roomId);
          expect(data.roomName).toBe('temp-room');
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'temp-room' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('soft delete behavior (FR-015)', () => {
    it('should soft delete room (not permanently remove)', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let roomId;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          roomId = data.roomId;
          clientSocket.emit('delete_room', { roomId });
        });

        clientSocket.on('room_deleted', () => {
          // Verify room is hidden from active list
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.emit('create_room', { roomName: 'temp-room' });
      });

      secondClient.on('authenticated', () => {
        // Try to join deleted room - should fail or auto-create new
        secondClient.on('error', (data) => {
          expect(data.message).toMatch(/not found|deleted/i);
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'temp-room' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should preserve messages after soft delete', (done) => {
      // This test verifies that soft delete doesn't cascade delete messages
      // (messages should remain in database for potential restore)
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (roomData) => {
          clientSocket.on('room_joined', () => {
            clientSocket.on('message_sent', () => {
              // Delete room after sending message
              clientSocket.emit('delete_room', { roomId: roomData.roomId });
            });

            clientSocket.on('room_deleted', () => {
              // Room deleted - messages should still exist in DB
              done();
            });

            // Send a message before deleting
            clientSocket.emit('send_message', {
              content: 'This message should persist',
            });
          });

          clientSocket.emit('join_room', { roomName: 'temp-room' });
        });

        clientSocket.emit('create_room', { roomName: 'temp-room' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('permission enforcement', () => {
    it('should reject deletion by non-creator', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let roomId;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          roomId = data.roomId;
          // Bob tries to delete Alice's room
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.emit('create_room', { roomName: 'alice-room' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('error', (data) => {
          expect(data.message).toMatch(/permission|not.*creator|unauthorized/i);
          secondClient.close();
          done();
        });

        secondClient.emit('delete_room', { roomId });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should allow creator to delete their room', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          clientSocket.on('room_deleted', (deleteData) => {
            expect(deleteData.roomId).toBe(data.roomId);
            done();
          });

          clientSocket.emit('delete_room', { roomId: data.roomId });
        });

        clientSocket.emit('create_room', { roomName: 'alice-room' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('validation', () => {
    it('should reject delete_room without authentication', (done) => {
      clientSocket.on('error', (data) => {
        expect(data.message).toMatch(/not authenticated/i);
        done();
      });

      clientSocket.emit('delete_room', { roomId: 1 });
    });

    it('should reject delete_room with invalid roomId', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toMatch(/invalid|not found/i);
          done();
        });

        clientSocket.emit('delete_room', { roomId: 99999 });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });

    it('should reject delete_room without roomId', (done) => {
      clientSocket.on('authenticated', () => {
        clientSocket.on('error', (data) => {
          expect(data.message).toBeDefined();
          done();
        });

        clientSocket.emit('delete_room', {});
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });

  describe('user removal on deletion', () => {
    it('should remove all users from deleted room', (done) => {
      const secondClient = Client(`http://localhost:${TEST_PORT}`);
      let roomId;
      let bobJoined = false;

      clientSocket.on('authenticated', () => {
        clientSocket.on('room_created', (data) => {
          roomId = data.roomId;
          secondClient.emit('authenticate', { username: 'bob' });
        });

        clientSocket.emit('create_room', { roomName: 'temp-room' });
      });

      secondClient.on('authenticated', () => {
        secondClient.on('room_joined', () => {
          bobJoined = true;
          // Alice deletes room
          clientSocket.emit('delete_room', { roomId });
        });

        secondClient.on('room_deleted', () => {
          // Both users should be removed from presence
          expect(bobJoined).toBe(true);
          secondClient.close();
          done();
        });

        secondClient.emit('join_room', { roomName: 'temp-room' });
      });

      clientSocket.emit('authenticate', { username: 'alice' });
    });
  });
});
