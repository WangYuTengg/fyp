import { supabase } from '../../lib/supabase';
import type { McqOption, QuestionContent } from '../../lib/assessment';
export type {
  McqContent,
  McqOption,
  QuestionContent,
  UMLContent,
  WrittenContent,
} from '../../lib/assessment';

const API_BASE = import.meta.env.VITE_API_URL || '';

export type ApiError = {
  error?: string;
};

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export type Question = {
  id: string;
  courseId: string | null;
  type: 'mcq' | 'written' | 'coding' | 'uml';
  title: string;
  description: string | null;
  content: QuestionContent;
  rubric: unknown;
  points: number;
  tags: string[] | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function getAccessToken(): Promise<string | null> {
  // Check for custom token first (password login)
  const customToken = typeof window !== 'undefined'
    ? window.localStorage.getItem('uml-platform.customToken')
    : null;
  if (customToken) return Promise.resolve(customToken);

  // Fall back to Supabase session
  return supabase.auth.getSession().then(({ data: { session } }) => session?.access_token ?? null);
}

/**
 * API client with automatic auth token injection
 */
export async function apiClient<TResponse = unknown>(endpoint: string, options: RequestInit = {}): Promise<TResponse> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  headers.set('Content-Type', 'application/json');

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error('Network error');
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
    throw new ApiRequestError(error.error || `Request failed: ${response.statusText}`, response.status);
  }

  return response.json() as Promise<TResponse>;
}

// User API
export const userApi = {
  getCurrentUser: () => apiClient('/api/auth/me'),
  listStudents: (query?: string) =>
    apiClient<Array<{ id: string; email: string; name: string | null; role: string }>>(
      `/api/users${query ? `?q=${encodeURIComponent(query)}` : ''}`
    ),
};

// Courses API
export const coursesApi = {
  getAll: () => apiClient<unknown[]>('/api/courses'),
  getById: (id: string) => apiClient<unknown>(`/api/courses/${id}`),
  create: (data: Record<string, unknown>) => apiClient<unknown>('/api/courses', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  enroll: (courseId: string, data?: Record<string, unknown>) => apiClient<unknown>(`/api/courses/${courseId}/enroll`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  }),
  getEnrollments: (courseId: string) => apiClient<unknown[]>(`/api/courses/${courseId}/enrollments`),
  bulkEnroll: (courseId: string, data: { emails: string[]; role?: 'lecturer' | 'ta' | 'lab_exec' | 'student' }) =>
    apiClient<{ results: Array<{ email: string; status: string; enrollmentId?: string }>; counts: { enrolled: number; alreadyEnrolled: number; notFound: number; invalid: number } }>(
      `/api/courses/${courseId}/enrollments/bulk`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  removeEnrollment: (courseId: string, enrollmentId: string) =>
    apiClient<{ success: true }>(`/api/courses/${courseId}/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    }),
};

// Assignments API
export const assignmentsApi = {
  getByCourse: (courseId: string) => apiClient<unknown[]>(`/api/assignments/course/${courseId}`),
  getById: (id: string) => apiClient<unknown>(`/api/assignments/${id}`),
  create: (data: Record<string, unknown>) => apiClient<unknown>('/api/assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  publish: (id: string, isPublished: boolean) => apiClient<unknown>(`/api/assignments/${id}/publish`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublished }),
  }),
  remove: (id: string) => apiClient<{ success: true }>(`/api/assignments/${id}`, {
    method: 'DELETE',
  }),
  addQuestions: (assignmentId: string, questionIds: string[]) => apiClient<unknown>(`/api/assignments/${assignmentId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ questionIds }),
  }),
  removeQuestion: (questionLinkId: string) => apiClient<{ success: true }>(`/api/assignments/questions/${questionLinkId}`, {
    method: 'DELETE',
  }),
  reorderQuestions: (questionLinks: Array<{ id: string; order: number }>) => apiClient<{ success: true }>('/api/assignments/questions/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ questionLinks }),
  }),
  clone: (id: string, data: { targetCourseId?: string; newTitle?: string; newDueDate?: string | null }) =>
    apiClient<unknown>(`/api/assignments/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Submissions API
export const submissionsApi = {
  getByAssignment: (assignmentId: string) => apiClient<unknown[]>(`/api/submissions/assignment/${assignmentId}`),
  getById: (submissionId: string) => apiClient<unknown>(`/api/submissions/${submissionId}`),
  start: (assignmentId: string) => apiClient<unknown>('/api/submissions/start', {
    method: 'POST',
    body: JSON.stringify({ assignmentId }),
  }),
  saveAnswer: (submissionId: string, data: Record<string, unknown>) => apiClient<unknown>(`/api/submissions/${submissionId}/answers`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  submit: (submissionId: string) => apiClient<unknown>(`/api/submissions/${submissionId}/submit`, {
    method: 'POST',
  }),
  grade: (submissionId: string, data: Record<string, unknown>) => apiClient<unknown>(`/api/submissions/${submissionId}/grade`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  uploadFile: async (submissionId: string, questionId: string, file: File) => {
    const token = await getAccessToken();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('questionId', questionId);

    const response = await fetch(`${API_BASE}/api/submissions/${submissionId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData, // Don't set Content-Type, let browser set it with boundary
    });

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new ApiRequestError(error.error || 'Upload failed', response.status);
    }

    return response.json();
  },
  getFileHistory: (answerId: string) => apiClient<unknown[]>(`/api/submissions/answer/${answerId}/file-history`),
};

export const questionsApi = {
  listByCourse: (courseId: string, filters?: {
    search?: string;
    tags?: string[];
    types?: Array<'mcq' | 'written' | 'coding' | 'uml'>;
  }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters?.types?.length) params.set('types', filters.types.join(','));
    
    const query = params.toString();
    return apiClient<Question[]>(`/api/questions/course/${courseId}${query ? `?${query}` : ''}`);
  },
  create: (data: {
    courseId: string;
    title: string;
    type: 'mcq' | 'written' | 'uml';
    prompt: string;
    points?: number;
    options?: McqOption[];
    allowMultiple?: boolean;
    assignmentId?: string;
    tags?: string[];
    referenceDiagram?: string;
    showCorrectAnswers?: boolean;
    modelAnswer?: string;
  }) =>
    apiClient<Question>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: {
    title?: string;
    type?: 'mcq' | 'written' | 'uml';
    prompt?: string;
    points?: number;
    options?: McqOption[];
    allowMultiple?: boolean;
    tags?: string[];
    referenceDiagram?: string;
    showCorrectAnswers?: boolean;
    modelAnswer?: string;
  }) =>
    apiClient<Question>(`/api/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiClient<{ success: true }>(`/api/questions/${id}`, {
      method: 'DELETE',
    }),
  exportQuestions: async (courseId: string, format: 'csv' | 'json' = 'json') => {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE}/api/questions/course/${courseId}/export?format=${format}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' })) as ApiError;
      throw new ApiRequestError(error.error || 'Export failed', response.status);
    }
    if (format === 'csv') {
      return response.text();
    }
    return response.json();
  },
  importQuestions: async (courseId: string, file: File) => {
    const token = await getAccessToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/questions/course/${courseId}/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' })) as ApiError;
      throw new ApiRequestError(error.error || 'Import failed', response.status);
    }

    return response.json() as Promise<{
      imported: number;
      duplicates: number;
      duplicatesTitles: string[];
      errors?: Array<{ row: number; error: string }>;
      total: number;
    }>;
  },
  importQuestionsJson: async (courseId: string, questions: unknown[]) => {
    return apiClient<{
      imported: number;
      duplicates: number;
      duplicatesTitles: string[];
      errors?: Array<{ row: number; error: string }>;
      total: number;
    }>(`/api/questions/course/${courseId}/import`, {
      method: 'POST',
      body: JSON.stringify(questions),
    });
  },
};

export const tagsApi = {
  listByCourse: (courseId: string) => apiClient<string[]>(`/api/tags/course/${courseId}`),
};
