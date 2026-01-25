type DashboardHeaderProps = {
  onCreateClick: () => void;
  showingForm: boolean;
};

export function DashboardHeader({ onCreateClick, showingForm }: DashboardHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create and manage courses and assignments
        </p>
      </div>
      <button
        onClick={onCreateClick}
        className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
      >
        {showingForm ? 'Cancel' : 'Create Course'}
      </button>
    </div>
  );
}
