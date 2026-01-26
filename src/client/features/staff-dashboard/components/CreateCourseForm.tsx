type CreateCourseFormProps = {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
};

export function CreateCourseForm({ onSubmit }: CreateCourseFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Course Code</label>
          <input
            type="text"
            name="code"
            required
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="e.g., CS2030"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Course Name</label>
          <input
            type="text"
            name="name"
            required
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="e.g., Software Engineering"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            name="description"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Academic Year</label>
            <input
              type="text"
              name="academicYear"
              required
              className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="2024/2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Semester</label>
            <select
              name="semester"
              required
              defaultValue=""
              className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="" disabled>
                Select a semester
              </option>
              <option value="Semester 1">Semester 1</option>
              <option value="Semester 2">Semester 2</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
        >
          Create Course
        </button>
      </form>
  );
}
