import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AuthProvider } from '../contexts/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../hooks/useAuth';

function RootComponent() {
  const { user, dbUser, loading } = useAuth();

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {(user || dbUser) && <Sidebar />}

        {/* Main content */}
        <div className={(user || dbUser) ? "md:pl-64 flex flex-col flex-1" : "flex flex-col flex-1"}>
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
    <ErrorBoundary>
      <AuthProvider>
        <RootComponent />
      </AuthProvider>
    </ErrorBoundary>
  ),
});
