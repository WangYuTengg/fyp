/** biome-ignore-all lint/a11y/noAutofocus: KIS */
import { useMemo, useState } from 'react';

type CreateCourseFormProps = {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting?: boolean;
};

const STEP_TITLES = ['Course Code', 'Course Name', 'Academic Term', 'Description', 'Review'] as const;

function getAcademicYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let y = currentYear + 1; y >= currentYear - 4; y--) {
    options.push(`${y}/${y + 1}`);
  }
  return options;
}

const ACADEMIC_YEAR_OPTIONS = getAcademicYearOptions();
const DEFAULT_ACADEMIC_YEAR = ACADEMIC_YEAR_OPTIONS[1]; // current year / next year

export function CreateCourseForm({ onSubmit, isSubmitting = false }: CreateCourseFormProps) {
  const [step, setStep] = useState(0);
  const [submitIntent, setSubmitIntent] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [semester, setSemester] = useState('');
  const [description, setDescription] = useState('');

  const isLastStep = step === STEP_TITLES.length - 1;

  const canProceed = useMemo(() => {
    if (step === 0) return code.trim().length > 0;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return academicYear.trim().length > 0 && semester.trim().length > 0;
    return true;
  }, [academicYear, code, name, semester, step]);

  const handleNext = () => {
    if (!canProceed || isLastStep) return;
    setSubmitIntent(false);
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (step === 0) return;
    setSubmitIntent(false);
    setStep((current) => current - 1);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isLastStep) {
      e.preventDefault();
      setSubmitIntent(false);
      if (canProceed) {
        handleNext();
      }
      return;
    }
    if (!submitIntent) {
      e.preventDefault();
      return;
    }
    setSubmitIntent(false);
    onSubmit(e);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="academicYear" value={academicYear} />
      <input type="hidden" name="semester" value={semester} />

      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <span className="font-medium">Step {step + 1} of {STEP_TITLES.length}:</span> {STEP_TITLES[step]}
      </div>

      {step === 0 && (
        <div>
          <label htmlFor="create-course-code" className="block text-sm font-medium text-gray-700">Course Code</label>
          <input
            id="create-course-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="form-input-block"
            placeholder="e.g., CS2030"
            autoFocus
          />
        </div>
      )}

      {step === 1 && (
        <div>
          <label htmlFor="create-course-name" className="block text-sm font-medium text-gray-700">Course Name</label>
          <input
            id="create-course-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input-block"
            placeholder="e.g., Software Engineering"
            autoFocus
          />
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="create-course-academic-year" className="block text-sm font-medium text-gray-700">Academic Year</label>
            <select
              id="create-course-academic-year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="form-select-block"
              autoFocus
            >
              {ACADEMIC_YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-course-semester" className="block text-sm font-medium text-gray-700">Semester</label>
            <select
              id="create-course-semester"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="form-select-block"
            >
              <option value="" disabled>
                Select a semester
              </option>
              <option value="Semester 1">Semester 1</option>
              <option value="Semester 2">Semester 2</option>
            </select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <label htmlFor="create-course-description" className="block text-sm font-medium text-gray-700">Description (optional)</label>
          <textarea
            id="create-course-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="form-textarea-block"
            placeholder="What should students know about this course?"
            autoFocus
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 rounded-md border border-gray-200 p-4 text-sm text-gray-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Course Code</p>
            <p className="font-medium text-gray-900">{code}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Course Name</p>
            <p className="font-medium text-gray-900">{name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Academic Term</p>
            <p className="font-medium text-gray-900">
              {academicYear} - {semester}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Description</p>
            <p className="text-gray-900">{description.trim() || 'No description provided.'}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0 || isSubmitting}
          className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        {isLastStep ? (
          <button
            type="submit"
            onClick={() => setSubmitIntent(true)}
            disabled={isSubmitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Course'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        )}
      </div>
    </form>
  );
}
