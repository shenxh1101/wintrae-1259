import { ErrorCategory, KeywordMatch, StepScore } from './grading';
import { QuestionTag } from './question';

export interface StudentFeedback {
  questionId: string;
  studentId: string;
  overallMessage: string;
  strengths: string[];
  improvements: string[];
  stepFeedback: StepFeedback[];
  keywordFeedback: KeywordFeedback[];
  errorFeedback: ErrorFeedback[];
  suggestions: string[];
  encouragement: string;
  nextSteps: string[];
}

export interface StepFeedback {
  stepId: string;
  description: string;
  status: 'excellent' | 'good' | 'partial' | 'missing' | 'incorrect';
  message: string;
  earnedScore: number;
  maxScore: number;
}

export interface KeywordFeedback {
  word: string;
  matched: boolean;
  message: string;
  earnedScore: number;
  maxScore: number;
}

export interface ErrorFeedback {
  category: ErrorCategory;
  categoryName: string;
  description: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

export interface TeacherCommentDraft {
  questionId: string;
  studentId: string;
  overallComment: string;
  detailedComments: string[];
  positivePoints: string[];
  areasForImprovement: string[];
  suggestedGradeAdjustment?: string;
  followUpQuestions: string[];
  tags: string[];
  editable: boolean;
}

export interface ClassSummaryMetrics {
  classId: string;
  taskId: string;
  taskTitle?: string;
  totalStudents: number;
  submittedCount: number;
  submissionRate: number;
  averageScore: number;
  medianScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  excellentRate: number;
  averageAttempts: number;
  timeSpentAverage?: number;
  questionPerformance: QuestionPerformance[];
  tagPerformance: TagPerformance[];
  errorDistribution: ErrorDistribution[];
  commonErrors: CommonError[];
  generatedAt: Date;
}

export interface QuestionPerformance {
  questionId: string;
  averageScore: number;
  passRate: number;
  difficulty: number;
  discriminationIndex?: number;
}

export interface TagPerformance {
  tag: QuestionTag;
  tagName: string;
  averageScore: number;
  passRate: number;
  questionCount: number;
}

export interface ErrorDistribution {
  category: ErrorCategory;
  categoryName: string;
  count: number;
  percentage: number;
}

export interface CommonError {
  category: ErrorCategory;
  categoryName: string;
  description: string;
  occurrenceCount: number;
  affectedStudents: number;
  suggestion: string;
}
