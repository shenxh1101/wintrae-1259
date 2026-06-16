import {
  CreateTaskRequest,
  SubmittedAnswer,
  GradingResult,
  StudentFeedback,
  TeacherCommentDraft,
  ClassSummaryMetrics,
  TaskSubmissionResult,
  BatchGradingRequest,
  BatchGradingResult,
  GradingTask,
  QuestionRule,
  ValidationResult,
  RetryPolicy,
  QuestionTag,
  QuestionType,
  FilteredSummaryView,
  ExportOptions,
  BatchFeedbackRequest,
  BatchFeedbackResult,
} from './types';

import { QuestionRuleEngine } from './core/QuestionRuleEngine';
import { InputValidator } from './core/InputValidator';
import { TaskManager } from './core/TaskManager';
import { GradingEngine } from './grading/GradingEngine';
import { StudentFeedbackGenerator } from './feedback/StudentFeedbackGenerator';
import { TeacherCommentGenerator } from './feedback/TeacherCommentGenerator';
import { BatchFeedbackGenerator } from './feedback/BatchFeedbackGenerator';
import {
  ClassSummaryGenerator,
  ClassSummaryContext,
} from './analytics/ClassSummaryGenerator';

export * from './types';

export interface HomeworkGradingSDKOptions {
  defaultRetryPolicy?: RetryPolicy;
}

export class HomeworkGradingSDK {
  private ruleEngine: QuestionRuleEngine;
  private inputValidator: InputValidator;
  private taskManager: TaskManager;
  private gradingEngine: GradingEngine;
  private studentFeedbackGenerator: StudentFeedbackGenerator;
  private teacherCommentGenerator: TeacherCommentGenerator;
  private batchFeedbackGenerator: BatchFeedbackGenerator;
  private classSummaryGenerator: ClassSummaryGenerator;
  private options: HomeworkGradingSDKOptions;

  constructor(options: HomeworkGradingSDKOptions = {}) {
    this.options = options;
    this.ruleEngine = new QuestionRuleEngine();
    this.inputValidator = new InputValidator();
    this.taskManager = new TaskManager(this.ruleEngine);
    this.gradingEngine = new GradingEngine(this.ruleEngine);
    this.studentFeedbackGenerator = new StudentFeedbackGenerator();
    this.teacherCommentGenerator = new TeacherCommentGenerator();
    this.batchFeedbackGenerator = new BatchFeedbackGenerator();
    this.classSummaryGenerator = new ClassSummaryGenerator();
  }

  createTask(request: CreateTaskRequest): GradingTask {
    if (this.options.defaultRetryPolicy && !request.retryPolicy) {
      request = { ...request, retryPolicy: this.options.defaultRetryPolicy };
    }
    return this.taskManager.createTask(request);
  }

  submitAnswer(
    taskId: string,
    answer: SubmittedAnswer,
  ): TaskSubmissionResult {
    return this.taskManager.submitAnswer(taskId, answer);
  }

  gradeSubmission(
    taskId: string,
    studentId: string,
    questionId: string,
  ): GradingResult {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const submissions = this.taskManager.getStudentSubmissions(
      taskId,
      studentId,
      questionId,
    );
    if (submissions.length === 0) {
      throw new Error(`未找到学生 ${studentId} 在题目 ${questionId} 的提交记录`);
    }

    const latestSubmission = submissions[submissions.length - 1];
    const result = this.gradingEngine.grade(latestSubmission);

    const penalizedScore = this.taskManager.calculatePenalty(
      taskId,
      studentId,
      questionId,
      result.earnedScore,
    );

    if (penalizedScore !== result.earnedScore) {
      result.earnedScore = penalizedScore;
      result.percentage =
        result.totalScore > 0
          ? (result.earnedScore / result.totalScore) * 100
          : 0;
      result.passed = result.earnedScore >= (task.questions.find(q => q.questionId === questionId)?.passScore || 0);
    }

    const studentResults = task.gradingResults.get(studentId) || new Map();
    studentResults.set(questionId, result);
    task.gradingResults.set(studentId, studentResults);

    task.status = 'grading';

    return result;
  }

  gradeBatch(request: BatchGradingRequest): BatchGradingResult {
    const task = this.taskManager.getTask(request.taskId);
    if (!task) {
      throw new Error(`任务 ${request.taskId} 不存在`);
    }

    const result = this.gradingEngine.gradeBatch(request);

    for (const gradingResult of result.results) {
      const penalizedScore = this.taskManager.calculatePenalty(
        request.taskId,
        gradingResult.studentId,
        gradingResult.questionId,
        gradingResult.earnedScore,
      );

      if (penalizedScore !== gradingResult.earnedScore) {
        gradingResult.earnedScore = penalizedScore;
        gradingResult.percentage =
          gradingResult.totalScore > 0
            ? (gradingResult.earnedScore / gradingResult.totalScore) * 100
            : 0;
        const questionRule = task.questions.find(
          q => q.questionId === gradingResult.questionId,
        );
        gradingResult.passed =
          gradingResult.earnedScore >= (questionRule?.passScore || 0);
      }

      const studentResults =
        task.gradingResults.get(gradingResult.studentId) || new Map();
      studentResults.set(gradingResult.questionId, gradingResult);
      task.gradingResults.set(gradingResult.studentId, studentResults);
    }

    task.status = 'completed';

    return result;
  }

  getGradingResult(
    taskId: string,
    studentId: string,
    questionId: string,
  ): GradingResult | undefined {
    const task = this.taskManager.getTask(taskId);
    if (!task) return undefined;

    const studentResults = task.gradingResults.get(studentId);
    return studentResults?.get(questionId);
  }

  getAllGradingResults(taskId: string, studentId: string): GradingResult[] {
    const task = this.taskManager.getTask(taskId);
    if (!task) return [];

    const studentResults = task.gradingResults.get(studentId);
    if (!studentResults) return [];

    return Array.from(studentResults.values());
  }

  generateStudentFeedback(
    taskId: string,
    studentId: string,
    questionId: string,
  ): StudentFeedback {
    const result = this.getGradingResult(taskId, studentId, questionId);
    if (!result) {
      throw new Error(`未找到批改结果，请先调用 gradeSubmission 进行批改`);
    }

    const feedback = this.studentFeedbackGenerator.generate(result);

    const task = this.taskManager.getTask(taskId);
    if (task) {
      const studentFeedbacks = task.feedbacks.get(studentId) || new Map();
      studentFeedbacks.set(questionId, feedback);
      task.feedbacks.set(studentId, studentFeedbacks);
    }

    return feedback;
  }

  generateTeacherComment(
    taskId: string,
    studentId: string,
    questionId: string,
  ): TeacherCommentDraft {
    const result = this.getGradingResult(taskId, studentId, questionId);
    if (!result) {
      throw new Error(`未找到批改结果，请先调用 gradeSubmission 进行批改`);
    }

    const comment = this.teacherCommentGenerator.generate(result);

    const task = this.taskManager.getTask(taskId);
    if (task) {
      const studentComments = task.teacherComments.get(studentId) || new Map();
      studentComments.set(questionId, comment);
      task.teacherComments.set(studentId, studentComments);
    }

    return comment;
  }

  generateBatchFeedback(request: BatchFeedbackRequest): BatchFeedbackResult {
    const task = this.taskManager.getTask(request.taskId);
    if (!task) {
      throw new Error(`任务 ${request.taskId} 不存在`);
    }
    return this.batchFeedbackGenerator.generate(request, task);
  }

  formatBatchFeedback(result: BatchFeedbackResult): string {
    return this.batchFeedbackGenerator.formatBatchResult(result);
  }

  getStudentFeedback(
    taskId: string,
    studentId: string,
    questionId: string,
  ): StudentFeedback | undefined {
    const task = this.taskManager.getTask(taskId);
    if (!task) return undefined;

    const studentFeedbacks = task.feedbacks.get(studentId);
    return studentFeedbacks?.get(questionId);
  }

  getTeacherComment(
    taskId: string,
    studentId: string,
    questionId: string,
  ): TeacherCommentDraft | undefined {
    const task = this.taskManager.getTask(taskId);
    if (!task) return undefined;

    const studentComments = task.teacherComments.get(studentId);
    return studentComments?.get(questionId);
  }

  generateClassSummary(
    taskId: string,
    classId: string,
    totalStudents: number,
  ): ClassSummaryMetrics {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const allResults: GradingResult[] = [];
    for (const studentResults of task.gradingResults.values()) {
      allResults.push(...studentResults.values());
    }

    const context: ClassSummaryContext = {
      taskId,
      taskTitle: task.title,
      classId,
      totalStudents,
      results: allResults,
      questionRules: task.questions,
    };

    return this.classSummaryGenerator.generate(context);
  }

  generateFilteredSummaryByTag(
    taskId: string,
    classId: string,
    totalStudents: number,
    tag: QuestionTag,
  ): FilteredSummaryView {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const allResults: GradingResult[] = [];
    for (const studentResults of task.gradingResults.values()) {
      allResults.push(...studentResults.values());
    }

    const context: ClassSummaryContext = {
      taskId,
      taskTitle: task.title,
      classId,
      totalStudents,
      results: allResults,
      questionRules: task.questions,
    };

    return this.classSummaryGenerator.generateFilteredViewByTag(context, tag);
  }

  generateFilteredSummaryByQuestionType(
    taskId: string,
    classId: string,
    totalStudents: number,
    questionType: QuestionType,
  ): FilteredSummaryView {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const allResults: GradingResult[] = [];
    for (const studentResults of task.gradingResults.values()) {
      allResults.push(...studentResults.values());
    }

    const context: ClassSummaryContext = {
      taskId,
      taskTitle: task.title,
      classId,
      totalStudents,
      results: allResults,
      questionRules: task.questions,
    };

    return this.classSummaryGenerator.generateFilteredViewByQuestionType(context, questionType);
  }

  formatClassSummary(summary: ClassSummaryMetrics): string {
    return this.classSummaryGenerator.formatSummary(summary);
  }

  formatFilteredSummary(view: FilteredSummaryView): string {
    return this.classSummaryGenerator.formatFilteredView(view);
  }

  exportClassSummary(
    summary: ClassSummaryMetrics,
    options?: ExportOptions,
  ): string {
    return this.classSummaryGenerator.exportForSharing(summary, options);
  }

  validateAnswer(
    questionId: string,
    answer: unknown,
  ): ValidationResult {
    return this.ruleEngine.validateAnswer(questionId, answer);
  }

  registerQuestionRule(rule: QuestionRule): void {
    this.ruleEngine.registerRule(rule);
  }

  registerQuestionRules(rules: QuestionRule[]): void {
    this.ruleEngine.registerRules(rules);
  }

  getQuestionRule(questionId: string): QuestionRule | undefined {
    return this.ruleEngine.getRule(questionId);
  }

  getTask(taskId: string): GradingTask | undefined {
    return this.taskManager.getTask(taskId);
  }

  getAllTasks(): GradingTask[] {
    return this.taskManager.getAllTasks();
  }

  getAttemptCount(
    taskId: string,
    studentId: string,
    questionId: string,
  ): number {
    return this.taskManager.getAttemptCount(taskId, studentId, questionId);
  }

  getRemainingAttempts(
    taskId: string,
    studentId: string,
    questionId: string,
  ): number {
    const task = this.taskManager.getTask(taskId);
    if (!task) return 0;

    const attemptCount = this.taskManager.getAttemptCount(
      taskId,
      studentId,
      questionId,
    );
    return Math.max(0, task.retryPolicy.maxAttempts - attemptCount);
  }

  deleteTask(taskId: string): boolean {
    return this.taskManager.deleteTask(taskId);
  }
}

export default HomeworkGradingSDK;
