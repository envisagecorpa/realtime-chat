import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageCircle, User, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import type { LoginRequest } from '../types';

const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  displayName: z
    .string()
    .max(100, 'Display name cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);

      const loginData: LoginRequest = {
        username: data.username,
        displayName: data.displayName || undefined,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
      };

      await login(loginData);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <MessageCircle className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to RealTime Chat
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your username to start chatting
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('username')}
                  type="text"
                  autoComplete="username"
                  className={`appearance-none relative block w-full pl-10 pr-3 py-2 border ${
                    errors.username ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Enter your username"
                  disabled={isLoading || isSubmitting}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                Display Name (Optional)
              </label>
              <div className="mt-1">
                <input
                  {...register('displayName')}
                  type="text"
                  autoComplete="name"
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    errors.displayName ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Your display name"
                  disabled={isLoading || isSubmitting}
                />
              </div>
              {errors.displayName && (
                <p className="mt-1 text-sm text-red-600">{errors.displayName.message}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Login failed</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading || isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              No account needed! Just enter a username to start chatting.
            </p>
          </div>
        </form>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Features</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="text-center">
                <div className="bg-green-100 rounded-full p-2 w-8 h-8 mx-auto mb-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                </div>
                <p className="text-sm text-gray-600">Real-time messaging</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 rounded-full p-2 w-8 h-8 mx-auto mb-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                </div>
                <p className="text-sm text-gray-600">File sharing</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full p-2 w-8 h-8 mx-auto mb-2">
                  <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                </div>
                <p className="text-sm text-gray-600">Group chats</p>
              </div>
              <div className="text-center">
                <div className="bg-yellow-100 rounded-full p-2 w-8 h-8 mx-auto mb-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                </div>
                <p className="text-sm text-gray-600">Typing indicators</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}