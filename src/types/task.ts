import { QuestionRule } from './question';
import { SubmittedAnswer, GradingResult } from './grading';
import { StudentFeedback, TeacherCommentDraft } from './feedback';

export type TaskStatus =
  | 'created'
  | 'waiting_for_submission'
  | 'grading'
  | 'completed'
  | 'failed';

export interface RetryPolicy {
  maxAttempts: number;
  delayMs?: number;
  allowRetryAfterFail: boolean;
  scorePenaltyPerAttempt?: number;
  maxPenaltyPercentage?: number;
}

export interface CreateTaskRequest {
  taskId: string;
  classId?: string;
  title: string;
  description?: string;
  questions: QuestionRule[];
  retryPolicy?: RetryPolicy;
  deadline?: Date;
  metadata?: Record<string, unknown>;
}

export interface GradingTask {
  taskId: string;
  classId?: string;
  title: string;
  description?: string;
  questions: QuestionRule[];
  retryPolicy: RetryPolicy;
  status: TaskStatus;
  submissions: Map<string, SubmittedAnswer[]>;
  gradingResults: Map<string, Map<string, GradingResult>>;
  feedbacks: Map<string, Map<string, StudentFeedback>>;
  teacherComments: Map<string, Map<string, TeacherCommentDraft>>;
  deadline?: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TaskSubmissionResult {
  taskId: string;
  studentId: string;
  accepted: boolean;
  attemptNumber: number;
  message: string;
  remainingAttempts: number;
  nextAttemptAllowed: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
