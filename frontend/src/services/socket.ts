import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import type { SocketEvents, SocketResponse, Message, PresenceStatus } from '../types';

// Socket configuration
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const serverUrl = SOCKET_URL;

      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      });

      this.setupEventListeners();

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    const chatStore = useChatStore.getState();

    // Connection events
    this.socket.on('connected', (data: SocketEvents['connected']) => {
      console.log('Socket connected:', data);
    });

    this.socket.on('error', (data: SocketEvents['error']) => {
      console.error('Socket error:', data);
    });

    // Message events
    this.socket.on('new_message', (message: SocketEvents['new_message']) => {
      chatStore.addMessage(message);
    });

    this.socket.on('message_edited', (data: SocketEvents['message_edited']) => {
      // Find and update the message
      const messages = chatStore.messages[chatStore.currentRoom?.id || ''] || [];
      const messageIndex = messages.findIndex(m => m.id === data.id);
      if (messageIndex !== -1) {
        const updatedMessage = {
          ...messages[messageIndex],
          content: data.content,
          editedAt: data.editedAt,
        };
        chatStore.updateMessage(updatedMessage);
      }
    });

    this.socket.on('message_deleted', (data: SocketEvents['message_deleted']) => {
      chatStore.removeMessage(data.messageId);
    });

    this.socket.on('message_read', (data: SocketEvents['message_read']) => {
      // Update read status for the message
      console.log('Message read:', data);
    });

    // Room events
    this.socket.on('user_joined_room', (data: SocketEvents['user_joined_room']) => {
      console.log('User joined room:', data);
      // Update room participant count or show notification
    });

    this.socket.on('user_left_room', (data: SocketEvents['user_left_room']) => {
      console.log('User left room:', data);
      // Update room participant count or show notification
    });

    // Presence events
    this.socket.on('user_typing', (data: SocketEvents['user_typing']) => {
      if (data.isTyping) {
        chatStore.addTypingUser(data.roomId, data.userId);
      } else {
        chatStore.removeTypingUser(data.roomId, data.userId);
      }
    });

    this.socket.on('presence_change', (data: SocketEvents['presence_change']) => {
      if (data.status === 'online') {
        chatStore.addOnlineUser(data.userId);
      } else {
        chatStore.removeOnlineUser(data.userId);
      }
    });
  }

  // Message operations
  async sendMessage(
    chatRoomId: string,
    content: string,
    messageType = 'text',
    parentMessageId?: string
  ): Promise<{ messageId: string }> {
    return this.emit('send_message', {
      chatRoomId,
      content,
      messageType,
      parentMessageId,
    });
  }

  async editMessage(messageId: string, content: string): Promise<{ messageId: string }> {
    return this.emit('edit_message', { messageId, content });
  }

  async deleteMessage(messageId: string): Promise<{ messageId: string }> {
    return this.emit('delete_message', { messageId });
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    return this.emit('mark_read', { messageId });
  }

  // Room operations
  async joinRoom(chatRoomId: string): Promise<{ roomId: string }> {
    return this.emit('join_room', { chatRoomId });
  }

  async leaveRoom(chatRoomId: string): Promise<{ roomId: string }> {
    return this.emit('leave_room', { chatRoomId });
  }

  // Typing indicators
  async startTyping(chatRoomId: string): Promise<void> {
    return this.emit('typing_start', { chatRoomId });
  }

  async stopTyping(chatRoomId: string): Promise<void> {
    return this.emit('typing_stop', { chatRoomId });
  }

  // Presence updates
  async updatePresence(status: PresenceStatus): Promise<{ status: PresenceStatus }> {
    return this.emit('presence_update', { status });
  }

  // Heartbeat
  async sendHeartbeat(): Promise<{ timestamp: string }> {
    return this.emit('heartbeat', {});
  }

  // Generic emit with promise support
  private emit<T = any>(event: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(event, data, (response: SocketResponse<T>) => {
        if (response.success) {
          resolve(response.data!);
        } else {
          reject(new Error(response.error?.message || 'Socket operation failed'));
        }
      });
    });
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Typing management with auto-cleanup
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  startTypingIndicator(roomId: string): void {
    // Clear existing timeout for this room
    const existingTimeout = this.typingTimeouts.get(roomId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Start typing
    this.startTyping(roomId).catch(console.error);

    // Set timeout to stop typing after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      this.stopTyping(roomId).catch(console.error);
      this.typingTimeouts.delete(roomId);
    }, 3000);

    this.typingTimeouts.set(roomId, timeout);
  }

  stopTypingIndicator(roomId: string): void {
    const timeout = this.typingTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(roomId);
    }
    this.stopTyping(roomId).catch(console.error);
  }

  // Heartbeat management
  private heartbeatInterval: NodeJS.Timeout | null = null;

  startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat().catch(console.error);
    }, 30000); // Send heartbeat every 30 seconds
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Connection state management
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    if (!this.socket) return () => {};

    const connectHandler = () => callback(true);
    const disconnectHandler = () => callback(false);

    this.socket.on('connect', connectHandler);
    this.socket.on('disconnect', disconnectHandler);

    // Return cleanup function
    return () => {
      this.socket?.off('connect', connectHandler);
      this.socket?.off('disconnect', disconnectHandler);
    };
  }

  // Auto-reconnection with exponential backoff
  private setupAutoReconnect(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        this.reconnectWithBackoff();
      }
    });

    this.socket.on('connect_error', () => {
      this.reconnectWithBackoff();
    });
  }

  private async reconnectWithBackoff(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      const token = useAuthStore.getState().token;
      if (token) {
        this.connect(token).catch(console.error);
      }
    }, delay);
  }
}

export const socketService = new SocketService();
export default socketService;