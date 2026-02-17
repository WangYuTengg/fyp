import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { 
  BookOpenIcon, 
  AcademicCapIcon,
  BellIcon,
  Cog6ToothIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { UserInfo } from './UserInfo';
import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const navigation: NavItem[] = [
  {
    name: 'My Courses',
    href: '/student',
    icon: BookOpenIcon,
    roles: ['student']
  },
  {
    name: 'Course Management',
    href: '/staff',
    icon: AcademicCapIcon,
    roles: ['staff', 'admin']
  },
  {
    name: 'Analytics',
    href: '/staff/analytics',
    icon: ChartBarIcon,
    roles: ['staff', 'admin']
  },
  {
    name: 'Notifications',
    href: '/staff/notifications',
    icon: BellIcon,
    roles: ['staff', 'admin']
  },
  {
    name: 'Settings',
    href: '/staff/settings',
    icon: Cog6ToothIcon,
    roles: ['admin']
  }
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export function Sidebar() {
  const { dbUser, loading, effectiveRole, setAdminViewAs, adminViewAs } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count for staff/admin
  useEffect(() => {
    const role = effectiveRole ?? dbUser?.role;
    if (dbUser && (role === 'staff' || role === 'admin')) {
      apiClient<{ count: number }>('/api/notifications/unread-count')
        .then(data => setUnreadCount(data.count || 0))
        .catch(console.error);
      
      // Poll every 30 seconds
      const interval = setInterval(() => {
        apiClient<{ count: number }>('/api/notifications/unread-count')
          .then(data => setUnreadCount(data.count || 0))
          .catch(console.error);
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [dbUser, effectiveRole]);

  if (loading || !dbUser) {
    return (
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center shrink-0 px-4">
              <div className="text-blue-600 text-lg font-bold">
                UML Platform
              </div>
            </div>
            <div className="mt-8 flex-1 px-3">
              <div className="animate-pulse space-y-3">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredNavigation = navigation.filter((item) => {
    const role = effectiveRole ?? dbUser.role;
    return item.roles.includes(role);
  });

  const isAdmin = dbUser.role === 'admin';
  const currentView = isAdmin ? (adminViewAs ?? 'staff') : null;

  const switchView = (role: 'student' | 'staff') => {
    setAdminViewAs(role);
    void navigate({ to: role === 'student' ? '/student' : '/staff' });
  };

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center  shrink-0 px-4">
            <div className="text-blue-600 text-lg font-bold">
              UML Platform
            </div>
          </div>

          {isAdmin && (
            <div className="mt-6 px-4">
              <div className="text-xs font-medium text-gray-500 mb-2">View as</div>
              <div className="flex rounded-md border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => switchView('student')}
                  className={classNames(
                    currentView === 'student'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900',
                    'flex-1 rounded-md px-2 py-1 text-sm font-medium transition-colors'
                  )}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => switchView('staff')}
                  className={classNames(
                    currentView === 'staff'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900',
                    'flex-1 rounded-md px-2 py-1 text-sm font-medium transition-colors'
                  )}
                >
                  Staff
                </button>
              </div>
            </div>
          )}
          <nav className="mt-8 flex-1 px-3 space-y-1">
            {filteredNavigation.map((item) => {
              // Only highlight exact match or child routes (but not parent routes)
              const isActive = location.pathname === item.href || 
                              (location.pathname.startsWith(item.href + '/') && 
                               item.href !== '/student' && item.href !== '/staff');
              
              const showBadge = item.href === '/staff/notifications' && unreadCount > 0;
              
              return (
                <Link
                  key={item.name + item.href}
                  to={item.href}
                  className={classNames(
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-r-md transition-colors'
                  )}
                >
                  <item.icon
                    className={classNames(
                      isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600',
                      'mr-3 shrink-0 h-5 w-5 transition-colors'
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.name}</span>
                  {showBadge && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        
        {/* User info at bottom */}
       <UserInfo dbUser={dbUser} />
      </div>
    </div>
  );
}
