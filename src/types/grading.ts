import { QuestionTag, StepRule } from './question';

export type AnswerValue = string | string[] | number | boolean | null;

export interface SubmittedAnswer {
  questionId: string;
  answer: AnswerValue;
  studentId: string;
  submissionTime: Date;
  attemptNumber: number;
  metadata?: Record<string, unknown>;
}

export interface StepScore {
  stepId: string;
  description: string;
  earnedScore: number;
  maxScore: number;
  passed: boolean;
  feedback?: string;
}

export interface KeywordMatch {
  word: string;
  matched: boolean;
  earnedScore: number;
  maxScore: number;
  position?: number;
  matchedSynonym?: string;
}

export type ErrorCategory =
  | 'conceptual_mistake'
  | 'calculation_error'
  | 'missing_step'
  | 'wrong_approach'
  | 'careless_mistake'
  | 'format_error'
  | 'incomplete_answer'
  | 'irrelevant_content'
  | 'grammar_error'
  | 'logic_error';

export interface ErrorInstance {
  category: ErrorCategory;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
  suggestion?: string;
}

export interface GradingResult {
  questionId: string;
  studentId: string;
  earnedScore: number;
  totalScore: number;
  percentage: number;
  passed: boolean;
  isPartial: boolean;
  attemptNumber: number;
  stepScores?: StepScore[];
  keywordMatches?: KeywordMatch[];
  errors?: ErrorInstance[];
  correctAnswer?: AnswerValue;
  submittedAnswer: AnswerValue;
  gradingTime: Date;
  tags: QuestionTag[];
}

export interface BatchGradingRequest {
  taskId: string;
  answers: SubmittedAnswer[];
  gradingMode: 'auto' | 'semi_auto' | 'manual';
}

export interface BatchGradingResult {
  taskId: string;
  results: GradingResult[];
  totalGraded: number;
  averageScore: number;
  passRate: number;
  gradingCompletedAt: Date;
}
