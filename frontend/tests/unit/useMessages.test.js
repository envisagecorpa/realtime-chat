/**
 * Unit test for useMessages composable
 * Tests: message list reactivity, timestamp sorting (FR-008), send, retry
 * Expected to FAIL initially (TDD red phase)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useMessages } from '../../src/composables/useMessages.js';

describe('useMessages', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      sendMessage: vi.fn(),
      loadMessages: vi.fn(),
    };
  });

  it('should initialize with empty messages array', () => {
    const { messages } = useMessages(mockSocket);
    expect(messages.value).toEqual([]);
  });

  it('should add new message to list', () => {
    const { messages, handleNewMessage } = useMessages(mockSocket);

    const newMessage = {
      messageId: 1,
      content: 'Hello',
      username: 'alice',
      timestamp: Date.now(),
    };

    handleNewMessage(newMessage);
    expect(messages.value).toHaveLength(1);
    expect(messages.value[0]).toEqual(newMessage);
  });

  it('should sort messages by timestamp DESC (FR-008)', () => {
    const { messages, handleNewMessage } = useMessages(mockSocket);

    const msg1 = { messageId: 1, content: 'First', timestamp: 1000 };
    const msg2 = { messageId: 2, content: 'Second', timestamp: 2000 };
    const msg3 = { messageId: 3, content: 'Third', timestamp: 1500 };

    handleNewMessage(msg1);
    handleNewMessage(msg2);
    handleNewMessage(msg3);

    // Should be sorted DESC (most recent first)
    expect(messages.value[0].messageId).toBe(2);
    expect(messages.value[1].messageId).toBe(3);
    expect(messages.value[2].messageId).toBe(1);
  });

  it('should send message via socket', () => {
    const { sendMessage } = useMessages(mockSocket);

    sendMessage('Hello, world!');
    expect(mockSocket.sendMessage).toHaveBeenCalledWith('Hello, world!');
  });

  it('should load message history', () => {
    const { loadHistory } = useMessages(mockSocket);

    loadHistory(1, 50);
    expect(mockSocket.loadMessages).toHaveBeenCalledWith(1, 50);
  });

  it('should handle messages_loaded event', () => {
    const { messages } = useMessages(mockSocket);

    const onHandler = mockSocket.on.mock.calls.find(call => call[0] === 'messages_loaded');
    expect(onHandler).toBeDefined();

    const handler = onHandler[1];
    handler({
      messages: [
        { messageId: 1, content: 'Msg 1', timestamp: 1000 },
        { messageId: 2, content: 'Msg 2', timestamp: 2000 },
      ],
    });

    expect(messages.value).toHaveLength(2);
  });

  it('should track message sending status', () => {
    const { sendMessage, sendingMessage } = useMessages(mockSocket);

    expect(sendingMessage.value).toBe(false);

    sendMessage('Test');
    expect(sendingMessage.value).toBe(true);

    // Simulate message_sent
    const onHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message_sent');
    const handler = onHandler[1];
    handler({ messageId: 1, content: 'Test' });

    expect(sendingMessage.value).toBe(false);
  });
});
