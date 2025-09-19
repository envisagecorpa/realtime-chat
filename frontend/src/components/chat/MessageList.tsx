import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Reply, Edit, Trash2, MoreHorizontal, Flag } from 'lucide-react';
import { clsx } from 'clsx';
import { UserAvatar } from '../ui/UserAvatar';
import { socketService } from '../../services/socket';
import type { Message, User } from '../../types';

interface MessageListProps {
  messages: Message[];
  currentUser: User;
  onReply?: (message: Message) => void;
}

export function MessageList({ messages, currentUser, onReply }: MessageListProps) {
  // Group messages by date
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach((message) => {
      const messageDate = format(new Date(message.createdAt), 'yyyy-MM-dd');

      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({
          date: messageDate,
          messages: [message],
        });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  }, [messages]);

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  return (
    <div className="space-y-4">
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center justify-center py-2">
            <div className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
              {formatDateSeparator(group.date)}
            </div>
          </div>

          {/* Messages for this date */}
          <div className="space-y-4">
            {group.messages.map((message, index) => {
              const isConsecutive =
                index > 0 &&
                group.messages[index - 1].senderId === message.senderId &&
                new Date(message.createdAt).getTime() -
                  new Date(group.messages[index - 1].createdAt).getTime() <
                  5 * 60 * 1000; // 5 minutes

              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  currentUser={currentUser}
                  isConsecutive={isConsecutive}
                  onReply={onReply}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  currentUser: User;
  isConsecutive: boolean;
  onReply?: (message: Message) => void;
}

function MessageItem({ message, currentUser, isConsecutive, onReply }: MessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isOwnMessage = message.senderId === currentUser.id;
  const isSystemMessage = message.messageType === 'system';

  const handleEdit = async () => {
    if (editContent.trim() === message.content.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      await socketService.editMessage(message.id, editContent.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit message:', error);
      setEditContent(message.content); // Revert on error
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await socketService.deleteMessage(message.id);
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    }
  };

  const handleFlag = () => {
    // TODO: Implement message flagging
    console.log('Flag message:', message.id);
  };

  const formatTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  if (isSystemMessage) {
    return (
      <div className="flex justify-center py-1">
        <div className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'group flex space-x-3 hover:bg-gray-50 px-2 py-1 rounded-md transition-colors',
        isConsecutive && 'mt-1'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDropdown(false);
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isConsecutive ? (
          <div className="w-8 h-8 flex items-center justify-center">
            {isHovered && (
              <span className="text-xs text-gray-400">
                {formatTime(new Date(message.createdAt))}
              </span>
            )}
          </div>
        ) : (
          <UserAvatar user={message.sender} size="sm" />
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {!isConsecutive && (
          <div className="flex items-baseline space-x-2 mb-1">
            <span className="text-sm font-medium text-gray-900">
              {message.sender.displayName || message.sender.username}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(new Date(message.createdAt))}
            </span>
            {message.editedAt && (
              <span className="text-xs text-gray-400">(edited)</span>
            )}
          </div>
        )}

        {/* Message text */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditContent(message.content);
                }
              }}
              autoFocus
            />
            <div className="flex space-x-2 text-xs">
              <button
                onClick={handleEdit}
                className="text-blue-600 hover:text-blue-800"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="border border-gray-200 rounded p-2 text-sm hover:bg-gray-50 cursor-pointer"
                onClick={() => window.open(attachment.fileUrl, '_blank')}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-blue-600">{attachment.originalName}</span>
                  <span className="text-gray-500">
                    ({attachment.formattedSize || `${Math.round(attachment.fileSize / 1024)}KB`})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Read status */}
        {isOwnMessage && message.readStatus && message.readStatus.length > 0 && (
          <div className="mt-1 text-xs text-gray-400">
            Read by {message.readStatus.filter(rs => rs.deliveryStatus === 'read').length} people
          </div>
        )}
      </div>

      {/* Message actions */}
      {(isHovered || showDropdown) && !isEditing && (
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onReply?.(message)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
            title="Reply"
          >
            <Reply className="h-4 w-4" />
          </button>

          {isOwnMessage && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  {!isOwnMessage && (
                    <button
                      onClick={handleFlag}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Flag className="h-3 w-3 mr-2" />
                      Flag
                    </button>
                  )}
                  {(isOwnMessage || currentUser.role === 'moderator') && (
                    <button
                      onClick={handleDelete}
                      className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}