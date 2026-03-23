import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const { user, dbUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if we have dbUser (covers both Supabase and password login)
    if (!loading && dbUser) {
      if (dbUser.role === 'student') {
        navigate({ to: '/student' });
      } else {
        navigate({ to: '/staff' });
      }
    }
  }, [loading, user, dbUser, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show welcome page for non-authenticated users
  if (!user && !dbUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to UML Assessment Platform
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl">
            A comprehensive platform for creating, managing, and grading UML diagram assignments with AI-assisted evaluation.
          </p>
          <div className="space-y-4">
            <p className="text-gray-600 mb-4">
              Sign in to access your courses and assignments.
            </p>
            <Link
              to="/login"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated but dbUser hasn't loaded yet - show loading
  if (!dbUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your account...</p>
          <p className="text-sm text-gray-400 mt-2">
            If this takes too long, make sure the API server is running.
          </p>
        </div>
      </div>
    );
  }

  // Has both user and dbUser - redirect in progress
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
