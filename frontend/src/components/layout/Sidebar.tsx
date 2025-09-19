import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Settings,
  LogOut,
  MessageCircle,
  Users,
  Hash,
  MoreVertical,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore, useTotalUnreadCount } from '../../stores/chatStore';
import { apiClient } from '../../services/api';
import { RoomList } from '../rooms/RoomList';
import { CreateRoomModal } from '../rooms/CreateRoomModal';
import { SearchModal } from '../search/SearchModal';
import { UserAvatar } from '../ui/UserAvatar';
import { Badge } from '../ui/Badge';
import type { ChatRoom } from '../../types';

interface SidebarProps {
  onShowProfile: () => void;
  isConnected: boolean;
}

export function Sidebar({ onShowProfile, isConnected }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const { rooms, currentRoom, setCurrentRoom } = useChatStore();
  const totalUnreadCount = useTotalUnreadCount();

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<'rooms' | 'users'>('rooms');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter rooms based on search
  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group rooms by type
  const directMessages = filteredRooms.filter((room) => room.type === 'direct');
  const groupChats = filteredRooms.filter((room) => room.type === 'group');
  const publicRooms = filteredRooms.filter((room) => room.type === 'public');

  const handleRoomSelect = (room: ChatRoom) => {
    setCurrentRoom(room);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <UserAvatar user={user!} size="md" onClick={onShowProfile} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.displayName || user?.username}
              </p>
              <div className="flex items-center space-x-1">
                {isConnected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-red-500" />
                )}
                <p className="text-xs text-gray-500">
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowCreateRoom(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              title="Create new room"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
            activeTab === 'rooms'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <MessageCircle className="h-4 w-4" />
            <span>Rooms</span>
            {totalUnreadCount > 0 && (
              <Badge variant="danger" size="sm">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Badge>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
            activeTab === 'users'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Users className="h-4 w-4" />
            <span>People</span>
          </div>
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'rooms' ? (
          <div className="p-2 space-y-4">
            {/* Direct Messages */}
            {directMessages.length > 0 && (
              <div>
                <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Direct Messages
                </h3>
                <RoomList
                  rooms={directMessages}
                  currentRoom={currentRoom}
                  onRoomSelect={handleRoomSelect}
                />
              </div>
            )}

            {/* Group Chats */}
            {groupChats.length > 0 && (
              <div>
                <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Group Chats
                </h3>
                <RoomList
                  rooms={groupChats}
                  currentRoom={currentRoom}
                  onRoomSelect={handleRoomSelect}
                />
              </div>
            )}

            {/* Public Rooms */}
            {publicRooms.length > 0 && (
              <div>
                <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Public Rooms
                </h3>
                <RoomList
                  rooms={publicRooms}
                  currentRoom={currentRoom}
                  onRoomSelect={handleRoomSelect}
                />
              </div>
            )}

            {/* Empty state */}
            {filteredRooms.length === 0 && searchQuery === '' && (
              <div className="text-center py-8">
                <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No rooms yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create a room or join a public room to start chatting.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateRoom(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Room
                  </button>
                </div>
              </div>
            )}

            {/* No search results */}
            {filteredRooms.length === 0 && searchQuery !== '' && (
              <div className="text-center py-8">
                <Search className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No rooms found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try a different search term or create a new room.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-sm text-gray-500">User list coming soon...</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateRoom && (
        <CreateRoomModal
          isOpen={showCreateRoom}
          onClose={() => setShowCreateRoom(false)}
        />
      )}

      {showSearch && (
        <SearchModal
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}