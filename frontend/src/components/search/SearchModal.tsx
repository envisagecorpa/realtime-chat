import React, { useState, useCallback, useEffect } from 'react';
import { Search, Hash, User, MessageCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { UserAvatar } from '../ui/UserAvatar';
import { apiClient } from '../../services/api';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import type { Message, ChatRoom, User as UserType } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResults {
  messages: Message[];
  rooms: ChatRoom[];
  users: UserType[];
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const { setCurrentRoom } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'rooms' | 'people'>('all');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, activeTab],
    queryFn: async (): Promise<SearchResults> => {
      if (!debouncedQuery.trim()) {
        return { messages: [], rooms: [], users: [] };
      }

      const results = await apiClient.searchEverything({
        query: debouncedQuery,
        type: activeTab === 'all' ? undefined : activeTab === 'people' ? 'users' : activeTab,
        limit: 20,
      });

      return {
        messages: results.messages || [],
        rooms: results.rooms || [],
        users: results.users || [],
      };
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  const handleRoomClick = (room: ChatRoom) => {
    setCurrentRoom(room);
    onClose();
  };

  const handleMessageClick = (message: Message) => {
    // Navigate to the room containing this message
    if (message.roomId) {
      // TODO: Navigate to specific message in room
      onClose();
    }
  };

  const formatMessagePreview = (content: string, maxLength = 100) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  const formatTime = (date: string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 168) { // 7 days
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const tabs = [
    { key: 'all', label: 'All', icon: Search },
    { key: 'messages', label: 'Messages', icon: MessageCircle },
    { key: 'rooms', label: 'Rooms', icon: Hash },
    { key: 'people', label: 'People', icon: User },
  ] as const;

  const getResultsForTab = () => {
    if (!searchResults) return { messages: [], rooms: [], users: [] };

    switch (activeTab) {
      case 'messages':
        return { messages: searchResults.messages, rooms: [], users: [] };
      case 'rooms':
        return { messages: [], rooms: searchResults.rooms, users: [] };
      case 'people':
        return { messages: [], rooms: [], users: searchResults.users };
      default:
        return searchResults;
    }
  };

  const results = getResultsForTab();
  const hasResults = results.messages.length > 0 || results.rooms.length > 0 || results.users.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search" size="lg">
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Search messages, rooms, or people..."
            autoFocus
          />
        </div>

        {/* Filter tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-colors
                ${activeTab === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Search results */}
        <div className="min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Searching..." />
            </div>
          ) : !searchQuery.trim() ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Search everything</h3>
              <p className="mt-1 text-sm text-gray-500">
                Find messages, rooms, and people across your chat history.
              </p>
            </div>
          ) : !hasResults ? (
            <div className="text-center py-12">
              <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try different keywords or check your spelling.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Messages */}
              {results.messages.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Messages</h4>
                  )}
                  <div className="space-y-2">
                    {results.messages.map((message) => (
                      <div
                        key={message.id}
                        onClick={() => handleMessageClick(message)}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start space-x-3">
                          <UserAvatar user={message.sender} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                {message.sender.displayName || message.sender.username}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">
                              {formatMessagePreview(message.content)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rooms */}
              {results.rooms.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Rooms</h4>
                  )}
                  <div className="space-y-2">
                    {results.rooms.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => handleRoomClick(room)}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {room.type === 'public' ? (
                              <Hash className="h-6 w-6 text-gray-400" />
                            ) : (
                              <MessageCircle className="h-6 w-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {room.name}
                            </p>
                            {room.description && (
                              <p className="text-sm text-gray-500 truncate">
                                {room.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              {room.participantCount} members
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users */}
              {results.users.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h4 className="text-sm font-medium text-gray-900 mb-2">People</h4>
                  )}
                  <div className="space-y-2">
                    {results.users.map((user) => (
                      <div
                        key={user.id}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <UserAvatar user={user} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {user.displayName || user.username}
                            </p>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                            {user.status && (
                              <p className="text-xs text-gray-400">{user.status}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}