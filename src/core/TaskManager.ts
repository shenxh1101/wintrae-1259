import {
  CreateTaskRequest,
  GradingTask,
  TaskStatus,
  SubmittedAnswer,
  TaskSubmissionResult,
  RetryPolicy,
} from '../types';
import { QuestionRuleEngine } from './QuestionRuleEngine';

export class TaskManager {
  private tasks: Map<string, GradingTask> = new Map();
  private ruleEngine: QuestionRuleEngine;
  private defaultRetryPolicy: RetryPolicy = {
    maxAttempts: 3,
    allowRetryAfterFail: true,
    scorePenaltyPerAttempt: 0,
    maxPenaltyPercentage: 0,
  };

  constructor(ruleEngine: QuestionRuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  createTask(request: CreateTaskRequest): GradingTask {
    if (this.tasks.has(request.taskId)) {
      throw new Error(`任务 ${request.taskId} 已存在`);
    }

    this.ruleEngine.registerRules(request.questions);

    const retryPolicy = request.retryPolicy || this.defaultRetryPolicy;

    const task: GradingTask = {
      taskId: request.taskId,
      classId: request.classId,
      title: request.title,
      description: request.description,
      questions: request.questions,
      retryPolicy,
      status: 'created',
      submissions: new Map(),
      gradingResults: new Map(),
      feedbacks: new Map(),
      teacherComments: new Map(),
      deadline: request.deadline,
      createdAt: new Date(),
      metadata: request.metadata,
    };

    this.tasks.set(request.taskId, task);
    return task;
  }

  getTask(taskId: string): GradingTask | undefined {
    return this.tasks.get(taskId);
  }

  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }
    task.status = status;
  }

  submitAnswer(
    taskId: string,
    answer: SubmittedAnswer,
  ): TaskSubmissionResult {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        taskId,
        studentId: answer.studentId,
        accepted: false,
        attemptNumber: 0,
        message: `任务 ${taskId} 不存在`,
        remainingAttempts: 0,
        nextAttemptAllowed: false,
      };
    }

    if (task.deadline && new Date() > task.deadline) {
      return {
        taskId,
        studentId: answer.studentId,
        accepted: false,
        attemptNumber: 0,
        message: '已过提交截止时间',
        remainingAttempts: 0,
        nextAttemptAllowed: false,
      };
    }

    const studentSubmissions = task.submissions.get(answer.studentId) || [];
    const previousSubmissions = studentSubmissions.filter(
      s => s.questionId === answer.questionId,
    );
    const attemptNumber = previousSubmissions.length + 1;

    const retryCheck = this.checkRetryPolicy(
      task.retryPolicy,
      answer,
      previousSubmissions.length,
      task.gradingResults,
    );

    if (!retryCheck.allowed) {
      return {
        taskId,
        studentId: answer.studentId,
        accepted: false,
        attemptNumber,
        message: retryCheck.reason,
        remainingAttempts: 0,
        nextAttemptAllowed: false,
      };
    }

    const validation = this.ruleEngine.validateAnswer(
      answer.questionId,
      answer.answer,
    );
    if (!validation.valid) {
      return {
        taskId,
        studentId: answer.studentId,
        accepted: false,
        attemptNumber,
        message: `答案格式错误: ${validation.errors.join('; ')}`,
        remainingAttempts: task.retryPolicy.maxAttempts - attemptNumber,
        nextAttemptAllowed: attemptNumber < task.retryPolicy.maxAttempts,
      };
    }

    const submissionWithAttempt: SubmittedAnswer = {
      ...answer,
      attemptNumber,
      submissionTime: answer.submissionTime || new Date(),
    };

    studentSubmissions.push(submissionWithAttempt);
    task.submissions.set(answer.studentId, studentSubmissions);

    if (task.status === 'created') {
      task.status = 'waiting_for_submission';
    }

    const remainingAttempts = Math.max(
      0,
      task.retryPolicy.maxAttempts - attemptNumber,
    );

    return {
      taskId,
      studentId: answer.studentId,
      accepted: true,
      attemptNumber,
      message: '答案提交成功',
      remainingAttempts,
      nextAttemptAllowed: remainingAttempts > 0,
    };
  }

  private checkRetryPolicy(
    policy: RetryPolicy,
    answer: SubmittedAnswer,
    currentAttempts: number,
    gradingResults: Map<string, Map<string, unknown>>,
  ): { allowed: boolean; reason: string } {
    if (currentAttempts >= policy.maxAttempts) {
      return {
        allowed: false,
        reason: `已达到最大尝试次数 ${policy.maxAttempts}`,
      };
    }

    if (!policy.allowRetryAfterFail && currentAttempts > 0) {
      const studentResults = gradingResults.get(answer.studentId);
      if (studentResults) {
        const prevResult = studentResults.get(answer.questionId) as { passed?: boolean };
        if (prevResult && !prevResult.passed) {
          return {
            allowed: false,
            reason: '未通过的题目不允许重试',
          };
        }
      }
    }

    if (policy.delayMs && currentAttempts > 0) {
      return { allowed: true, reason: '' };
    }

    return { allowed: true, reason: '' };
  }

  getStudentSubmissions(
    taskId: string,
    studentId: string,
    questionId?: string,
  ): SubmittedAnswer[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];

    const submissions = task.submissions.get(studentId) || [];
    if (questionId) {
      return submissions.filter(s => s.questionId === questionId);
    }
    return submissions;
  }

  getAttemptCount(
    taskId: string,
    studentId: string,
    questionId: string,
  ): number {
    return this.getStudentSubmissions(taskId, studentId, questionId).length;
  }

  calculatePenalty(
    taskId: string,
    studentId: string,
    questionId: string,
    baseScore: number,
  ): number {
    const task = this.tasks.get(taskId);
    if (!task) return baseScore;

    const policy = task.retryPolicy;
    const attemptCount = this.getAttemptCount(taskId, studentId, questionId);

    if (attemptCount <= 1 || !policy.scorePenaltyPerAttempt) {
      return baseScore;
    }

    const penaltyAttempts = attemptCount - 1;
    const totalPenalty = penaltyAttempts * policy.scorePenaltyPerAttempt;

    if (policy.maxPenaltyPercentage && policy.maxPenaltyPercentage > 0) {
      const maxPenalty = baseScore * (policy.maxPenaltyPercentage / 100);
      const finalPenalty = Math.min(totalPenalty, maxPenalty);
      return Math.max(0, baseScore - finalPenalty);
    }

    return Math.max(0, baseScore - totalPenalty);
  }

  deleteTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  getAllTasks(): GradingTask[] {
    return Array.from(this.tasks.values());
  }
}
