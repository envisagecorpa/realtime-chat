import React from 'react';
import { User as UserIcon } from 'lucide-react';
import { clsx } from 'clsx';
import type { User } from '../../types';

interface UserAvatarProps {
  user: User;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showOnlineStatus?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const iconSizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

const statusSizeClasses = {
  xs: 'h-1.5 w-1.5 -bottom-0 -right-0',
  sm: 'h-2 w-2 -bottom-0 -right-0',
  md: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
  lg: 'h-3 w-3 -bottom-0.5 -right-0.5',
  xl: 'h-4 w-4 -bottom-1 -right-1',
};

export function UserAvatar({
  user,
  size = 'md',
  showOnlineStatus = false,
  onClick,
  className,
}: UserAvatarProps) {
  const initials = React.useMemo(() => {
    const name = user.displayName || user.username;
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [user.displayName, user.username]);

  const avatarColor = React.useMemo(() => {
    // Generate a consistent color based on user ID
    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-amber-500',
      'bg-yellow-500',
      'bg-lime-500',
      'bg-green-500',
      'bg-emerald-500',
      'bg-teal-500',
      'bg-cyan-500',
      'bg-sky-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-violet-500',
      'bg-purple-500',
      'bg-fuchsia-500',
      'bg-pink-500',
      'bg-rose-500',
    ];

    const hash = user.id.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  }, [user.id]);

  const avatarElement = (
    <div
      className={clsx(
        'relative flex items-center justify-center rounded-full text-white font-medium',
        sizeClasses[size],
        avatarColor,
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
      title={user.displayName || user.username}
    >
      {initials || <UserIcon className={iconSizeClasses[size]} />}

      {showOnlineStatus && (
        <span
          className={clsx(
            'absolute rounded-full border-2 border-white',
            statusSizeClasses[size],
            user.isOnline ? 'bg-green-400' : 'bg-gray-300'
          )}
        />
      )}
    </div>
  );

  return avatarElement;
}

interface UserAvatarGroupProps {
  users: User[];
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function UserAvatarGroup({
  users,
  max = 3,
  size = 'md',
  className,
}: UserAvatarGroupProps) {
  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  const overlapClasses = {
    xs: '-space-x-1',
    sm: '-space-x-1',
    md: '-space-x-2',
    lg: '-space-x-2',
    xl: '-space-x-3',
  };

  return (
    <div className={clsx('flex items-center', overlapClasses[size], className)}>
      {visibleUsers.map((user, index) => (
        <UserAvatar
          key={user.id}
          user={user}
          size={size}
          showOnlineStatus
          className="ring-2 ring-white"
        />
      ))}
      {remainingCount > 0 && (
        <div
          className={clsx(
            'flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium ring-2 ring-white',
            sizeClasses[size]
          )}
        >
          <span className="text-xs">+{remainingCount}</span>
        </div>
      )}
    </div>
  );
}