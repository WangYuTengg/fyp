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
export async function apiClient<TResponse = unknown>(endpoint: string, options: RequestInit = {}): Promise<TResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
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
  publishResults: (id: string, publish: boolean) =>
    apiClient<{ success: boolean; id: string; resultsPublished: boolean; resultsPublishedAt: string | null }>(
      `/api/assignments/${id}/publish-results`,
      { method: 'POST', body: JSON.stringify({ publish }) }
    ),
  getGradingProgress: (id: string) =>
    apiClient<{
      assignment: { id: string; title: string; resultsPublished: boolean; resultsPublishedAt: string | null };
      summary: { totalSubmissions: number; gradedSubmissions: number; pendingSubmissions: number };
      questionStats: Array<{
        questionId: string;
        questionTitle: string;
        questionType: string;
        maxPoints: number;
        totalAnswers: number;
        gradedAnswers: number;
        avgScore: number;
        aiGradedCount: number;
        aiAcceptedCount: number;
        overrideCount: number;
      }>;
      gradeDistribution: { mean: number; median: number; passCount: number; failCount: number; scores: number[] };
    }>(`/api/assignments/${id}/grading-progress`),
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

export const autoGradeApi = {
  batchAccept: (answerIds: string[]) =>
    apiClient<{ success: boolean; accepted: number; skipped: number }>(
      '/api/auto-grade/batch-accept',
      { method: 'POST', body: JSON.stringify({ answerIds }) }
    ),
};

export type RubricCriterion = {
  id: string;
  description: string;
  maxPoints: number;
  levels?: Array<{ label: string; points: number; description?: string }>;
};

export type Rubric = {
  id: string;
  questionId: string;
  criteria: RubricCriterion[];
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
};

export const rubricsApi = {
  getByQuestion: (questionId: string) =>
    apiClient<{ rubric: Rubric | null }>(`/api/questions/${questionId}/rubrics`),
  save: (questionId: string, criteria: Array<{ id?: string; description: string; maxPoints: number; levels?: Array<{ label: string; points: number; description?: string }> }>) =>
    apiClient<{ success: boolean; rubric: Rubric }>(`/api/questions/${questionId}/rubrics`, {
      method: 'POST',
      body: JSON.stringify({ criteria }),
    }),
  remove: (questionId: string) =>
    apiClient<{ success: boolean }>(`/api/questions/${questionId}/rubrics`, {
      method: 'DELETE',
    }),
};

export const tagsApi = {
  listByCourse: (courseId: string) => apiClient<string[]>(`/api/tags/course/${courseId}`),
};
