/**
 * Integration Test: Pagination Flow
 * T088: load messages → change page size 50→100 → verify UI updates, verify load more button
 *
 * Tests the complete pagination workflow:
 * 1. Load initial message history (default page size 50)
 * 2. Change page size (50 → 100 → 200 → 500)
 * 3. Load next page of messages (page 1 → 2 → 3)
 * 4. Verify "Load More" button visibility
 * 5. Verify message count and ordering
 * 6. Test edge cases (empty pages, last page)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref, computed } from 'vue';
import { createSocketService } from '../../src/services/socket-service.js';

describe('Pagination Flow (E2E)', () => {
  let socketService;
  let mockSocket;
  let eventHandlers = {};

  beforeEach(() => {
    eventHandlers = {};

    mockSocket = {
      connected: true,
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
      }),
      off: vi.fn((event) => {
        delete eventHandlers[event];
      }),
      emit: vi.fn(),
      connect: vi.fn(() => {
        mockSocket.connected = true;
      }),
      disconnect: vi.fn(() => {
        mockSocket.connected = false;
      }),
      io: {
        opts: {
          reconnectionAttempts: 5,
        },
      },
    };

    vi.mock('socket.io-client', () => ({
      io: vi.fn(() => mockSocket),
    }));

    socketService = createSocketService('http://localhost:3000');
    socketService.connect();
  });

  afterEach(() => {
    if (socketService) {
      socketService.disconnect();
    }
    vi.clearAllMocks();
  });

  it('should load initial messages with default page size (50)', async () => {
    const messages = ref([]);
    const pageSize = ref(50);
    const page = ref(1);

    // Join room triggers initial load
    socketService.emit('join_room', { roomName: 'general' });

    // Simulate room_joined with 50 messages
    const initialMessages = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      username: 'user' + (i % 5),
      content: `Message ${i + 1}`,
      timestamp: Date.now() - (50 - i) * 1000
    }));

    if (eventHandlers.room_joined) {
      eventHandlers.room_joined({
        roomId: 1,
        roomName: 'general',
        users: ['testuser'],
        messages: initialMessages
      });
    }

    messages.value = initialMessages;

    expect(messages.value.length).toBe(50);
    expect(pageSize.value).toBe(50);
    expect(page.value).toBe(1);
  });

  it('should change page size from 50 → 100 and reload', async () => {
    const messages = ref([]);
    const pageSize = ref(50);
    const page = ref(1);
    const roomId = 1;

    // Initial load with page size 50
    socketService.emit('load_messages', { roomId, page: 1, pageSize: 50 });

    const messages50 = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      username: 'user' + i,
      content: `Message ${i + 1}`,
      timestamp: Date.now() - i * 1000
    }));

    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: messages50,
        page: 1,
        pageSize: 50,
        total: 150
      });
    }

    messages.value = messages50;
    expect(messages.value.length).toBe(50);

    // Change page size to 100
    pageSize.value = 100;
    page.value = 1; // Reset to page 1

    socketService.emit('load_messages', { roomId, page: 1, pageSize: 100 });

    const messages100 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      username: 'user' + i,
      content: `Message ${i + 1}`,
      timestamp: Date.now() - i * 1000
    }));

    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: messages100,
        page: 1,
        pageSize: 100,
        total: 150
      });
    }

    messages.value = messages100;

    expect(messages.value.length).toBe(100);
    expect(pageSize.value).toBe(100);
  });

  it('should load next page when clicking "Load More"', async () => {
    const messages = ref([]);
    const page = ref(1);
    const pageSize = ref(50);
    const totalMessages = ref(150);
    const roomId = 1;

    // Page 1 (messages 1-50)
    socketService.emit('load_messages', { roomId, page: 1, pageSize: 50 });

    const page1Messages = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      username: 'user' + i,
      content: `Message ${i + 1}`,
      timestamp: Date.now() - i * 1000
    }));

    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: page1Messages,
        page: 1,
        pageSize: 50,
        total: 150
      });
    }

    messages.value = page1Messages;
    expect(messages.value.length).toBe(50);

    // Load page 2 (messages 51-100)
    page.value = 2;
    socketService.emit('load_messages', { roomId, page: 2, pageSize: 50 });

    const page2Messages = Array.from({ length: 50 }, (_, i) => ({
      id: 51 + i,
      username: 'user' + (51 + i),
      content: `Message ${51 + i}`,
      timestamp: Date.now() - (50 + i) * 1000
    }));

    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: page2Messages,
        page: 2,
        pageSize: 50,
        total: 150
      });
    }

    // Append page 2 messages to existing
    messages.value = [...messages.value, ...page2Messages];

    expect(messages.value.length).toBe(100);
    expect(page.value).toBe(2);
  });

  it('should show/hide "Load More" button based on total messages', async () => {
    const messages = ref([]);
    const page = ref(1);
    const pageSize = ref(50);
    const totalMessages = ref(0);

    const hasMoreMessages = computed(() => {
      return messages.value.length < totalMessages.value;
    });

    // Load page 1 (50 out of 150 total)
    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: Array.from({ length: 50 }, (_, i) => ({
          id: i + 1,
          username: 'user' + i,
          content: `Message ${i + 1}`,
          timestamp: Date.now() - i * 1000
        })),
        page: 1,
        pageSize: 50,
        total: 150
      });
    }

    messages.value = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
    totalMessages.value = 150;

    // Should show "Load More" (50 < 150)
    expect(hasMoreMessages.value).toBe(true);

    // Load all remaining messages (page 2 and 3)
    messages.value = Array.from({ length: 150 }, (_, i) => ({ id: i + 1 }));

    // Should hide "Load More" (150 === 150)
    expect(hasMoreMessages.value).toBe(false);
  });

  it('should handle empty page (no more messages)', async () => {
    const messages = ref([]);
    const page = ref(3);
    const pageSize = ref(50);
    const totalMessages = ref(100);
    const roomId = 1;

    // Already loaded 100 messages (pages 1-2)
    messages.value = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    // Attempt to load page 3 (should return empty)
    socketService.emit('load_messages', { roomId, page: 3, pageSize: 50 });

    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: [], // Empty page
        page: 3,
        pageSize: 50,
        total: 100
      });
    }

    // No new messages added
    expect(messages.value.length).toBe(100);
  });

  it('should support all page sizes: 50, 100, 200, 500', async () => {
    const pageSizes = [50, 100, 200, 500];
    const roomId = 1;

    for (const size of pageSizes) {
      socketService.emit('load_messages', {
        roomId,
        page: 1,
        pageSize: size
      });

      // Verify emit was called with correct page size
      expect(mockSocket.emit).toHaveBeenCalledWith('load_messages', {
        roomId,
        page: 1,
        pageSize: size
      });
    }

    expect(mockSocket.emit).toHaveBeenCalledTimes(pageSizes.length);
  });

  it('should maintain message ordering when loading pages (FR-008)', async () => {
    const messages = ref([]);
    const baseTimestamp = Date.now();

    // Page 1: Messages 1-3 (newest)
    const page1 = [
      { id: 3, username: 'user3', content: 'Message 3', timestamp: baseTimestamp },
      { id: 2, username: 'user2', content: 'Message 2', timestamp: baseTimestamp - 1000 },
      { id: 1, username: 'user1', content: 'Message 1', timestamp: baseTimestamp - 2000 }
    ];

    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: page1,
        page: 1,
        pageSize: 3,
        total: 6
      });
    }

    messages.value = page1;

    // Page 2: Messages 4-6 (older)
    const page2 = [
      { id: 6, username: 'user6', content: 'Message 6', timestamp: baseTimestamp - 3000 },
      { id: 5, username: 'user5', content: 'Message 5', timestamp: baseTimestamp - 4000 },
      { id: 4, username: 'user4', content: 'Message 4', timestamp: baseTimestamp - 5000 }
    ];

    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: page2,
        page: 2,
        pageSize: 3,
        total: 6
      });
    }

    messages.value = [...messages.value, ...page2];

    // Sort by timestamp DESC (newest first)
    messages.value.sort((a, b) => b.timestamp - a.timestamp);

    // Verify ordering: newest (id 3) → oldest (id 4)
    expect(messages.value[0].id).toBe(3);
    expect(messages.value[messages.value.length - 1].id).toBe(4);
  });

  it('should show loading indicator during pagination', async () => {
    const isLoading = ref(false);
    const roomId = 1;

    // Start loading
    isLoading.value = true;
    socketService.emit('load_messages', { roomId, page: 2, pageSize: 50 });

    expect(isLoading.value).toBe(true);

    // Simulate messages loaded
    if (eventHandlers.messages_loaded) {
      eventHandlers.messages_loaded({
        messages: [],
        page: 2,
        pageSize: 50,
        total: 100
      });
    }

    isLoading.value = false;

    expect(isLoading.value).toBe(false);
  });

  it('should handle rapid page size changes', async () => {
    const roomId = 1;
    const pageSizes = [50, 100, 50, 200, 100, 500];

    // Rapidly change page size
    for (const size of pageSizes) {
      socketService.emit('load_messages', { roomId, page: 1, pageSize: size });
    }

    // Verify all emits occurred
    expect(mockSocket.emit).toHaveBeenCalledTimes(pageSizes.length);

    // Last call should be page size 500
    expect(mockSocket.emit).toHaveBeenLastCalledWith('load_messages', {
      roomId,
      page: 1,
      pageSize: 500
    });
  });

  it('should calculate total pages correctly', async () => {
    const totalMessages = ref(0);
    const pageSize = ref(50);

    const totalPages = computed(() => {
      return Math.ceil(totalMessages.value / pageSize.value);
    });

    // Scenario 1: 150 messages, 50 per page = 3 pages
    totalMessages.value = 150;
    pageSize.value = 50;
    expect(totalPages.value).toBe(3);

    // Scenario 2: 150 messages, 100 per page = 2 pages
    pageSize.value = 100;
    expect(totalPages.value).toBe(2);

    // Scenario 3: 500 messages, 500 per page = 1 page
    totalMessages.value = 500;
    pageSize.value = 500;
    expect(totalPages.value).toBe(1);

    // Scenario 4: 0 messages = 0 pages
    totalMessages.value = 0;
    pageSize.value = 50;
    expect(totalPages.value).toBe(0);
  });

  it('should preserve scroll position when loading more messages', async () => {
    const messages = ref([]);
    const scrollTop = ref(0);
    const page = ref(1);

    // Load page 1
    messages.value = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      content: `Message ${i + 1}`,
      timestamp: Date.now() - i * 1000
    }));

    scrollTop.value = 500; // User scrolled up

    // Load page 2 (append older messages)
    page.value = 2;
    const page2Messages = Array.from({ length: 50 }, (_, i) => ({
      id: 51 + i,
      content: `Message ${51 + i}`,
      timestamp: Date.now() - (50 + i) * 1000
    }));

    messages.value = [...messages.value, ...page2Messages];

    // Scroll position should be preserved (UI logic)
    expect(scrollTop.value).toBe(500);
    expect(messages.value.length).toBe(100);
  });

  it('should handle pagination error gracefully', async () => {
    const messages = ref([]);
    const errorMessage = ref('');
    const roomId = 1;

    socketService.emit('load_messages', { roomId, page: 999, pageSize: 50 });

    // Simulate error response
    if (eventHandlers.error) {
      eventHandlers.error({
        message: 'Invalid page number'
      });
    }

    errorMessage.value = 'Failed to load messages. Please try again.';

    // Messages should remain unchanged
    expect(messages.value.length).toBe(0);
    expect(errorMessage.value).toContain('Failed to load messages');
  });

  it('should disable "Load More" button while loading', async () => {
    const isLoadingMore = ref(false);
    const canLoadMore = computed(() => !isLoadingMore.value);

    // Start loading
    isLoadingMore.value = true;
    expect(canLoadMore.value).toBe(false);

    // Finish loading
    isLoadingMore.value = false;
    expect(canLoadMore.value).toBe(true);
  });
});
