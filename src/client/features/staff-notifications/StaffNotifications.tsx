import { useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

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
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      setNotifications(data.notifications || []);
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
          {notifications.some(n => !n.read) && (
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
                  No notifications. Click "Refresh" to load notifications.
                </td>
              </tr>
            ) : (
              notifications.map(notification => {
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
                          {notification.type === 'grading_failed' && notification.data.error && (
                            <div className="text-red-600">Error: {notification.data.error}</div>
                          )}
                          {notification.type === 'batch_completed' && notification.data.count && (
                            <div>Graded: {notification.data.count} submissions</div>
                          )}
                          {notification.data.answerId && (
                            <div>Answer ID: {notification.data.answerId.slice(0, 8)}...</div>
                          )}
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
          {notifications.filter(n => !n.read).length} unread
        </div>
      )}
    </div>
  );
}
