import React, { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, MessageCircle, Users, Settings, Phone, Video } from 'lucide-react';
import { useChatStore, useCurrentRoomMessages } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../services/api';
import { socketService } from '../../services/socket';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { EmptyState } from '../ui/EmptyState';
import type { MessageType, FileAttachment } from '../../types';

export function ChatArea() {
  const { currentRoom, setMessages } = useChatStore();
  const { user } = useAuthStore();
  const messages = useCurrentRoomMessages();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages for current room
  const {
    data: messageResult,
    isLoading: messagesLoading,
    error: messagesError,
  } = useQuery({
    queryKey: ['messages', currentRoom?.id],
    queryFn: () => apiClient.getRoomMessages(currentRoom!.id),
    enabled: !!currentRoom,
    staleTime: 1000 * 60, // 1 minute
  });

  // Update messages in store when data changes
  useEffect(() => {
    if (currentRoom && messageResult?.messages) {
      setMessages(currentRoom.id, messageResult.messages);
    }
  }, [currentRoom, messageResult, setMessages]);

  // Join room via socket when current room changes
  useEffect(() => {
    if (currentRoom && socketService.isConnected()) {
      socketService.joinRoom(currentRoom.id).catch(console.error);

      return () => {
        socketService.leaveRoom(currentRoom.id).catch(console.error);
      };
    }
  }, [currentRoom]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Mark messages as read when room is active
  useEffect(() => {
    if (currentRoom && messages.length > 0 && user) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.senderId !== user.id) {
        apiClient.markMessageAsRead(lastMessage.id).catch(console.error);
      }
    }
  }, [currentRoom, messages, user]);

  if (!currentRoom) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Welcome to RealTime Chat"
        description="Select a room from the sidebar to start chatting, or create a new room to get started."
      />
    );
  }

  if (messagesLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading messages..." />
      </div>
    );
  }

  if (messagesError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">Failed to load messages</div>
          <button
            onClick={() => queryClient.invalidateQueries(['messages', currentRoom.id])}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Chat header */}
      <ChatHeader room={currentRoom} />

      {/* Messages area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={currentRoom.type === 'direct' ? MessageCircle : Hash}
              title={`Welcome to ${currentRoom.name}`}
              description={
                currentRoom.type === 'direct'
                  ? 'Start a conversation!'
                  : 'Be the first to send a message in this room.'
              }
            />
          ) : (
            <MessageList messages={messages} currentUser={user!} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="border-t border-gray-200">
          <MessageInput
            room={currentRoom}
            onSendMessage={(content, messageType, parentMessageId, attachments) => {
              return socketService.sendMessage({
                roomId: currentRoom.id,
                content,
                messageType,
                parentMessageId,
                attachmentIds: attachments?.map(a => a.id),
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}