import React, { useState } from 'react';
import {
  Hash,
  MessageCircle,
  Users,
  Settings,
  Phone,
  Video,
  Search,
  MoreVertical,
  UserPlus,
  Bell,
  BellOff,
} from 'lucide-react';
import { UserAvatar, UserAvatarGroup } from '../ui/UserAvatar';
import { Badge } from '../ui/Badge';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import type { ChatRoom } from '../../types';

interface ChatHeaderProps {
  room: ChatRoom;
}

export function ChatHeader({ room }: ChatHeaderProps) {
  const { user } = useAuthStore();
  const { onlineUsers } = useChatStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const getRoomIcon = () => {
    switch (room.type) {
      case 'direct':
        return <MessageCircle className="h-5 w-5" />;
      case 'group':
        return <Users className="h-5 w-5" />;
      case 'public':
        return <Hash className="h-5 w-5" />;
      default:
        return <MessageCircle className="h-5 w-5" />;
    }
  };

  const getRoomName = () => {
    if (room.type === 'direct') {
      // For direct messages, show the other participant's name
      const otherParticipant = room.participants?.find(
        (p) => p.user.id !== user?.id
      );
      return otherParticipant?.user.displayName || otherParticipant?.user.username || room.name;
    }
    return room.name;
  };

  const getOnlineParticipants = () => {
    if (!room.participants) return [];
    return room.participants.filter(p => onlineUsers.includes(p.user.id));
  };

  const onlineParticipants = getOnlineParticipants();

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Room info */}
        <div className="flex items-center space-x-3">
          {/* Room icon or avatar */}
          {room.type === 'direct' && room.participants?.[0] ? (
            <UserAvatar
              user={room.participants.find(p => p.user.id !== user?.id)?.user || room.participants[0].user}
              size="md"
              showOnlineStatus
            />
          ) : (
            <div className={`
              flex items-center justify-center h-10 w-10 rounded-lg
              ${room.type === 'public' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}
            `}>
              {getRoomIcon()}
            </div>
          )}

          {/* Room details */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold text-gray-900">
                {getRoomName()}
              </h1>
              {room.type === 'public' && (
                <Badge variant="success" size="sm">
                  Public
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-500">
              {/* Participant count and online status */}
              {room.type !== 'direct' && (
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{room.participantCount} members</span>
                  {onlineParticipants.length > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                        <span>{onlineParticipants.length} online</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Direct message status */}
              {room.type === 'direct' && (
                <div className="flex items-center space-x-1">
                  <div className={`h-2 w-2 rounded-full ${
                    onlineParticipants.length > 0 ? 'bg-green-400' : 'bg-gray-300'
                  }`}></div>
                  <span>{onlineParticipants.length > 0 ? 'Online' : 'Offline'}</span>
                </div>
              )}

              {/* Room description */}
              {room.description && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-xs">{room.description}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-2">
          {/* Online participants avatars */}
          {room.type !== 'direct' && onlineParticipants.length > 0 && (
            <UserAvatarGroup
              users={onlineParticipants.map(p => p.user)}
              max={4}
              size="sm"
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center space-x-1">
            <button
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              title="Search in conversation"
            >
              <Search className="h-4 w-4" />
            </button>

            {room.type === 'direct' && (
              <>
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                  title="Voice call"
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                  title="Video call"
                >
                  <Video className="h-4 w-4" />
                </button>
              </>
            )}

            {room.type !== 'direct' && room.canManage && (
              <button
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                title="Add members"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}

            {/* More options dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Bell className="h-4 w-4 mr-3" />
                      Mute notifications
                    </button>
                    <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Users className="h-4 w-4 mr-3" />
                      View members
                    </button>
                    {room.canManage && (
                      <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <Settings className="h-4 w-4 mr-3" />
                        Room settings
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Dropdown backdrop */}
              {showDropdown && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => setShowDropdown(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}