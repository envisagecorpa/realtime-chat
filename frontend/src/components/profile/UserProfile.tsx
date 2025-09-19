import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Settings, Lock, Shield, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../services/api';
import { UserAvatar } from '../ui/UserAvatar';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { User as UserType } from '../../types';

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name cannot exceed 100 characters'),
  status: z
    .string()
    .max(200, 'Status cannot exceed 200 characters')
    .optional()
    .or(z.literal('')),
});

type UpdateProfileForm = z.infer<typeof updateProfileSchema>;

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy'>('profile');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileForm>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      status: user?.status || '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileForm) =>
      apiClient.updateUserProfile({
        displayName: data.displayName,
        status: data.status || undefined,
      }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user', user?.id], updatedUser);
      useAuthStore.getState().setUser(updatedUser);
      reset({
        displayName: updatedUser.displayName || '',
        status: updatedUser.status || '',
      });
    },
    onError: (error: any) => {
      console.error('Failed to update profile:', error);
    },
  });

  const handleLogout = () => {
    logout();
    onClose();
  };

  const onSubmit = (data: UpdateProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  if (!user) return null;

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Lock },
    { key: 'privacy', label: 'Privacy', icon: Shield },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Profile" size="lg">
      <div className="flex space-x-6">
        {/* Tab navigation */}
        <div className="w-48 space-y-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${activeTab === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mt-4"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* User info */}
              <div className="flex items-center space-x-4">
                <UserAvatar user={user} size="lg" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {user.displayName || user.username}
                  </h3>
                  <p className="text-sm text-gray-500">@{user.username}</p>
                  {user.role === 'moderator' && (
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Moderator
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                    Display Name
                  </label>
                  <div className="mt-1">
                    <input
                      {...register('displayName')}
                      type="text"
                      className={`
                        block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                        ${errors.displayName ? 'border-red-300' : 'border-gray-300'}
                      `}
                      placeholder="Your display name"
                      disabled={updateProfileMutation.isPending}
                    />
                  </div>
                  {errors.displayName && (
                    <p className="mt-1 text-sm text-red-600">{errors.displayName.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Status (Optional)
                  </label>
                  <div className="mt-1">
                    <input
                      {...register('status')}
                      type="text"
                      className={`
                        block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                        ${errors.status ? 'border-red-300' : 'border-gray-300'}
                      `}
                      placeholder="What's your status?"
                      disabled={updateProfileMutation.isPending}
                    />
                  </div>
                  {errors.status && (
                    <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!isDirty || updateProfileMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>

              {/* Account info */}
              <div className="pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Account Information</h4>
                <dl className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Member since:</dt>
                    <dd className="text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Last seen:</dt>
                    <dd className="text-gray-900">
                      {user.lastSeenAt
                        ? new Date(user.lastSeenAt).toLocaleString()
                        : 'Never'
                      }
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">User ID:</dt>
                    <dd className="text-gray-900 font-mono text-xs">{user.id}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Lock className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Authentication Method
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          This application uses username-based authentication.
                          No password is required - anyone can use any username.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Active Sessions</h4>
                <div className="bg-gray-50 rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Session</p>
                      <p className="text-sm text-gray-500">This device - Active now</p>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Privacy Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Online Status</h4>
                      <p className="text-sm text-gray-500">
                        Show when you're online to other users
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900 mr-3">Visible</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Enabled
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Read Receipts</h4>
                      <p className="text-sm text-gray-500">
                        Let others know when you've read their messages
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900 mr-3">Enabled</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        On
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}