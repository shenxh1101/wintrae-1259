export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'short_answer'
  | 'essay'
  | 'calculation'
  | 'coding';

export type QuestionTag =
  | 'foundation'
  | 'advanced'
  | 'comprehensive'
  | 'application'
  | 'analysis'
  | 'critical_thinking'
  | 'algorithm'
  | 'grammar'
  | 'vocabulary'
  | 'problem_solving';

export interface QuestionOption {
  id: string;
  content: string;
  isCorrect?: boolean;
}

export interface StepRule {
  id: string;
  description: string;
  score: number;
  expectedContent?: string;
  keywords?: string[];
}

export interface KeywordRule {
  word: string;
  score: number;
  required?: boolean;
  synonym?: string[];
  caseSensitive?: boolean;
}

export interface InputValidationRule {
  type: 'string' | 'number' | 'array' | 'boolean' | 'code';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  allowedValues?: string[];
  required?: boolean;
}

export interface QuestionRule {
  questionId: string;
  questionType: QuestionType;
  tags: QuestionTag[];
  totalScore: number;
  passScore: number;
  options?: QuestionOption[];
  correctAnswer?: string | string[] | number | boolean;
  acceptedAnswers?: string[];
  steps?: StepRule[];
  keywords?: KeywordRule[];
  validation?: InputValidationRule;
  allowPartialScore: boolean;
  explanation?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedTime?: number;
}
