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

/**
 * API client with automatic auth token injection
 */
const CUSTOM_TOKEN_KEY = 'uml-platform.customToken';

export async function apiClient<TResponse = unknown>(endpoint: string, options: RequestInit = {}): Promise<TResponse> {
  const headers = new Headers(options.headers);

  // Try custom JWT token first (password-based login)
  const customToken = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_TOKEN_KEY) : null;
  if (customToken) {
    headers.set('Authorization', `Bearer ${customToken}`);
  } else {
    // Fallback to Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
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
    const { data: { session } } = await supabase.auth.getSession();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('questionId', questionId);

    const response = await fetch(`${API_BASE}/api/submissions/${submissionId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
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
};

export const tagsApi = {
  listByCourse: (courseId: string) => apiClient<string[]>(`/api/tags/course/${courseId}`),
};

// Admin user management API
export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'staff' | 'student';
  deactivatedAt: string | null;
  createdAt: string;
};

export type AdminUserListResponse = {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type BulkCreateUserInput = {
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'student';
  password: string;
};

export type BulkCreateResult = {
  email: string;
  status: 'created' | 'already_exists' | 'error';
  userId?: string;
  error?: string;
};

export const adminApi = {
  listUsers: (params?: { q?: string; role?: string; status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.role) searchParams.set('role', params.role);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return apiClient<AdminUserListResponse>(`/api/admin/users${query ? `?${query}` : ''}`);
  },
  createUser: (data: { email: string; name: string; role: string; password: string }) =>
    apiClient<AdminUser>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: { name?: string; role?: string; isActive?: boolean }) =>
    apiClient<AdminUser>(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteUser: (id: string) =>
    apiClient<{ success: true }>(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),
  bulkCreateUsers: (users: BulkCreateUserInput[]) =>
    apiClient<{ results: BulkCreateResult[]; counts: { created: number; alreadyExists: number; errors: number } }>(
      '/api/admin/users/bulk',
      {
        method: 'POST',
        body: JSON.stringify({ users }),
      }
    ),
  resetUserPassword: (id: string, password: string) =>
    apiClient<{ success: true }>(`/api/admin/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),
};

// Password auth API (no auth token needed)
export const passwordAuthApi = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: 'Login failed' }))) as ApiError;
      throw new ApiRequestError(error.error || 'Login failed', response.status);
    }
    return response.json() as Promise<{
      token: string;
      user: { id: string; email: string; name: string | null; role: string };
    }>;
  },
  forgotPassword: async (email: string) => {
    const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
      throw new ApiRequestError(error.error || 'Request failed', response.status);
    }
    return response.json() as Promise<{ message: string }>;
  },
  resetPassword: async (token: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
      throw new ApiRequestError(error.error || 'Request failed', response.status);
    }
    return response.json() as Promise<{ message: string }>;
  },
};
