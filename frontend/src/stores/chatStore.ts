import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ChatRoom, Message, ChatStore } from '../types';

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    // State
    currentRoom: null,
    rooms: [],
    messages: {},
    onlineUsers: [],
    typingUsers: {},

    // Room actions
    setCurrentRoom: (room: ChatRoom | null) => {
      set({ currentRoom: room });
    },

    setRooms: (rooms: ChatRoom[]) => {
      set({ rooms });
    },

    addRoom: (room: ChatRoom) => {
      set((state) => ({
        rooms: [...state.rooms.filter(r => r.id !== room.id), room],
      }));
    },

    updateRoom: (room: ChatRoom) => {
      set((state) => ({
        rooms: state.rooms.map(r => r.id === room.id ? room : r),
        currentRoom: state.currentRoom?.id === room.id ? room : state.currentRoom,
      }));
    },

    removeRoom: (roomId: string) => {
      set((state) => ({
        rooms: state.rooms.filter(r => r.id !== roomId),
        currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
        messages: Object.fromEntries(
          Object.entries(state.messages).filter(([id]) => id !== roomId)
        ),
      }));
    },

    // Message actions
    setMessages: (roomId: string, messages: Message[]) => {
      set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: messages,
        },
      }));
    },

    addMessage: (message: Message) => {
      set((state) => {
        const roomMessages = state.messages[message.chatRoomId] || [];

        // Check if message already exists (avoid duplicates)
        const existingIndex = roomMessages.findIndex(m => m.id === message.id);
        if (existingIndex !== -1) {
          return state; // Message already exists
        }

        // Add message in chronological order
        const newMessages = [...roomMessages, message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        return {
          messages: {
            ...state.messages,
            [message.chatRoomId]: newMessages,
          },
        };
      });
    },

    updateMessage: (message: Message) => {
      set((state) => {
        const roomMessages = state.messages[message.chatRoomId] || [];
        const updatedMessages = roomMessages.map(m =>
          m.id === message.id ? message : m
        );

        return {
          messages: {
            ...state.messages,
            [message.chatRoomId]: updatedMessages,
          },
        };
      });
    },

    removeMessage: (messageId: string) => {
      set((state) => {
        const newMessages = { ...state.messages };

        // Find and remove message from all rooms
        Object.keys(newMessages).forEach(roomId => {
          newMessages[roomId] = newMessages[roomId].filter(m => m.id !== messageId);
        });

        return { messages: newMessages };
      });
    },

    // Online users actions
    setOnlineUsers: (userIds: string[]) => {
      set({ onlineUsers: userIds });
    },

    addOnlineUser: (userId: string) => {
      set((state) => ({
        onlineUsers: [...new Set([...state.onlineUsers, userId])],
      }));
    },

    removeOnlineUser: (userId: string) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.filter(id => id !== userId),
      }));
    },

    // Typing users actions
    setTypingUsers: (roomId: string, userIds: string[]) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [roomId]: userIds,
        },
      }));
    },

    addTypingUser: (roomId: string, userId: string) => {
      set((state) => {
        const currentTyping = state.typingUsers[roomId] || [];
        const newTyping = [...new Set([...currentTyping, userId])];

        return {
          typingUsers: {
            ...state.typingUsers,
            [roomId]: newTyping,
          },
        };
      });
    },

    removeTypingUser: (roomId: string, userId: string) => {
      set((state) => {
        const currentTyping = state.typingUsers[roomId] || [];
        const newTyping = currentTyping.filter(id => id !== userId);

        return {
          typingUsers: {
            ...state.typingUsers,
            [roomId]: newTyping,
          },
        };
      });
    },
  }))
);

// Derived selectors
export const useCurrentRoomMessages = () => {
  return useChatStore((state) => {
    if (!state.currentRoom) return [];
    return state.messages[state.currentRoom.id] || [];
  });
};

export const useRoomTypingUsers = (roomId: string) => {
  return useChatStore((state) => state.typingUsers[roomId] || []);
};

export const useRoomUnreadCount = (roomId: string) => {
  return useChatStore((state) => {
    const room = state.rooms.find(r => r.id === roomId);
    return room?.unreadCount || 0;
  });
};

export const useTotalUnreadCount = () => {
  return useChatStore((state) => {
    return state.rooms.reduce((total, room) => total + (room.unreadCount || 0), 0);
  });
};

// Auto-cleanup typing indicators
const TYPING_TIMEOUT = 10000; // 10 seconds
const typingTimeouts = new Map<string, NodeJS.Timeout>();

useChatStore.subscribe(
  (state) => state.typingUsers,
  (typingUsers, prevTypingUsers) => {
    Object.entries(typingUsers).forEach(([roomId, userIds]) => {
      const prevUserIds = prevTypingUsers[roomId] || [];

      // Check for new typing users
      userIds.forEach(userId => {
        if (!prevUserIds.includes(userId)) {
          const timeoutKey = `${roomId}:${userId}`;

          // Clear existing timeout
          if (typingTimeouts.has(timeoutKey)) {
            clearTimeout(typingTimeouts.get(timeoutKey)!);
          }

          // Set new timeout to remove typing indicator
          const timeout = setTimeout(() => {
            useChatStore.getState().removeTypingUser(roomId, userId);
            typingTimeouts.delete(timeoutKey);
          }, TYPING_TIMEOUT);

          typingTimeouts.set(timeoutKey, timeout);
        }
      });
    });
  }
);

// Cleanup function for when component unmounts
export const cleanupTypingTimeouts = () => {
  typingTimeouts.forEach(timeout => clearTimeout(timeout));
  typingTimeouts.clear();
};