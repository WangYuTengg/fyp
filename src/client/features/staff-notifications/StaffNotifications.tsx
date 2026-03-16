import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { NotificationType, StaffNotificationData } from '../../../lib/assessment';
import { apiClient } from '../../lib/api';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  data: StaffNotificationData | null;
  read: boolean;
  createdAt: string;
}

type NotificationsResponse = {
  notifications: Notification[];
};

function renderNotificationDetails(notification: Notification) {
  const data = notification.data;

  if (!data) {
    return null;
  }

  if (notification.type === 'grading_failed' && 'error' in data && typeof data.error === 'string') {
    return <div className="text-red-600">Error: {data.error}</div>;
  }

  if (notification.type === 'batch_completed') {
    const processedCount =
      'completed' in data && typeof data.completed === 'number'
        ? data.completed
        : 'count' in data && typeof data.count === 'number'
          ? data.count
          : undefined;
    const totalCount =
      'total' in data && typeof data.total === 'number'
        ? data.total
        : 'count' in data && typeof data.count === 'number'
          ? data.count
          : undefined;
    const failedCount =
      'failed' in data && typeof data.failed === 'number' ? data.failed : 0;

    if (typeof processedCount === 'number' || typeof totalCount === 'number') {
      return (
        <div>
          Processed: {processedCount ?? totalCount ?? 0}
          {typeof totalCount === 'number' ? ` / ${totalCount}` : ''}
          {failedCount > 0 ? ` (${failedCount} failed)` : ''}
        </div>
      );
    }
  }

  if ('answerId' in data && typeof data.answerId === 'string' && data.answerId.length > 0) {
    return <div>Answer ID: {data.answerId.slice(0, 8)}...</div>;
  }

  return null;
}

export function StaffNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiClient<NotificationsResponse>('/api/notifications');
      setNotifications(data.notifications ?? []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await apiClient<{ success: true }>(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient<{ success: true }>('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) => ({ ...notification, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeDisplay = (type: Notification['type']) => {
    switch (type) {
      case 'grading_failed':
        return { label: 'Failed', color: 'text-red-600 bg-red-50' };
      case 'grading_completed':
        return { label: 'Completed', color: 'text-green-600 bg-green-50' };
      case 'batch_completed':
        return { label: 'Batch Done', color: 'text-blue-600 bg-blue-50' };
      default:
        return { label: type, color: 'text-gray-600 bg-gray-50' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {notifications.some((notification) => !notification.read) && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Message
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No notifications yet.
                </td>
              </tr>
            ) : (
              notifications.map((notification) => {
                const typeDisplay = getTypeDisplay(notification.type);
                return (
                  <tr
                    key={notification.id}
                    className={notification.read ? 'bg-white' : 'bg-blue-50'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {notification.read ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-3 w-3 bg-blue-600 rounded-full"></div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeDisplay.color}`}>
                        {typeDisplay.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {notification.message || '-'}
                      </div>
                      {notification.data && (
                        <div className="mt-1 text-xs text-gray-500">
                          {renderNotificationDetails(notification)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(notification.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Mark Read
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {notifications.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          {' • '}
          {notifications.filter((notification) => !notification.read).length} unread
        </div>
      )}
    </div>
  );
}
