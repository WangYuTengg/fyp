/**
 * Late submission penalty calculation utilities.
 *
 * Pure functions — no DB or side-effect dependencies — so they are
 * straightforward to unit-test.
 */

export type LatePenaltyConfig = {
  type: 'none' | 'fixed' | 'per_day' | 'per_hour';
  value: number; // percentage (e.g. 10 means 10%)
  cap: number | null; // max penalty percentage, null = no cap
};

export type LatePenaltyResult = {
  adjustedScore: number;
  penaltyPercent: number;
  minutesLate: number;
  applied: boolean;
};

/**
 * Calculate the adjusted score after applying a late-submission penalty.
 *
 * @param rawScore      - The score before any late penalty
 * @param submittedAt   - When the submission was finalised
 * @param dueDate       - The assignment due date (or timer expiry)
 * @param config        - Penalty configuration from the assignment
 * @returns penalty details + adjusted score (never below 0)
 */
export function applyLatePenalty(
  rawScore: number,
  submittedAt: Date,
  dueDate: Date,
  config: LatePenaltyConfig,
): LatePenaltyResult {
  const NO_PENALTY: LatePenaltyResult = {
    adjustedScore: rawScore,
    penaltyPercent: 0,
    minutesLate: 0,
    applied: false,
  };

  if (config.type === 'none') return NO_PENALTY;

  const diffMs = submittedAt.getTime() - dueDate.getTime();
  if (diffMs <= 0) return NO_PENALTY; // submitted on time

  const minutesLate = diffMs / (1000 * 60);

  let penaltyPercent: number;

  switch (config.type) {
    case 'fixed':
      penaltyPercent = config.value;
      break;
    case 'per_day':
      penaltyPercent = Math.ceil(minutesLate / (60 * 24)) * config.value;
      break;
    case 'per_hour':
      penaltyPercent = Math.ceil(minutesLate / 60) * config.value;
      break;
    default:
      return NO_PENALTY;
  }

  // Apply cap if configured
  if (config.cap !== null && penaltyPercent > config.cap) {
    penaltyPercent = config.cap;
  }

  // Clamp penalty to 100%
  penaltyPercent = Math.min(penaltyPercent, 100);

  const adjustedScore = Math.max(0, rawScore * (1 - penaltyPercent / 100));

  return {
    adjustedScore: Math.round(adjustedScore * 100) / 100, // two decimal places
    penaltyPercent,
    minutesLate: Math.round(minutesLate * 100) / 100,
    applied: true,
  };
}

/**
 * Determine the effective due date for late-penalty purposes.
 *
 * If the assignment has a time limit, the deadline is whichever comes first:
 * the assignment due date or the timer expiry for that specific submission.
 */
export function getEffectiveDueDate(
  assignmentDueDate: Date | null,
  startedAt: Date | null,
  timeLimitMinutes: number | null,
): Date | null {
  const timerExpiry =
    startedAt && timeLimitMinutes
      ? new Date(startedAt.getTime() + timeLimitMinutes * 60 * 1000)
      : null;

  if (assignmentDueDate && timerExpiry) {
    return assignmentDueDate < timerExpiry ? assignmentDueDate : timerExpiry;
  }

  return assignmentDueDate ?? timerExpiry;
}

/**
 * Resolve the scoring submission from a list of attempts based on the method.
 */
export function resolveScoringSubmission<
  T extends { attemptNumber: number; totalScore?: number },
>(
  attempts: T[],
  method: 'latest' | 'highest',
): T | undefined {
  if (attempts.length === 0) return undefined;

  if (method === 'highest') {
    return attempts.reduce((best, current) =>
      (current.totalScore ?? 0) > (best.totalScore ?? 0) ? current : best
    );
  }

  // 'latest' — highest attempt number
  return attempts.reduce((best, current) =>
    current.attemptNumber > best.attemptNumber ? current : best
  );
}
