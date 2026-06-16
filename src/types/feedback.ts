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

export type OverallAssessmentLevel =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'insufficient_data';

export interface OverallAssessment {
  level: OverallAssessmentLevel;
  levelLabel: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  actionItems: string[];
}

export interface ScoreDistribution {
  excellentCount: number;
  excellentRate: number;
  goodCount: number;
  goodRate: number;
  passCount: number;
  passRate: number;
  failCount: number;
  failRate: number;
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
  overallAssessment: OverallAssessment;
  scoreDistribution: ScoreDistribution;
  questionPerformance: QuestionPerformance[];
  tagPerformance: TagPerformance[];
  errorDistribution: ErrorDistribution[];
  commonErrors: CommonError[];
  generatedAt: Date;
}

export interface FilteredSummaryView {
  filterType: 'tag' | 'questionType';
  filterValue: string;
  filterLabel: string;
  totalQuestions: number;
  answeredStudents: number;
  averageScore: number;
  passRate: number;
  weakPoints: WeakPoint[];
  questionPerformance: QuestionPerformance[];
  commonErrors: CommonError[];
}

export interface WeakPoint {
  name: string;
  impactCount: number;
  impactRate: number;
  relatedErrors: string[];
  suggestion: string;
}

export interface BatchFeedbackRequest {
  taskId: string;
  studentIds: string[];
  questionIds?: string[];
}

export interface BatchFeedbackResult {
  taskId: string;
  taskTitle?: string;
  totalStudents: number;
  totalQuestions: number;
  perStudent: PerStudentFeedback[];
  perQuestion: PerQuestionFeedback[];
}

export interface PerStudentFeedback {
  studentId: string;
  totalScore: number;
  maxScore: number;
  overallPercentage: number;
  passed: boolean;
  questionResults: PerQuestionResult[];
  studentFeedback: Record<string, StudentFeedback>;
  teacherComment: Record<string, TeacherCommentDraft>;
}

export interface PerQuestionResult {
  questionId: string;
  earnedScore: number;
  totalScore: number;
  passed: boolean;
  percentage: number;
}

export interface PerQuestionFeedback {
  questionId: string;
  totalStudents: number;
  answeredCount: number;
  averageScore: number;
  passRate: number;
  excellentRate: number;
}

export type ExportFormat = 'class_notice' | 'teaching_group' | 'simple';

export interface ExportOptions {
  format?: ExportFormat;
  includeScoreDistribution?: boolean;
  includeWeakPoints?: boolean;
  includeActionItems?: boolean;
  customHeader?: string;
  customFooter?: string;
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
