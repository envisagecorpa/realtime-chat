#!/usr/bin/env node
/**
 * Simple manual test to validate backend is working
 */

const io = require('socket.io-client');

const socket = io('http://localhost:3000', { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('✅ Connected to server');

  socket.emit('authenticate', { username: 'testuser' });
});

socket.on('authenticated', (data) => {
  console.log('✅ Authenticated:', data);

  socket.emit('join_room', { roomName: 'general' });
});

socket.on('room_joined', (data) => {
  console.log('✅ Joined room:', data.roomName);
  console.log('   Users:', data.users);
  console.log('   Messages:', data.messages.length);

  // Send a test message
  socket.emit('send_message', {
    content: 'Test message from simple-test',
    timestamp: Date.now()
  });
});

socket.on('message_sent', (data) => {
  console.log('✅ Message sent confirmation:', data);
  console.log('\nAll tests passed! Disconnecting...\n');
  socket.disconnect();
  process.exit(0);
});

socket.on('new_message', (data) => {
  console.log('✅ New message received:', data);
});

socket.on('error', (err) => {
  console.error('❌ Socket error:', err);
});

socket.on('auth_error', (err) => {
  console.error('❌ Auth error:', err);
  socket.disconnect();
  process.exit(1);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Test timeout after 5 seconds');
  socket.disconnect();
  process.exit(1);
}, 5000);
