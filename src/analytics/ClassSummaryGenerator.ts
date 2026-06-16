import {
  ClassSummaryMetrics,
  QuestionPerformance,
  TagPerformance,
  ErrorDistribution,
  CommonError,
  GradingResult,
  QuestionTag,
  ErrorCategory,
  QuestionRule,
} from '../types';
import { ErrorClassifier } from '../grading/ErrorClassifier';

export interface ClassSummaryContext {
  taskId: string;
  taskTitle?: string;
  classId: string;
  totalStudents: number;
  results: GradingResult[];
  questionRules: QuestionRule[];
}

export class ClassSummaryGenerator {
  private errorClassifier: ErrorClassifier = new ErrorClassifier();

  private tagNames: Record<QuestionTag, string> = {
    foundation: '基础题',
    advanced: '提高题',
    comprehensive: '综合题',
    application: '应用题',
    analysis: '分析题',
    critical_thinking: '批判性思维',
    algorithm: '算法',
    grammar: '语法',
    vocabulary: '词汇',
    problem_solving: '问题解决',
  };

  generate(context: ClassSummaryContext): ClassSummaryMetrics {
    const { taskId, taskTitle, classId, totalStudents, results, questionRules } = context;

    const submittedCount = this.countSubmittedStudents(results);
    const submissionRate = totalStudents > 0 ? submittedCount / totalStudents : 0;

    const allScores = results.map(r => r.earnedScore);
    const totalScores = results.map(r => r.totalScore);
    const maxTotalScore = Math.max(...totalScores, 1);

    const averageScore =
      submittedCount > 0
        ? allScores.reduce((sum, s) => sum + s, 0) / submittedCount
        : 0;
    const medianScore = this.calculateMedian(allScores);
    const highestScore = Math.max(...allScores, 0);
    const lowestScore = Math.min(...allScores, 0);

    const passCount = results.filter(r => r.passed).length;
    const passRate = submittedCount > 0 ? passCount / submittedCount : 0;

    const excellentCount = results.filter(r => r.percentage >= 90).length;
    const excellentRate = submittedCount > 0 ? excellentCount / submittedCount : 0;

    const averageAttempts =
      submittedCount > 0
        ? results.reduce((sum, r) => sum + r.attemptNumber, 0) / submittedCount
        : 0;

    const questionPerformance = this.generateQuestionPerformance(
      results,
      questionRules,
    );
    const tagPerformance = this.generateTagPerformance(results, questionRules);
    const errorDistribution = this.generateErrorDistribution(results);
    const commonErrors = this.generateCommonErrors(results);

    return {
      classId,
      taskId,
      taskTitle,
      totalStudents,
      submittedCount,
      submissionRate,
      averageScore,
      medianScore,
      highestScore,
      lowestScore,
      passRate,
      excellentRate,
      averageAttempts,
      questionPerformance,
      tagPerformance,
      errorDistribution,
      commonErrors,
      generatedAt: new Date(),
    };
  }

  private countSubmittedStudents(results: GradingResult[]): number {
    const studentIds = new Set(results.map(r => r.studentId));
    return studentIds.size;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  private generateQuestionPerformance(
    results: GradingResult[],
    questionRules: QuestionRule[],
  ): QuestionPerformance[] {
    const questionMap = new Map<string, GradingResult[]>();

    for (const result of results) {
      if (!questionMap.has(result.questionId)) {
        questionMap.set(result.questionId, []);
      }
      questionMap.get(result.questionId)!.push(result);
    }

    return questionRules.map(rule => {
      const questionResults = questionMap.get(rule.questionId) || [];
      const scores = questionResults.map(r => r.earnedScore);
      const averageScore =
        questionResults.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / questionResults.length
          : 0;
      const passCount = questionResults.filter(r => r.passed).length;
      const passRate =
        questionResults.length > 0 ? passCount / questionResults.length : 0;

      return {
        questionId: rule.questionId,
        averageScore,
        passRate,
        difficulty: rule.difficulty,
        discriminationIndex: this.calculateDiscriminationIndex(
          questionResults,
          rule.totalScore,
        ),
      };
    });
  }

  private calculateDiscriminationIndex(
    results: GradingResult[],
    maxScore: number,
  ): number | undefined {
    if (results.length < 4) return undefined;

    const sorted = [...results].sort(
      (a, b) => b.earnedScore - a.earnedScore,
    );
    const groupSize = Math.floor(results.length / 4);
    const highGroup = sorted.slice(0, groupSize);
    const lowGroup = sorted.slice(-groupSize);

    const highAverage =
      highGroup.reduce((sum, r) => sum + r.earnedScore, 0) / highGroup.length;
    const lowAverage =
      lowGroup.reduce((sum, r) => sum + r.earnedScore, 0) / lowGroup.length;

    return maxScore > 0 ? (highAverage - lowAverage) / maxScore : 0;
  }

  private generateTagPerformance(
    results: GradingResult[],
    questionRules: QuestionRule[],
  ): TagPerformance[] {
    const tagMap = new Map<
      QuestionTag,
      { scores: number[]; passCount: number; total: number }
    >();

    for (const rule of questionRules) {
      for (const tag of rule.tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { scores: [], passCount: 0, total: 0 });
        }

        const questionResults = results.filter(
          r => r.questionId === rule.questionId,
        );
        const tagData = tagMap.get(tag)!;
        tagData.total += questionResults.length;

        for (const r of questionResults) {
          tagData.scores.push(r.earnedScore);
          if (r.passed) tagData.passCount++;
        }
      }
    }

    const performance: TagPerformance[] = [];
    const tagQuestionCount = new Map<QuestionTag, number>();

    for (const rule of questionRules) {
      for (const tag of rule.tags) {
        tagQuestionCount.set(tag, (tagQuestionCount.get(tag) || 0) + 1);
      }
    }

    for (const [tag, data] of tagMap.entries()) {
      const averageScore =
        data.total > 0
          ? data.scores.reduce((sum, s) => sum + s, 0) / data.total
          : 0;
      const passRate = data.total > 0 ? data.passCount / data.total : 0;

      performance.push({
        tag,
        tagName: this.tagNames[tag] || tag,
        averageScore,
        passRate,
        questionCount: tagQuestionCount.get(tag) || 0,
      });
    }

    return performance;
  }

  private generateErrorDistribution(
    results: GradingResult[],
  ): ErrorDistribution[] {
    const errorCount = new Map<ErrorCategory, number>();
    let totalErrors = 0;

    for (const result of results) {
      if (!result.errors) continue;
      for (const error of result.errors) {
        errorCount.set(error.category, (errorCount.get(error.category) || 0) + 1);
        totalErrors++;
      }
    }

    const distribution: ErrorDistribution[] = [];
    for (const [category, count] of errorCount.entries()) {
      distribution.push({
        category,
        categoryName: this.errorClassifier.getCategoryName(category),
        count,
        percentage: totalErrors > 0 ? count / totalErrors : 0,
      });
    }

    return distribution.sort((a, b) => b.count - a.count);
  }

  private generateCommonErrors(results: GradingResult[]): CommonError[] {
    const errorMap = new Map<
      string,
      {
        category: ErrorCategory;
        description: string;
        suggestion: string;
        occurrenceCount: number;
        affectedStudents: Set<string>;
      }
    >();

    for (const result of results) {
      if (!result.errors) continue;

      for (const error of result.errors) {
        const key = `${error.category}_${error.description}`;

        if (!errorMap.has(key)) {
          errorMap.set(key, {
            category: error.category,
            description: error.description,
            suggestion: error.suggestion || '',
            occurrenceCount: 0,
            affectedStudents: new Set(),
          });
        }

        const data = errorMap.get(key)!;
        data.occurrenceCount++;
        data.affectedStudents.add(result.studentId);
      }
    }

    const commonErrors: CommonError[] = [];
    for (const data of errorMap.values()) {
      commonErrors.push({
        category: data.category,
        categoryName: this.errorClassifier.getCategoryName(data.category),
        description: data.description,
        occurrenceCount: data.occurrenceCount,
        affectedStudents: data.affectedStudents.size,
        suggestion: data.suggestion,
      });
    }

    return commonErrors
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 10);
  }

  formatSummary(summary: ClassSummaryMetrics): string {
    const lines: string[] = [];

    lines.push(`=== 班级作业汇总报告 ===`);
    if (summary.taskTitle) {
      lines.push(`作业名称: ${summary.taskTitle}`);
    }
    lines.push(`班级: ${summary.classId}`);
    lines.push(`任务: ${summary.taskId}`);
    lines.push(`生成时间: ${summary.generatedAt.toLocaleString()}`);
    lines.push('');

    lines.push(`--- 整体情况 ---`);
    lines.push(`总学生数: ${summary.totalStudents}`);
    lines.push(`提交人数: ${summary.submittedCount}`);
    lines.push(`提交率: ${(summary.submissionRate * 100).toFixed(1)}%`);
    lines.push(`平均分: ${summary.averageScore.toFixed(1)}`);
    lines.push(`中位数: ${summary.medianScore.toFixed(1)}`);
    lines.push(`最高分: ${summary.highestScore}`);
    lines.push(`最低分: ${summary.lowestScore}`);
    lines.push(`及格率: ${(summary.passRate * 100).toFixed(1)}%`);
    lines.push(`优秀率: ${(summary.excellentRate * 100).toFixed(1)}%`);
    lines.push(`平均提交次数: ${summary.averageAttempts.toFixed(1)}`);
    lines.push('');

    if (summary.tagPerformance.length > 0) {
      lines.push(`--- 知识点掌握情况 ---`);
      for (const tag of summary.tagPerformance) {
        lines.push(
          `${tag.tagName} (${tag.questionCount}题): 平均分 ${tag.averageScore.toFixed(1)}, 正确率 ${(tag.passRate * 100).toFixed(1)}%`,
        );
      }
      lines.push('');
    }

    if (summary.commonErrors.length > 0) {
      lines.push(`--- 常见错误 ---`);
      for (let i = 0; i < Math.min(5, summary.commonErrors.length); i++) {
        const error = summary.commonErrors[i];
        lines.push(
          `${i + 1}. [${error.categoryName}] ${error.description} (${error.occurrenceCount}次, 影响${error.affectedStudents}人)`,
        );
      }
    }

    return lines.join('\n');
  }
}
