import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Smile, AtSign, Hash } from 'lucide-react';
import { socketService } from '../../services/socket';
import { useAuthStore } from '../../stores/authStore';
import { FileUpload, FileAttachmentDisplay } from './FileUpload';
import type { ChatRoom, MessageType, FileAttachment } from '../../types';

interface MessageInputProps {
  room: ChatRoom;
  onSendMessage: (content: string, messageType?: MessageType, parentMessageId?: string, attachments?: FileAttachment[]) => Promise<any>;
  replyTo?: { id: string; content: string; senderName: string };
  onCancelReply?: () => void;
}

export function MessageInput({ room, onSendMessage, replyTo, onCancelReply }: MessageInputProps) {
  const { user } = useAuthStore();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (!isTyping && message.trim()) {
      setIsTyping(true);
      socketService.startTypingIndicator(room.id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socketService.stopTypingIndicator(room.id);
      }
    }, 1000);
  }, [isTyping, message, room.id]);

  // Stop typing when component unmounts
  useEffect(() => {
    return () => {
      if (isTyping) {
        socketService.stopTypingIndicator(room.id);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isTyping, room.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();
    if ((!trimmedMessage && attachments.length === 0) || isSending) return;

    try {
      setIsSending(true);

      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        socketService.stopTypingIndicator(room.id);
      }

      // Send message
      await onSendMessage(
        trimmedMessage || '',
        attachments.length > 0 ? 'file' : 'text',
        replyTo?.id,
        attachments.length > 0 ? attachments : undefined
      );

      // Clear input
      setMessage('');
      setAttachments([]);
      setShowFileUpload(false);
      onCancelReply?.();

      // Focus back on input
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: Show error toast
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape' && replyTo) {
      onCancelReply?.();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicators
    if (value.trim()) {
      handleTyping();
    } else if (isTyping) {
      setIsTyping(false);
      socketService.stopTypingIndicator(room.id);
    }
  };

  const handleFileUpload = () => {
    setShowFileUpload(!showFileUpload);
  };

  const handleFilesUploaded = (newAttachments: FileAttachment[]) => {
    setAttachments(prev => [...prev, ...newAttachments]);
    setShowFileUpload(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const isDisabled = !room.isActive || isSending;

  return (
    <div className="px-4 py-3">
      {/* Reply indicator */}
      {replyTo && (
        <div className="mb-2 p-2 bg-gray-50 border-l-4 border-blue-500 rounded">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600">
                Replying to {replyTo.senderName}
              </p>
              <p className="text-sm text-gray-800 truncate">{replyTo.content}</p>
            </div>
            <button
              onClick={onCancelReply}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* File attachments */}
      {attachments.length > 0 && (
        <div className="mb-3 space-y-2">
          {attachments.map((attachment, index) => (
            <FileAttachmentDisplay
              key={attachment.id}
              attachment={attachment}
              onRemove={() => removeAttachment(index)}
              showRemove
            />
          ))}
        </div>
      )}

      {/* File upload area */}
      {showFileUpload && (
        <div className="mb-3">
          <FileUpload
            onFilesUploaded={handleFilesUploaded}
            maxFiles={3}
            disabled={isDisabled}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        {/* File upload button */}
        <button
          type="button"
          onClick={handleFileUpload}
          disabled={isDisabled}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          title="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Message input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isDisabled
                ? 'This room is locked'
                : `Message ${room.type === 'direct' ? 'directly' : `#${room.name}`}...`
            }
            disabled={isDisabled}
            className="w-full resize-none border border-gray-300 rounded-lg px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={1}
            maxLength={2000}
          />

          {/* Character count */}
          {message.length > 1800 && (
            <div className="absolute bottom-1 right-1 text-xs text-gray-500">
              {message.length}/2000
            </div>
          )}
        </div>

        {/* Emoji button */}
        <button
          type="button"
          disabled={isDisabled}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add emoji"
        >
          <Smile className="h-5 w-5" />
        </button>

        {/* Send button */}
        <button
          type="submit"
          disabled={(!message.trim() && attachments.length === 0) || isDisabled}
          className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 transition-colors"
          title="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      {/* Formatting hints */}
      <div className="mt-2 text-xs text-gray-500">
        <span>
          Press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Enter</kbd> to send,{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded">Shift+Enter</kbd> for new line
        </span>
        {replyTo && (
          <span className="ml-4">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> to cancel reply
          </span>
        )}
      </div>
    </div>
  );
}