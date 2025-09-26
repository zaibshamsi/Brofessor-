import React from 'react';
import { Notification } from '../types';
import BellIcon from './icons/BellIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import CloseIcon from './icons/CloseIcon';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onClear: (notificationId: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  isLoading?: boolean;
  hasUnread: boolean;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ notifications, onMarkAsRead, onMarkAllAsRead, onClear, onClearAll, isLoading, hasUnread }) => {
    
    const timeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);

        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.is_read) {
            onMarkAsRead(notification.id);
        }
    };
    
    return (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-700 rounded-md shadow-lg z-20 origin-top-right ring-1 ring-black ring-opacity-5 focus:outline-none animate-fade-in-up">
            <div className="p-4 border-b border-gray-600 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Notifications</h3>
                <div className="flex items-center gap-x-4">
                    {hasUnread && (
                        <button 
                            onClick={onMarkAllAsRead} 
                            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none"
                        >
                            Mark all as read
                        </button>
                    )}
                    {notifications.length > 0 && !isLoading && (
                        <button 
                            onClick={onClearAll}
                            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center items-center py-10">
                        <SpinnerIcon className="w-8 h-8 text-gray-400" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <BellIcon className="w-12 h-12 mx-auto text-gray-500" />
                        <p className="mt-4 text-sm text-gray-400">You have no notifications yet.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-600">
                        {notifications.map(notification => (
                            <li
                                key={notification.id}
                                className={`group relative hover:bg-gray-600/50 transition-colors duration-150`}
                            >
                                <div
                                  onClick={() => handleNotificationClick(notification)}
                                  className={`block p-4 ${notification.is_read ? 'opacity-70' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {!notification.is_read && (
                                            <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        )}
                                        <div className={`flex-1 ${notification.is_read ? 'pl-5' : ''}`}>
                                            <p className="text-sm text-gray-200 whitespace-pre-wrap pr-5">{notification.message}</p>
                                            <p className="text-xs text-gray-400 mt-1">{timeAgo(notification.created_at)}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClear(notification.id);
                                    }}
                                    className="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded-full text-gray-500 hover:text-white hover:bg-gray-500/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                    aria-label="Clear notification"
                                >
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NotificationsPanel;