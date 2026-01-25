import { ArrowRightEndOnRectangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/useAuth";

interface UserInfoProps {
  dbUser: { id: string; email: string; name: string | null; role: "admin" | "staff" | "student"; supabaseId: string };
}

export function UserInfo({ dbUser }: UserInfoProps) {
  const { signOut, adminViewAs } = useAuth();

  const roleLabel = (() => {
    if (dbUser.role !== 'admin') return dbUser.role;
    const view = adminViewAs ?? 'staff';
    return `admin (viewing ${view})`;
  })();

  return (
    <div className="shrink-0 border-t border-gray-200 p-4 space-y-3">
      <div className="flex items-center">
        <div className="shrink-0">
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {(dbUser.name || dbUser.email).charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-900">{dbUser.email}</p>
          <p className="text-xs text-gray-500 capitalize">{roleLabel}</p>
        </div>
      </div>
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-800 rounded-md transition-colors"
      >
        <ArrowRightEndOnRectangleIcon className="h-5 w-5" />
        Log out
      </button>
    </div>
  );
}
