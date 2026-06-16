import {
  QuestionRule,
  SubmittedAnswer,
  GradingResult,
  BatchGradingRequest,
  BatchGradingResult,
  AnswerValue,
} from '../types';
import { QuestionRuleEngine } from '../core/QuestionRuleEngine';
import { KeywordMatcher } from './KeywordMatcher';
import { StepGrader } from './StepGrader';
import { ErrorClassifier, ClassificationContext } from './ErrorClassifier';

export class GradingEngine {
  private ruleEngine: QuestionRuleEngine;
  private keywordMatcher: KeywordMatcher;
  private stepGrader: StepGrader;
  private errorClassifier: ErrorClassifier;

  constructor(ruleEngine: QuestionRuleEngine) {
    this.ruleEngine = ruleEngine;
    this.keywordMatcher = new KeywordMatcher();
    this.stepGrader = new StepGrader();
    this.errorClassifier = new ErrorClassifier();
  }

  grade(submission: SubmittedAnswer): GradingResult {
    const rule = this.ruleEngine.getRule(submission.questionId);
    if (!rule) {
      throw new Error(`未找到题目 ${submission.questionId} 的批改规则`);
    }

    const validation = this.ruleEngine.validateAnswer(
      submission.questionId,
      submission.answer,
    );
    if (!validation.valid) {
      return this.createInvalidResult(submission, rule, validation.errors.join('; '));
    }

    return this.gradeWithRule(submission, rule);
  }

  gradeBatch(request: BatchGradingRequest): BatchGradingResult {
    const results: GradingResult[] = [];

    for (const answer of request.answers) {
      try {
        const result = this.grade(answer);
        results.push(result);
      } catch (error) {
        results.push(this.createErrorResult(answer, String(error)));
      }
    }

    const totalGraded = results.length;
    const averageScore =
      totalGraded > 0
        ? results.reduce((sum, r) => sum + r.earnedScore, 0) / totalGraded
        : 0;
    const passCount = results.filter(r => r.passed).length;
    const passRate = totalGraded > 0 ? passCount / totalGraded : 0;

    return {
      taskId: request.taskId,
      results,
      totalGraded,
      averageScore,
      passRate,
      gradingCompletedAt: new Date(),
    };
  }

  private gradeWithRule(
    submission: SubmittedAnswer,
    rule: QuestionRule,
  ): GradingResult {
    let earnedScore = 0;

    const choiceTypes = ['single_choice', 'multiple_choice', 'true_false'];
    if (choiceTypes.includes(rule.questionType)) {
      earnedScore = this.gradeByAnswerType(submission.answer, rule);
    }

    const stepScores = rule.steps && !choiceTypes.includes(rule.questionType)
      ? this.stepGrader.grade(submission.answer, rule.steps)
      : undefined;
    const keywordMatches = rule.keywords && !choiceTypes.includes(rule.questionType)
      ? this.keywordMatcher.match(submission.answer, rule.keywords)
      : undefined;

    if (stepScores) {
      earnedScore += this.stepGrader.calculateStepScore(stepScores);
    }

    if (keywordMatches) {
      const missingRequired = this.keywordMatcher.checkRequiredKeywords(
        keywordMatches,
        rule.keywords!,
      );
      if (missingRequired.length > 0 && !rule.allowPartialScore) {
        earnedScore = 0;
      } else {
        earnedScore += this.keywordMatcher.calculateKeywordScore(keywordMatches);
      }
    }

    if (!stepScores && !keywordMatches && !choiceTypes.includes(rule.questionType)) {
      earnedScore = this.gradeByAnswerType(submission.answer, rule);
    }

    if (!rule.allowPartialScore && earnedScore < rule.totalScore) {
      earnedScore = earnedScore >= rule.passScore ? earnedScore : 0;
    }

    earnedScore = Math.min(earnedScore, rule.totalScore);
    const percentage =
      rule.totalScore > 0 ? (earnedScore / rule.totalScore) * 100 : 0;
    const passed = earnedScore >= rule.passScore;

    const correctAnswer = this.ruleEngine.getCorrectAnswer(rule.questionId) as AnswerValue;

    const errorContext: ClassificationContext = {
      answer: submission.answer,
      correctAnswer,
      stepScores,
      keywordMatches,
      earnedScore,
      totalScore: rule.totalScore,
    };
    const errors = this.errorClassifier.classify(errorContext);

    const isPartial =
      rule.allowPartialScore &&
      earnedScore > 0 &&
      earnedScore < rule.totalScore;

    return {
      questionId: rule.questionId,
      studentId: submission.studentId,
      earnedScore,
      totalScore: rule.totalScore,
      percentage,
      passed,
      isPartial,
      attemptNumber: submission.attemptNumber,
      stepScores,
      keywordMatches,
      errors,
      correctAnswer,
      submittedAnswer: submission.answer,
      gradingTime: new Date(),
      tags: rule.tags,
    };
  }

  private gradeByAnswerType(
    answer: AnswerValue,
    rule: QuestionRule,
  ): number {
    const correctAnswer = this.ruleEngine.getCorrectAnswer(rule.questionId);

    switch (rule.questionType) {
      case 'single_choice':
        return this.gradeSingleChoice(answer, correctAnswer, rule.totalScore);
      case 'multiple_choice':
        return this.gradeMultipleChoice(answer, correctAnswer, rule.totalScore);
      case 'true_false':
        return this.gradeTrueFalse(answer, correctAnswer, rule.totalScore);
      case 'fill_blank':
        return this.gradeFillBlank(answer, rule);
      case 'calculation':
        return this.gradeCalculation(answer, correctAnswer, rule.totalScore);
      default:
        return this.gradeTextAnswer(answer, rule);
    }
  }

  private gradeSingleChoice(
    answer: AnswerValue,
    correct: unknown,
    totalScore: number,
  ): number {
    return String(answer) === String(correct) ? totalScore : 0;
  }

  private gradeMultipleChoice(
    answer: AnswerValue,
    correct: unknown,
    totalScore: number,
  ): number {
    if (!Array.isArray(answer) || !Array.isArray(correct)) return 0;

    const answerSet = new Set(answer.map(String));
    const correctSet = new Set(correct.map(String));

    if (answerSet.size === correctSet.size &&
      [...answerSet].every(a => correctSet.has(a))) {
      return totalScore;
    }

    const correctSelected = [...answerSet].filter(a => correctSet.has(a)).length;
    const wrongSelected = [...answerSet].filter(a => !correctSet.has(a)).length;
    const missedCorrect = [...correctSet].filter(c => !answerSet.has(c)).length;

    const accuracy = correctSelected / (correctSelected + wrongSelected + missedCorrect);
    return Math.round(totalScore * accuracy);
  }

  private gradeTrueFalse(
    answer: AnswerValue,
    correct: unknown,
    totalScore: number,
  ): number {
    return answer === correct ? totalScore : 0;
  }

  private gradeFillBlank(answer: AnswerValue, rule: QuestionRule): number {
    if (typeof answer !== 'string') return 0;

    const acceptedAnswers = rule.acceptedAnswers || [];
    if (rule.correctAnswer !== undefined) {
      acceptedAnswers.push(String(rule.correctAnswer));
    }

    const normalizedAnswer = answer.trim().toLowerCase();

    for (const accepted of acceptedAnswers) {
      if (normalizedAnswer === accepted.trim().toLowerCase()) {
        return rule.totalScore;
      }
    }

    for (const accepted of acceptedAnswers) {
      if (normalizedAnswer.includes(accepted.trim().toLowerCase())) {
        return Math.round(rule.totalScore * 0.7);
      }
    }

    return 0;
  }

  private gradeCalculation(
    answer: AnswerValue,
    correct: unknown,
    totalScore: number,
  ): number {
    const numAnswer = typeof answer === 'number' ? answer : parseFloat(String(answer));
    const numCorrect = typeof correct === 'number' ? correct : parseFloat(String(correct));

    if (isNaN(numAnswer) || isNaN(numCorrect)) return 0;

    const tolerance = 0.01 * Math.abs(numCorrect);
    if (Math.abs(numAnswer - numCorrect) <= tolerance) {
      return totalScore;
    }

    const difference = Math.abs(numAnswer - numCorrect) / Math.abs(numCorrect);
    if (difference <= 0.05) {
      return Math.round(totalScore * 0.8);
    } else if (difference <= 0.1) {
      return Math.round(totalScore * 0.5);
    }

    return 0;
  }

  private gradeTextAnswer(answer: AnswerValue, rule: QuestionRule): number {
    if (typeof answer !== 'string') return 0;

    const wordCount = answer.trim().split(/\s+/).filter(w => w.length > 0).length;
    const minWords = rule.validation?.minLength || 10;

    if (wordCount >= minWords * 2) {
      return Math.round(rule.totalScore * 0.6);
    } else if (wordCount >= minWords) {
      return Math.round(rule.totalScore * 0.3);
    }

    return 0;
  }

  private createInvalidResult(
    submission: SubmittedAnswer,
    rule: QuestionRule,
    error: string,
  ): GradingResult {
    return {
      questionId: rule.questionId,
      studentId: submission.studentId,
      earnedScore: 0,
      totalScore: rule.totalScore,
      percentage: 0,
      passed: false,
      isPartial: false,
      attemptNumber: submission.attemptNumber,
      errors: [{
        category: 'format_error',
        description: error,
        severity: 'high',
        suggestion: '请按照题目要求的格式提交答案',
      }],
      submittedAnswer: submission.answer,
      gradingTime: new Date(),
      tags: rule.tags,
    };
  }

  private createErrorResult(
    submission: SubmittedAnswer,
    error: string,
  ): GradingResult {
    return {
      questionId: submission.questionId,
      studentId: submission.studentId,
      earnedScore: 0,
      totalScore: 0,
      percentage: 0,
      passed: false,
      isPartial: false,
      attemptNumber: submission.attemptNumber,
      errors: [{
        category: 'format_error',
        description: `批改失败: ${error}`,
        severity: 'high',
        suggestion: '请联系管理员或稍后重试',
      }],
      submittedAnswer: submission.answer,
      gradingTime: new Date(),
      tags: [],
    };
  }
}
