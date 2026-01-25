# Frontend Patterns (React + TanStack Router + Tailwind)

## Component Structure

```
src/client/components/
├── Sidebar.tsx         # Navigation sidebar
├── UserInfo.tsx        # User profile display
├── CourseCard.tsx      # Reusable course card
└── ui/                 # Shared UI components (future)
    ├── Button.tsx
    ├── Input.tsx
    └── Card.tsx
```

## Component Patterns

### Basic Component

```typescript
interface CourseCardProps {
  course: Course;
  onSelect?: (id: string) => void;
}

export function CourseCard({ course, onSelect }: CourseCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <h3 className="text-xl font-semibold text-gray-900">{course.name}</h3>
      <p className="text-sm text-gray-600">{course.code}</p>
      <p className="mt-2 text-gray-700">{course.description}</p>
      
      {onSelect && (
        <button
          onClick={() => onSelect(course.id)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          View Course
        </button>
      )}
    </div>
  );
}
```

### Component with State

```typescript
import { useState } from 'react';

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchCourses();
  }, []);
  
  async function fetchCourses() {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/api/courses');
      setCourses(data.data);
    } catch (err) {
      setError('Failed to load courses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
```

## TanStack Router Patterns

### Route File Structure

```typescript
// src/client/routes/student.tsx
import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '@/lib/route-guards';

export const Route = createFileRoute('/student')({
  beforeLoad: async () => {
    await requireRole(['student']);
  },
  component: StudentDashboard,
});

function StudentDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Student Dashboard</h1>
      {/* Dashboard content */}
    </div>
  );
}
```

### Dynamic Routes

```typescript
// src/client/routes/student/courses/$courseId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/lib/route-guards';

export const Route = createFileRoute('/student/courses/$courseId')({
  beforeLoad: requireAuth,
  loader: async ({ params }) => {
    const course = await fetchWithAuth(`/api/courses/${params.courseId}`);
    return { course: course.data };
  },
  component: CourseDetail,
});

function CourseDetail() {
  const { course } = Route.useLoaderData();
  
  return (
    <div>
      <h1>{course.name}</h1>
      <p>{course.description}</p>
    </div>
  );
}
```

### Navigation

```typescript
import { Link, useNavigate } from '@tanstack/react-router';

function Navigation() {
  const navigate = useNavigate();
  
  return (
    <nav>
      {/* Declarative navigation */}
      <Link to="/courses" className="nav-link">
        Courses
      </Link>
      
      {/* Programmatic navigation */}
      <button onClick={() => navigate({ to: '/assignments' })}>
        View Assignments
      </button>
      
      {/* With params */}
      <Link to="/courses/$courseId" params={{ courseId: '123' }}>
        Course 123
      </Link>
    </nav>
  );
}
```

### Search Params

```typescript
// Define search params type
type CourseSearchParams = {
  filter?: string;
  page?: number;
};

export const Route = createFileRoute('/courses')({
  validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
    return {
      filter: search.filter as string,
      page: Number(search.page ?? 1),
    };
  },
  component: CourseList,
});

function CourseList() {
  const { filter, page } = Route.useSearch();
  
  return (
    <div>
      <input
        value={filter}
        onChange={(e) => {
          // Update search params
          navigate({ search: { filter: e.target.value, page: 1 } });
        }}
      />
      {/* Use filter and page in queries */}
    </div>
  );
}
```

## Tailwind CSS Patterns

### Layout Classes

```typescript
// Container
<div className="container mx-auto px-4">

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Flexbox
<div className="flex items-center justify-between">
<div className="flex flex-col space-y-4">
```

### Responsive Design

```typescript
<div className="w-full md:w-1/2 lg:w-1/3">
<h1 className="text-xl md:text-2xl lg:text-3xl">
```

### Common Component Styles

**Button**:
```typescript
<button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
  Click Me
</button>
```

**Input**:
```typescript
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

**Card**:
```typescript
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
  {/* Card content */}
</div>
```

### State-based Styling

```typescript
const [isActive, setIsActive] = useState(false);

<button
  className={`px-4 py-2 rounded ${
    isActive 
      ? 'bg-blue-600 text-white' 
      : 'bg-gray-200 text-gray-700'
  }`}
>
  Toggle
</button>
```

## Custom Hooks

### useAuth Hook

```typescript
// src/client/hooks/useAuth.ts
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### useFetch Hook (Example)

```typescript
import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        const result = await fetchWithAuth(url);
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fetch failed');
      } finally {
        setLoading(false);
      }
    }
    
    fetch();
  }, [url]);
  
  return { data, loading, error };
}

// Usage
function CourseDetail({ courseId }: { courseId: string }) {
  const { data: course, loading, error } = useFetch<Course>(
    `/api/courses/${courseId}`
  );
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{course?.name}</div>;
}
```

## Form Handling

```typescript
import { useState } from 'react';

function CreateCourse() {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      await fetchWithAuth('/api/courses', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      // Success - navigate or show message
      alert('Course created!');
    } catch (error) {
      console.error('Failed to create course:', error);
      alert('Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Course Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>
      
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Creating...' : 'Create Course'}
      </button>
    </form>
  );
}
```

## Error Boundaries (Optional)

```typescript
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600">
            Something went wrong
          </h2>
          <p className="text-gray-600">{this.state.error?.message}</p>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Loading States

```typescript
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

// Usage in component
if (loading) return <LoadingSpinner />;
```
