import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AuthProvider } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';

function RootComponent() {
  const { user, loading } = useAuth();

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {user && <Sidebar />}
        
        {/* Main content */}
        <div className={user ? "md:pl-64 flex flex-col flex-1" : "flex flex-col flex-1"}>
          {/* Top bar */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
              <div className="flex flex-1 items-center justify-between">
                <h1 className="text-lg font-semibold text-gray-900">
                  UML Assessment Platform
                </h1>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1">
            <div className="py-6">
              <div className="px-4 sm:px-6 lg:px-8">
                {!loading && <Outlet />}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <RootComponent />
    </AuthProvider>
  ),
});
