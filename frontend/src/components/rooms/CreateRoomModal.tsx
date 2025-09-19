import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Hash, Users, Globe, Lock } from 'lucide-react';
import { apiClient } from '../../services/api';
import { useChatStore } from '../../stores/chatStore';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { CreateRoomForm, RoomType } from '../../types';

const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(100, 'Room name cannot exceed 100 characters'),
  type: z.enum(['group', 'public']),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
  maxParticipants: z
    .number()
    .min(2, 'Minimum 2 participants')
    .max(500, 'Maximum 500 participants')
    .optional(),
});

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const queryClient = useQueryClient();
  const { addRoom, setCurrentRoom } = useChatStore();
  const [selectedType, setSelectedType] = useState<RoomType>('group');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      type: 'group',
      maxParticipants: 50,
    },
  });

  const roomType = watch('type');

  const createRoomMutation = useMutation({
    mutationFn: (data: CreateRoomForm) => apiClient.createRoom(data),
    onSuccess: (newRoom) => {
      // Update cache and store
      queryClient.invalidateQueries(['rooms']);
      addRoom(newRoom);
      setCurrentRoom(newRoom);

      // Close modal and reset form
      onClose();
      reset();
    },
    onError: (error: any) => {
      console.error('Failed to create room:', error);
      // TODO: Show error toast
    },
  });

  const onSubmit = (data: CreateRoomForm) => {
    createRoomMutation.mutate({
      ...data,
      description: data.description || undefined,
    });
  };

  const handleClose = () => {
    if (!createRoomMutation.isPending) {
      onClose();
      reset();
    }
  };

  const roomTypes = [
    {
      type: 'group' as const,
      icon: Users,
      title: 'Group Chat',
      description: 'Private group chat with invited members only',
    },
    {
      type: 'public' as const,
      icon: Globe,
      title: 'Public Room',
      description: 'Anyone can discover and join this room',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Room">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Room Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Room Type
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roomTypes.map(({ type, icon: Icon, title, description }) => (
              <div key={type}>
                <input
                  {...register('type')}
                  type="radio"
                  value={type}
                  id={type}
                  className="sr-only"
                  onChange={() => setSelectedType(type)}
                />
                <label
                  htmlFor={type}
                  className={`
                    relative block w-full p-4 border rounded-lg cursor-pointer hover:bg-gray-50
                    ${roomType === type ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                  `}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`
                      flex-shrink-0 p-2 rounded-lg
                      ${roomType === type ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
                    `}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900">{title}</h4>
                      <p className="text-sm text-gray-500">{description}</p>
                    </div>
                  </div>
                  {roomType === type && (
                    <div className="absolute top-2 right-2">
                      <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                    </div>
                  )}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Room Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Room Name
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Hash className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('name')}
              type="text"
              className={`
                block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${errors.name ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="Enter room name"
              disabled={createRoomMutation.isPending}
            />
          </div>
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description (Optional)
          </label>
          <div className="mt-1">
            <textarea
              {...register('description')}
              rows={3}
              className={`
                block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${errors.description ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="What's this room about?"
              disabled={createRoomMutation.isPending}
            />
          </div>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Max Participants */}
        <div>
          <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700">
            Maximum Participants
          </label>
          <div className="mt-1">
            <input
              {...register('maxParticipants', { valueAsNumber: true })}
              type="number"
              min="2"
              max="500"
              className={`
                block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${errors.maxParticipants ? 'border-red-300' : 'border-gray-300'}
              `}
              disabled={createRoomMutation.isPending}
            />
          </div>
          {errors.maxParticipants && (
            <p className="mt-1 text-sm text-red-600">{errors.maxParticipants.message}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Leave empty for no limit (up to 500 participants)
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={createRoomMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createRoomMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createRoomMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating...
              </>
            ) : (
              'Create Room'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}