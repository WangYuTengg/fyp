import { useEffect, useState } from 'react';
import { BellIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface Notification {
  id: string;
  type: 'grading_failed' | 'grading_completed' | 'batch_completed';
  title: string;
  message: string | null;
  data: any;
  read: boolean;
  createdAt: string;
}

export function StaffNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      setNotifications(data.notifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' ? true : !n.read
  );

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'grading_failed':
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
      case 'grading_completed':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'batch_completed':
        return <CheckCircleIcon className="h-6 w-6 text-blue-500" />;
      default:
        return <BellIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread ({notifications.filter(n => !n.read).length})
          </button>
          {notifications.some(n => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border transition hover:shadow-md ${
                notification.read
                  ? 'bg-white border-gray-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {notification.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <ClockIcon className="h-4 w-4" />
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>
                  {notification.message && (
                    <p className="text-gray-700 mb-2">{notification.message}</p>
                  )}
                  {notification.data && (
                    <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                      {notification.type === 'grading_failed' && (
                        <div className="space-y-1">
                          <p className="text-gray-600">
                            <span className="font-medium">Answer ID:</span>{' '}
                            {notification.data.answerId?.slice(0, 8)}...
                          </p>
                          {notification.data.error && (
                            <p className="text-red-600">
                              <span className="font-medium">Error:</span>{' '}
                              {notification.data.error}
                            </p>
                          )}
                          {notification.data.batchId && (
                            <p className="text-gray-600">
                              <span className="font-medium">Batch ID:</span>{' '}
                              {notification.data.batchId.slice(0, 8)}...
                            </p>
                          )}
                        </div>
                      )}
                      {notification.type === 'batch_completed' && (
                        <div className="space-y-1">
                          <p className="text-gray-600">
                            <span className="font-medium">Batch ID:</span>{' '}
                            {notification.data.batchId?.slice(0, 8)}...
                          </p>
                          {notification.data.count && (
                            <p className="text-gray-600">
                              <span className="font-medium">Graded:</span>{' '}
                              {notification.data.count} submissions
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
