import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStaffCourse, type QuestionFilters } from './hooks/useStaffCourse';
import { useAssignmentForm } from './hooks/useAssignmentForm';
import { useQuestionForm } from './hooks/useQuestionForm';
import { CourseHeader } from './components/CourseHeader';
import { CreateAssignmentForm } from './components/CreateAssignmentForm';
import { CreateQuestionForm } from './components/CreateQuestionForm';
import { AssignmentCard } from './components/AssignmentCard';
import { QuestionCard } from './components/QuestionCard';
import { QuestionFilters as QuestionFiltersComponent } from './components/QuestionFilters';
import { TagManager } from './components/TagManager';

type StaffCourseDetailProps = {
  courseId: string;
};

type TabType = 'assignments' | 'questions';

export function StaffCourseDetail({ courseId }: StaffCourseDetailProps) {
  const { user, dbUser, loading: authLoading, setAdminViewAs } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('assignments');
  const [questionFilters, setQuestionFilters] = useState<QuestionFilters>({});
  const [showTagManager, setShowTagManager] = useState(false);

  const { course, assignments, questions, tags, loading } = useStaffCourse(
    courseId,
    user,
    dbUser,
    questionFilters
  );
  const assignmentForm = useAssignmentForm(courseId);
  const questionForm = useQuestionForm(courseId, assignments);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: '/login' });
      } else if (dbUser && dbUser.role !== 'admin' && dbUser.role !== 'staff') {
        navigate({ to: '/student' });
      } else if (dbUser?.role === 'admin') {
        setAdminViewAs('staff');
      }
    }
  }, [authLoading, user, dbUser, navigate, setAdminViewAs]);

  if (authLoading || loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!course) {
    return <div className="text-center py-8">Course not found</div>;
  }

  return (
    <div className="space-y-6">
      <CourseHeader course={course} />

      <div className="bg-white shadow rounded-lg">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              className={`${
                activeTab === 'assignments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Assignments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`${
                activeTab === 'questions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Question Pool
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'assignments' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Assignments</h2>
                <button
                  type="button"
                  onClick={() => assignmentForm.setShowForm(!assignmentForm.showForm)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                >
                  {assignmentForm.showForm ? 'Cancel' : 'Create Assignment'}
                </button>
              </div>

              {assignmentForm.showForm && (
                <CreateAssignmentForm
                  assignmentType={assignmentForm.assignmentType}
                  setAssignmentType={assignmentForm.setAssignmentType}
                  questions={questions}
                  selectedQuestionIds={assignmentForm.selectedQuestionIds}
                  setSelectedQuestionIds={assignmentForm.setSelectedQuestionIds}
                  onSubmit={assignmentForm.createAssignment}
                  isSubmitting={assignmentForm.isCreating}
                />
              )}

              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onTogglePublish={assignmentForm.togglePublish}
                    onDelete={assignmentForm.deleteAssignment}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Question Pool</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTagManager(!showTagManager)}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded"
                  >
                    {showTagManager ? 'Hide Tags' : 'Manage Tags'}
                  </button>
                  <button
                    type="button"
                    onClick={() => questionForm.setShowForm(!questionForm.showForm)}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                  >
                    {questionForm.showForm ? 'Cancel' : 'Create Question'}
                  </button>
                </div>
              </div>

              {showTagManager && (
                <TagManager tags={tags} />
              )}

              {questionForm.showForm && (
                <CreateQuestionForm
                  questionType={questionForm.questionType}
                  setQuestionType={questionForm.setQuestionType}
                  mcqOptions={questionForm.mcqOptions}
                  setMcqOptions={questionForm.setMcqOptions}
                  onSubmit={questionForm.createQuestion}
                  isSubmitting={questionForm.isCreating}
                  assignments={assignments}
                  selectedAssignmentId={questionForm.selectedAssignmentId}
                  setSelectedAssignmentId={questionForm.setSelectedAssignmentId}
                  tags={tags}
                />
              )}

              <QuestionFiltersComponent
                filters={questionFilters}
                setFilters={setQuestionFilters}
                availableTags={tags}
              />

              {questions.length === 0 ? (
                <p className="text-gray-500">No questions found.</p>
              ) : (
                <div className="space-y-4">
                  {questions.map((question) => (
                    <QuestionCard 
                      key={question.id} 
                      question={question} 
                      onDelete={questionForm.deleteQuestion}
                      onEdit={questionForm.editQuestion}
                      availableTags={tags}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
