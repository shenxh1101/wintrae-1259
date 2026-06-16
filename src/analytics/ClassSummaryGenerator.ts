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
  QuestionType,
  OverallAssessment,
  OverallAssessmentLevel,
  ScoreDistribution,
  FilteredSummaryView,
  WeakPoint,
  ExportOptions,
  ExportFormat,
  StudentOverallScore,
  StudentFilteredDetail,
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

  private questionTypeNames: Record<QuestionType, string> = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    true_false: '判断题',
    fill_blank: '填空题',
    short_answer: '简答题',
    essay: '论述题',
    calculation: '计算题',
    coding: '编程题',
  };

  generate(context: ClassSummaryContext): ClassSummaryMetrics {
    const { taskId, taskTitle, classId, totalStudents, results, questionRules } = context;

    const studentScores = this.calculateStudentOverallScores(results, questionRules);
    const submittedStudents = studentScores.filter(s => s.answeredQuestionCount > 0);
    const submittedCount = submittedStudents.length;
    const submissionRate = totalStudents > 0 ? submittedCount / totalStudents : 0;

    const percentages = submittedStudents.map(s => s.percentage);
    const averagePercentage =
      submittedCount > 0
        ? percentages.reduce((s, v) => s + v, 0) / submittedCount
        : 0;
    const totalMaxScore = questionRules.reduce((s, q) => s + q.totalScore, 0);
    const averageScore = (averagePercentage / 100) * totalMaxScore;

    const medianPercentage = this.calculateMedian(percentages);
    const medianScore = (medianPercentage / 100) * totalMaxScore;

    const highestPercentage = percentages.length > 0 ? Math.max(...percentages) : 0;
    const lowestPercentage = percentages.length > 0 ? Math.min(...percentages) : 0;
    const highestScore = (highestPercentage / 100) * totalMaxScore;
    const lowestScore = (lowestPercentage / 100) * totalMaxScore;

    const passRate = submittedCount > 0
      ? submittedStudents.filter(s => s.passed).length / submittedCount
      : 0;
    const excellentRate = submittedCount > 0
      ? submittedStudents.filter(s => s.percentage >= 90).length / submittedCount
      : 0;

    const averageAttempts =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.attemptNumber, 0) / results.length
        : 0;

    const scoreDistribution = this.calculateScoreDistributionByStudent(submittedStudents);
    const questionPerformance = this.generateQuestionPerformance(results, questionRules);
    const tagPerformance = this.generateTagPerformance(results, questionRules);
    const errorDistribution = this.generateErrorDistribution(results);
    const commonErrors = this.generateCommonErrors(results);
    const overallAssessment = this.generateOverallAssessment(
      passRate,
      excellentRate,
      averagePercentage,
      submissionRate,
      commonErrors,
      tagPerformance,
    );

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
      overallAssessment,
      scoreDistribution,
      studentScores,
      questionPerformance,
      tagPerformance,
      errorDistribution,
      commonErrors,
      generatedAt: new Date(),
    };
  }

  private calculateStudentOverallScores(
    results: GradingResult[],
    questionRules: QuestionRule[],
  ): StudentOverallScore[] {
    const studentMap = new Map<string, { earned: number; max: number; answered: Set<string> }>();
    const totalMax = questionRules.reduce((s, q) => s + q.totalScore, 0);

    for (const r of results) {
      if (!studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, { earned: 0, max: totalMax, answered: new Set() });
      }
      const data = studentMap.get(r.studentId)!;
      data.earned += r.earnedScore;
      data.answered.add(r.questionId);
    }

    const scores: StudentOverallScore[] = [];
    for (const [studentId, data] of studentMap.entries()) {
      const percentage = data.max > 0 ? (data.earned / data.max) * 100 : 0;
      scores.push({
        studentId,
        totalEarned: data.earned,
        totalMax: data.max,
        percentage,
        passed: percentage >= 60,
        answeredQuestionCount: data.answered.size,
      });
    }
    return scores;
  }

  private calculateScoreDistributionByStudent(students: StudentOverallScore[]): ScoreDistribution {
    const total = students.length || 1;
    let excellentCount = 0, goodCount = 0, passCount = 0, failCount = 0;

    for (const s of students) {
      if (s.percentage >= 90) excellentCount++;
      else if (s.percentage >= 75) goodCount++;
      else if (s.percentage >= 60) passCount++;
      else failCount++;
    }

    return {
      excellentCount, excellentRate: excellentCount / total,
      goodCount, goodRate: goodCount / total,
      passCount, passRate: passCount / total,
      failCount, failRate: failCount / total,
    };
  }

  generateFilteredViewByTag(
    context: ClassSummaryContext,
    tag: QuestionTag,
  ): FilteredSummaryView {
    const { results, questionRules, totalStudents } = context;
    const filteredRules = questionRules.filter(r => r.tags.includes(tag));
    const filteredQuestionIds = new Set(filteredRules.map(r => r.questionId));
    const filteredResults = results.filter(r => filteredQuestionIds.has(r.questionId));

    const answeredStudents = this.countSubmittedStudents(filteredResults);
    const studentDetails = this.buildStudentFilteredDetails(filteredResults, filteredRules);
    const avgPct = studentDetails.length > 0
      ? studentDetails.reduce((s, d) => s + d.percentage, 0) / studentDetails.length
      : 0;
    const totalMax = filteredRules.reduce((s, q) => s + q.totalScore, 0);
    const averageScore = (avgPct / 100) * totalMax;
    const passRate = studentDetails.length > 0
      ? studentDetails.filter(d => d.passed).length / studentDetails.length
      : 0;

    const questionPerformance = this.generateQuestionPerformance(filteredResults, filteredRules);
    const commonErrors = this.generateCommonErrors(filteredResults);
    const weakPoints = this.identifyWeakPoints(commonErrors, questionPerformance, answeredStudents);
    const suggestedTeachingOrder = this.suggestTeachingOrder(questionPerformance, commonErrors);

    return {
      filterType: 'tag',
      filterValue: tag,
      filterLabel: this.tagNames[tag] || tag,
      totalQuestions: filteredRules.length,
      answeredStudents,
      averageScore,
      passRate,
      weakPoints,
      questionPerformance,
      commonErrors,
      studentDetails,
      suggestedTeachingOrder,
    };
  }

  generateFilteredViewByQuestionType(
    context: ClassSummaryContext,
    questionType: QuestionType,
  ): FilteredSummaryView {
    const { results, questionRules, totalStudents } = context;
    const filteredRules = questionRules.filter(r => r.questionType === questionType);
    const filteredQuestionIds = new Set(filteredRules.map(r => r.questionId));
    const filteredResults = results.filter(r => filteredQuestionIds.has(r.questionId));

    const answeredStudents = this.countSubmittedStudents(filteredResults);
    const studentDetails = this.buildStudentFilteredDetails(filteredResults, filteredRules);
    const avgPct = studentDetails.length > 0
      ? studentDetails.reduce((s, d) => s + d.percentage, 0) / studentDetails.length
      : 0;
    const totalMax = filteredRules.reduce((s, q) => s + q.totalScore, 0);
    const averageScore = (avgPct / 100) * totalMax;
    const passRate = studentDetails.length > 0
      ? studentDetails.filter(d => d.passed).length / studentDetails.length
      : 0;

    const questionPerformance = this.generateQuestionPerformance(filteredResults, filteredRules);
    const commonErrors = this.generateCommonErrors(filteredResults);
    const weakPoints = this.identifyWeakPoints(commonErrors, questionPerformance, answeredStudents);
    const suggestedTeachingOrder = this.suggestTeachingOrder(questionPerformance, commonErrors);

    return {
      filterType: 'questionType',
      filterValue: questionType,
      filterLabel: this.questionTypeNames[questionType] || questionType,
      totalQuestions: filteredRules.length,
      answeredStudents,
      averageScore,
      passRate,
      weakPoints,
      questionPerformance,
      commonErrors,
      studentDetails,
      suggestedTeachingOrder,
    };
  }

  private buildStudentFilteredDetails(
    results: GradingResult[],
    filteredRules: QuestionRule[],
  ): StudentFilteredDetail[] {
    const byStudent = new Map<string, GradingResult[]>();
    for (const r of results) {
      if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
      byStudent.get(r.studentId)!.push(r);
    }

    const totalMax = filteredRules.reduce((s, q) => s + q.totalScore, 0);
    const details: StudentFilteredDetail[] = [];

    for (const [studentId, studentResults] of byStudent.entries()) {
      const earned = studentResults.reduce((s, r) => s + r.earnedScore, 0);
      const percentage = totalMax > 0 ? (earned / totalMax) * 100 : 0;

      const weakQuestions = studentResults
        .filter(r => !r.passed || r.percentage < 60)
        .map(r => ({
          questionId: r.questionId,
          earnedScore: r.earnedScore,
          totalScore: r.totalScore,
          passRate: r.percentage,
        }))
        .sort((a, b) => a.passRate - b.passRate);

      const errorCount = new Map<string, { category: string; description: string; count: number }>();
      for (const r of studentResults) {
        if (!r.errors) continue;
        for (const e of r.errors) {
          const key = `${e.category}_${e.description}`;
          if (!errorCount.has(key)) {
            errorCount.set(key, {
              category: this.errorClassifier.getCategoryName(e.category),
              description: e.description,
              count: 0,
            });
          }
          errorCount.get(key)!.count++;
        }
      }
      const mainErrors = Array.from(errorCount.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      details.push({
        studentId,
        totalEarned: earned,
        totalMax,
        percentage,
        passed: percentage >= 60,
        weakQuestions,
        mainErrors,
      });
    }

    return details.sort((a, b) => a.percentage - b.percentage);
  }

  private suggestTeachingOrder(
    questionPerformance: QuestionPerformance[],
    commonErrors: CommonError[],
  ): { questionId: string; priority: 'high' | 'medium' | 'low'; reason: string }[] {
    const result: { questionId: string; priority: 'high' | 'medium' | 'low'; reason: string }[] = [];

    const sorted = [...questionPerformance].sort((a, b) => a.passRate - b.passRate);

    for (const qp of sorted) {
      let priority: 'high' | 'medium' | 'low';
      let reason = '';

      if (qp.passRate < 0.5) {
        priority = 'high';
        reason = `正确率仅${(qp.passRate * 100).toFixed(0)}%，多数学生未掌握，需优先讲解`;
      } else if (qp.passRate < 0.75) {
        priority = 'medium';
        reason = `正确率${(qp.passRate * 100).toFixed(0)}%，部分学生存在疑问，建议复习`;
      } else {
        priority = 'low';
        reason = `正确率${(qp.passRate * 100).toFixed(0)}%，掌握较好，可略讲或跳过`;
      }

      result.push({ questionId: qp.questionId, priority, reason });
    }

    return result;
  }

  generateLessonReview(summary: ClassSummaryMetrics): string {
    const lines: string[] = [];
    const taskName = summary.taskTitle || '本次作业';

    lines.push(`========================================`);
    lines.push(`   📝 教案复盘 - ${taskName}`);
    lines.push(`========================================`);
    lines.push(`班级：${summary.classId}  |  生成时间：${summary.generatedAt.toLocaleString()}`);
    lines.push('');

    lines.push(`【一、核心指标速览】`);
    lines.push(`  📤 提交率：${(summary.submissionRate * 100).toFixed(1)}%  (${summary.submittedCount}/${summary.totalStudents}人)`);
    lines.push(`  📊 班级均分：${summary.averageScore.toFixed(1)}分`);
    lines.push(`  ✅ 及格率：${(summary.passRate * 100).toFixed(1)}%`);
    lines.push(`  ⭐ 优秀率：${(summary.excellentRate * 100).toFixed(1)}%`);
    const sd = summary.scoreDistribution;
    lines.push(`  📈 分布：优秀${sd.excellentCount}人 / 良好${sd.goodCount}人 / 及格${sd.passCount}人 / 待提升${sd.failCount}人`);
    lines.push('');

    lines.push(`【二、整体判断】`);
    lines.push(`  ${summary.overallAssessment.levelLabel}：${summary.overallAssessment.summary}`);
    if (summary.overallAssessment.highlights.length > 0) {
      lines.push(`  ✅ 亮点：`);
      for (const h of summary.overallAssessment.highlights) {
        lines.push(`     • ${h}`);
      }
    }
    if (summary.overallAssessment.concerns.length > 0) {
      lines.push(`  ⚠️ 问题：`);
      for (const c of summary.overallAssessment.concerns) {
        lines.push(`     • ${c}`);
      }
    }
    lines.push('');

    lines.push(`【三、共性问题分析】`);
    if (summary.commonErrors.length === 0) {
      lines.push(`  无明显共性问题，整体掌握较好。`);
    } else {
      for (let i = 0; i < Math.min(5, summary.commonErrors.length); i++) {
        const e = summary.commonErrors[i];
        const rate = summary.submittedCount > 0 ? (e.affectedStudents / summary.submittedCount * 100) : 0;
        lines.push(`  ${i + 1}. 【${e.categoryName}】${e.description}`);
        lines.push(`     影响人数：${e.affectedStudents}人 (${rate.toFixed(0)}%)  |  出现：${e.occurrenceCount}次`);
        lines.push(`     建议：${e.suggestion || '针对性讲解与练习'}`);
      }
    }
    lines.push('');

    lines.push(`【四、知识点掌握情况】`);
    if (summary.tagPerformance.length > 0) {
      const sortedTags = [...summary.tagPerformance].sort((a, b) => a.passRate - b.passRate);
      for (const tag of sortedTags) {
        const flag = tag.passRate >= 0.8 ? '✅' : tag.passRate >= 0.6 ? '⚠️' : '❌';
        lines.push(`  ${flag} ${tag.tagName}(${tag.questionCount}题)：正确率${(tag.passRate * 100).toFixed(0)}%  均分${tag.averageScore.toFixed(1)}`);
      }
    }
    lines.push('');

    lines.push(`【五、下节课讲解顺序建议】`);
    if (summary.questionPerformance.length > 0) {
      const orderedQ = [...summary.questionPerformance].sort((a, b) => a.passRate - b.passRate);
      for (let i = 0; i < orderedQ.length; i++) {
        const q = orderedQ[i];
        let priority = '';
        if (q.passRate < 0.5) priority = '🔥 优先讲';
        else if (q.passRate < 0.75) priority = '📌 建议讲';
        else priority = '💡 可选讲';
        lines.push(`  ${i + 1}. 题目${q.questionId} - ${priority}（正确率${(q.passRate * 100).toFixed(0)}%）`);
      }
    }
    lines.push('');

    lines.push(`【六、教研组简报（可直接转发）】`);
    const conclusion = this.buildTeachingGroupConclusion(summary);
    lines.push(`  ${conclusion}`);

    return lines.join('\n');
  }

  private buildTeachingGroupConclusion(summary: ClassSummaryMetrics): string {
    const parts: string[] = [];
    const taskName = summary.taskTitle || '本次作业';
    parts.push(`【${summary.classId} ${taskName}】`);

    if (summary.passRate >= 0.85) parts.push('整体掌握优秀');
    else if (summary.passRate >= 0.7) parts.push('整体掌握良好');
    else if (summary.passRate >= 0.5) parts.push('整体中等');
    else parts.push('基础需加强');

    parts.push(`及格${(summary.passRate * 100).toFixed(0)}% 优秀${(summary.excellentRate * 100).toFixed(0)}%`);

    const lowTags = summary.tagPerformance.filter(t => t.passRate < 0.6);
    if (lowTags.length > 0) {
      const tagNames = lowTags.map(t => t.tagName).join('、');
      parts.push(`薄弱点：${tagNames}`);
    }

    if (summary.commonErrors.length > 0) {
      parts.push(`主要问题：${summary.commonErrors[0].categoryName}`);
    }

    if (summary.overallAssessment.actionItems.length > 0) {
      parts.push(`建议：${summary.overallAssessment.actionItems[0]}`);
    }

    return parts.join(' | ');
  }

  private identifyWeakPoints(
    commonErrors: CommonError[],
    questionPerformance: QuestionPerformance[],
    totalStudents: number,
  ): WeakPoint[] {
    const weakPoints: WeakPoint[] = [];

    if (totalStudents === 0) return weakPoints;

    const lowPerfQuestions = questionPerformance.filter(qp => qp.passRate < 0.6);
    if (lowPerfQuestions.length > 0) {
      weakPoints.push({
        name: '低正确率题目',
        impactCount: lowPerfQuestions.length,
        impactRate: lowPerfQuestions.length / Math.max(questionPerformance.length, 1),
        relatedErrors: lowPerfQuestions.map(q => `题目${q.questionId}(正确率${(q.passRate * 100).toFixed(0)}%)`),
        suggestion: '建议重点讲解这些题目的核心知识点，安排针对性练习',
      });
    }

    const frequentErrors = commonErrors.filter(e => e.occurrenceCount >= 2);
    if (frequentErrors.length > 0) {
      const topError = frequentErrors[0];
      weakPoints.push({
        name: `${topError.categoryName}问题突出`,
        impactCount: topError.affectedStudents,
        impactRate: topError.affectedStudents / totalStudents,
        relatedErrors: [topError.description],
        suggestion: topError.suggestion || '建议针对此类错误进行专项训练',
      });
    }

    return weakPoints;
  }

  private generateOverallAssessment(
    passRate: number,
    excellentRate: number,
    averagePercentage: number,
    submissionRate: number,
    commonErrors: CommonError[],
    tagPerformance: TagPerformance[],
  ): OverallAssessment {
    let level: OverallAssessmentLevel;
    let levelLabel: string;
    const highlights: string[] = [];
    const concerns: string[] = [];
    const actionItems: string[] = [];

    if (submissionRate < 0.3) {
      level = 'insufficient_data';
      levelLabel = '数据不足';
    } else if (passRate >= 0.85 && excellentRate >= 0.4) {
      level = 'excellent';
      levelLabel = '整体优秀';
    } else if (passRate >= 0.7) {
      level = 'good';
      levelLabel = '整体良好';
    } else if (passRate >= 0.5) {
      level = 'fair';
      levelLabel = '中等水平';
    } else {
      level = 'poor';
      levelLabel = '需要加强';
    }

    if (submissionRate < 0.5) {
      concerns.push(`提交率偏低(${(submissionRate * 100).toFixed(0)}%)，未提交学生需跟进`);
      actionItems.push('督促未提交学生尽快完成作业');
    } else if (submissionRate >= 0.9) {
      highlights.push(`提交率达到${(submissionRate * 100).toFixed(0)}%，整体参与度高`);
    }

    if (excellentRate >= 0.3) {
      highlights.push(`优秀率${(excellentRate * 100).toFixed(0)}%，有较多学生掌握扎实`);
    } else if (excellentRate < 0.1) {
      concerns.push(`优秀率仅${(excellentRate * 100).toFixed(0)}%，拔高训练不足`);
      actionItems.push('设计提高题和拓展练习，培养优秀学生');
    }

    if (passRate >= 0.8) {
      highlights.push(`及格率${(passRate * 100).toFixed(0)}%，基础掌握较好`);
    } else if (passRate < 0.6) {
      concerns.push(`及格率仅${(passRate * 100).toFixed(0)}%，基础知识掌握不牢`);
      actionItems.push('安排基础知识回顾和专项巩固练习');
    }

    if (commonErrors.length > 0) {
      const topError = commonErrors[0];
      if (topError.affectedStudents >= 3) {
        concerns.push(`${topError.categoryName}是主要问题，影响${topError.affectedStudents}人`);
        actionItems.push(`重点讲解：${topError.suggestion || topError.description}`);
      }
    }

    const lowPerfTags = tagPerformance.filter(t => t.passRate < 0.5);
    if (lowPerfTags.length > 0) {
      const tagNames = lowPerfTags.map(t => t.tagName).join('、');
      concerns.push(`${tagNames}掌握薄弱`);
      actionItems.push(`针对${tagNames}进行强化训练和讲解`);
    }

    let summary = '';
    switch (level) {
      case 'excellent':
        summary = `本次作业整体表现优秀！${(averagePercentage).toFixed(1)}%的平均得分率，大部分学生掌握良好，部分学生表现突出。`;
        break;
      case 'good':
        summary = `本次作业整体表现良好。平均得分率${(averagePercentage).toFixed(1)}%，多数学生掌握了核心内容，仍有提升空间。`;
        break;
      case 'fair':
        summary = `本次作业整体处于中等水平。平均得分率${(averagePercentage).toFixed(1)}%，两极分化可能存在，需要关注中下游学生。`;
        break;
      case 'poor':
        summary = `本次作业整体情况需要加强。平均得分率仅${(averagePercentage).toFixed(1)}%，基础知识点掌握不够扎实，建议安排复习。`;
        break;
      case 'insufficient_data':
        summary = `提交数据不足，暂无法做出全面判断。请等待更多学生提交后再查看。`;
        break;
    }

    if (highlights.length === 0 && level !== 'insufficient_data' && level !== 'poor') {
      highlights.push('学生整体态度认真，完成情况较好');
    }
    if (concerns.length === 0 && level !== 'excellent' && level !== 'insufficient_data') {
      concerns.push('部分学生细节处理不够，仍有提升空间');
    }
    if (actionItems.length === 0 && level !== 'insufficient_data') {
      actionItems.push('保持当前学习节奏，适当进行拓展练习');
    }

    return { level, levelLabel, summary, highlights, concerns, actionItems };
  }

  private countSubmittedStudents(results: GradingResult[]): number {
    const studentIds = new Set(results.map(r => r.studentId));
    return studentIds.size;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
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
      const averageScore = questionResults.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / questionResults.length
        : 0;
      const passCount = questionResults.filter(r => r.passed).length;
      const passRate = questionResults.length > 0 ? passCount / questionResults.length : 0;

      return {
        questionId: rule.questionId,
        averageScore,
        passRate,
        difficulty: rule.difficulty,
        discriminationIndex: this.calculateDiscriminationIndex(questionResults, rule.totalScore),
      };
    });
  }

  private calculateDiscriminationIndex(
    results: GradingResult[],
    maxScore: number,
  ): number | undefined {
    if (results.length < 4) return undefined;
    const sorted = [...results].sort((a, b) => b.earnedScore - a.earnedScore);
    const groupSize = Math.floor(results.length / 4);
    const highGroup = sorted.slice(0, groupSize);
    const lowGroup = sorted.slice(-groupSize);
    const highAverage = highGroup.reduce((sum, r) => sum + r.earnedScore, 0) / highGroup.length;
    const lowAverage = lowGroup.reduce((sum, r) => sum + r.earnedScore, 0) / lowGroup.length;
    return maxScore > 0 ? (highAverage - lowAverage) / maxScore : 0;
  }

  private generateTagPerformance(
    results: GradingResult[],
    questionRules: QuestionRule[],
  ): TagPerformance[] {
    const tagMap = new Map<QuestionTag, { scores: number[]; passCount: number; total: number }>();
    const tagQuestionCount = new Map<QuestionTag, number>();

    for (const rule of questionRules) {
      for (const tag of rule.tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, { scores: [], passCount: 0, total: 0 });
        if (!tagQuestionCount.has(tag)) tagQuestionCount.set(tag, 0);
        tagQuestionCount.set(tag, (tagQuestionCount.get(tag) || 0) + 1);

        const questionResults = results.filter(r => r.questionId === rule.questionId);
        const tagData = tagMap.get(tag)!;
        tagData.total += questionResults.length;
        for (const r of questionResults) {
          tagData.scores.push(r.earnedScore);
          if (r.passed) tagData.passCount++;
        }
      }
    }

    const performance: TagPerformance[] = [];
    for (const [tag, data] of tagMap.entries()) {
      performance.push({
        tag,
        tagName: this.tagNames[tag] || tag,
        averageScore: data.total > 0 ? data.scores.reduce((s, v) => s + v, 0) / data.total : 0,
        passRate: data.total > 0 ? data.passCount / data.total : 0,
        questionCount: tagQuestionCount.get(tag) || 0,
      });
    }
    return performance;
  }

  private generateErrorDistribution(results: GradingResult[]): ErrorDistribution[] {
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
    const errorMap = new Map<string, {
      category: ErrorCategory;
      description: string;
      suggestion: string;
      occurrenceCount: number;
      affectedStudents: Set<string>;
    }>();

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
    return commonErrors.sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, 10);
  }

  formatSummary(summary: ClassSummaryMetrics): string {
    const lines: string[] = [];
    lines.push(`========================================`);
    lines.push(`         班级作业总览报告`);
    lines.push(`========================================`);
    if (summary.taskTitle) lines.push(`📋 作业名称: ${summary.taskTitle}`);
    lines.push(`👥 班级: ${summary.classId}`);
    lines.push(`🆔 任务编号: ${summary.taskId}`);
    lines.push(`🕐 生成时间: ${summary.generatedAt.toLocaleString()}`);
    lines.push(`📐 统计口径: 按学生整份作业计算（一人算一次）`);
    lines.push('');

    lines.push(`🎯 整体评价: 【${summary.overallAssessment.levelLabel}】`);
    lines.push(`   ${summary.overallAssessment.summary}`);
    lines.push('');

    if (summary.overallAssessment.highlights.length > 0) {
      lines.push(`✅ 亮点:`);
      for (const h of summary.overallAssessment.highlights) lines.push(`   • ${h}`);
      lines.push('');
    }
    if (summary.overallAssessment.concerns.length > 0) {
      lines.push(`⚠️ 需关注:`);
      for (const c of summary.overallAssessment.concerns) lines.push(`   • ${c}`);
      lines.push('');
    }
    if (summary.overallAssessment.actionItems.length > 0) {
      lines.push(`📝 下一步建议:`);
      for (const a of summary.overallAssessment.actionItems) lines.push(`   • ${a}`);
      lines.push('');
    }

    lines.push(`----------------------------------------`);
    lines.push(`📊 核心指标（按学生统计）`);
    lines.push(`----------------------------------------`);
    lines.push(`  提交率:     ${(summary.submissionRate * 100).toFixed(1)}%  (${summary.submittedCount}/${summary.totalStudents}人)`);
    lines.push(`  班级均分:   ${summary.averageScore.toFixed(1)}分`);
    lines.push(`  及格率:     ${(summary.passRate * 100).toFixed(1)}%`);
    lines.push(`  优秀率:     ${(summary.excellentRate * 100).toFixed(1)}%`);
    lines.push(`  中位数:     ${summary.medianScore.toFixed(1)}分`);
    lines.push(`  最高分/最低分: ${summary.highestScore.toFixed(1)} / ${summary.lowestScore.toFixed(1)}`);
    lines.push('');

    lines.push(`  成绩分布（按学生）:`);
    const sd = summary.scoreDistribution;
    lines.push(`    优秀(≥90): ${sd.excellentCount}人 (${(sd.excellentRate * 100).toFixed(1)}%) ${this.buildBar(sd.excellentRate)}`);
    lines.push(`    良好(75-89): ${sd.goodCount}人 (${(sd.goodRate * 100).toFixed(1)}%) ${this.buildBar(sd.goodRate)}`);
    lines.push(`    及格(60-74): ${sd.passCount}人 (${(sd.passRate * 100).toFixed(1)}%) ${this.buildBar(sd.passRate)}`);
    lines.push(`    不及格(<60): ${sd.failCount}人 (${(sd.failRate * 100).toFixed(1)}%) ${this.buildBar(sd.failRate)}`);
    lines.push('');

    if (summary.tagPerformance.length > 0) {
      lines.push(`----------------------------------------`);
      lines.push(`📚 知识点掌握情况`);
      lines.push(`----------------------------------------`);
      for (const tag of summary.tagPerformance.sort((a, b) => a.passRate - b.passRate)) {
        const bar = this.buildBar(tag.passRate);
        const status = tag.passRate >= 0.8 ? '✅' : tag.passRate >= 0.6 ? '⚠️' : '❌';
        lines.push(`  ${status} ${tag.tagName} (${tag.questionCount}题):`);
        lines.push(`     正确率 ${(tag.passRate * 100).toFixed(1)}%  平均分 ${tag.averageScore.toFixed(1)} ${bar}`);
      }
      lines.push('');
    }

    if (summary.commonErrors.length > 0) {
      lines.push(`----------------------------------------`);
      lines.push(`❓ 常见错误 TOP 5`);
      lines.push(`----------------------------------------`);
      for (let i = 0; i < Math.min(5, summary.commonErrors.length); i++) {
        const error = summary.commonErrors[i];
        const rate = summary.submittedCount > 0 ? (error.affectedStudents / summary.submittedCount * 100) : 0;
        lines.push(`  ${i + 1}. [${error.categoryName}] ${error.description}`);
        lines.push(`     出现${error.occurrenceCount}次，影响${error.affectedStudents}人(${rate.toFixed(0)}%)`);
        if (error.suggestion) lines.push(`     建议: ${error.suggestion}`);
      }
    }

    return lines.join('\n');
  }

  formatFilteredView(view: FilteredSummaryView): string {
    const lines: string[] = [];
    const statusEmoji = view.passRate >= 0.8 ? '✅' : view.passRate >= 0.6 ? '⚠️' : '❌';

    lines.push(`========================================`);
    lines.push(`  ${view.filterLabel} 专项分析`);
    lines.push(`========================================`);
    lines.push(`  题目数量: ${view.totalQuestions}题`);
    lines.push(`  答题人数: ${view.answeredStudents}人`);
    lines.push(`  平均得分: ${view.averageScore.toFixed(1)}分`);
    lines.push(`  正确率:   ${(view.passRate * 100).toFixed(1)}% ${statusEmoji} ${this.buildBar(view.passRate)}`);
    lines.push('');

    if (view.suggestedTeachingOrder.length > 0) {
      lines.push(`📖 建议讲解顺序:`);
      for (let i = 0; i < view.suggestedTeachingOrder.length; i++) {
        const s = view.suggestedTeachingOrder[i];
        const icon = s.priority === 'high' ? '🔥' : s.priority === 'medium' ? '📌' : '💡';
        lines.push(`  ${i + 1}. ${icon} 题目${s.questionId} - ${s.reason}`);
      }
      lines.push('');
    }

    if (view.weakPoints.length > 0) {
      lines.push(`🔍 薄弱知识点:`);
      for (const wp of view.weakPoints) {
        lines.push(`  • ${wp.name}（影响${wp.impactCount}人，占${(wp.impactRate * 100).toFixed(0)}%）`);
        lines.push(`    建议: ${wp.suggestion}`);
      }
      lines.push('');
    }

    if (view.commonErrors.length > 0) {
      lines.push(`❌ 主要错误:`);
      for (let i = 0; i < Math.min(3, view.commonErrors.length); i++) {
        const err = view.commonErrors[i];
        lines.push(`  ${i + 1}. [${err.categoryName}] ${err.description}`);
      }
      lines.push('');
    }

    if (view.studentDetails.length > 0) {
      lines.push(`👤 学生专项得分（从低到高）:`);
      const needAttention = view.studentDetails.filter(s => !s.passed);
      const showList = needAttention.length > 0 ? needAttention : view.studentDetails.slice(0, Math.min(5, view.studentDetails.length));
      for (const sd of showList) {
        const flag = sd.passed ? '✅' : '❌';
        lines.push(`  ${flag} ${sd.studentId}: ${sd.totalEarned}/${sd.totalMax}分 (${sd.percentage.toFixed(1)}%)`);
        if (sd.weakQuestions.length > 0) {
          const weakQids = sd.weakQuestions.map(q => q.questionId).join('、');
          lines.push(`     薄弱题: ${weakQids}`);
        }
        if (sd.mainErrors.length > 0) {
          const errors = sd.mainErrors.map(e => e.category).join('、');
          lines.push(`     主要错: ${errors}`);
        }
      }
    }

    return lines.join('\n');
  }

  exportForSharing(summary: ClassSummaryMetrics, options: ExportOptions = {}): string {
    const format: ExportFormat = options.format || 'class_notice';
    const lines: string[] = [];
    if (options.customHeader) { lines.push(options.customHeader); lines.push(''); }

    switch (format) {
      case 'class_notice': lines.push(this.exportClassNotice(summary, options)); break;
      case 'teaching_group': lines.push(this.exportTeachingGroup(summary, options)); break;
      case 'simple': lines.push(this.exportSimple(summary, options)); break;
      case 'lesson_review': lines.push(this.generateLessonReview(summary)); break;
    }

    if (options.customFooter) { lines.push(''); lines.push(options.customFooter); }
    return lines.join('\n');
  }

  private exportClassNotice(summary: ClassSummaryMetrics, options: ExportOptions): string {
    const lines: string[] = [];
    const taskName = summary.taskTitle || '本次作业';
    lines.push(`各位同学和家长好！`);
    lines.push('');
    lines.push(`${taskName}已批改完成，以下是班级整体情况：`);
    lines.push('');
    lines.push(`📊 班级平均分：${summary.averageScore.toFixed(1)}分`);
    lines.push(`✅ 及格率：${(summary.passRate * 100).toFixed(1)}%`);
    lines.push(`⭐ 优秀率：${(summary.excellentRate * 100).toFixed(1)}%`);
    lines.push('');
    if (options.includeScoreDistribution) {
      const sd = summary.scoreDistribution;
      lines.push(`📈 成绩分布：`);
      lines.push(`  优秀(≥90分)：${sd.excellentCount}人`);
      lines.push(`  良好(75-89分)：${sd.goodCount}人`);
      lines.push(`  及格(60-74分)：${sd.passCount}人`);
      lines.push(`  需努力(<60分)：${sd.failCount}人`);
      lines.push('');
    }
    if (options.includeActionItems && summary.overallAssessment.actionItems.length > 0) {
      lines.push(`📝 老师建议：`);
      for (const item of summary.overallAssessment.actionItems.slice(0, 3)) lines.push(`  • ${item}`);
      lines.push('');
    }
    lines.push(`请同学们查看自己的批改反馈，有问题及时请教老师。继续加油！💪`);
    return lines.join('\n');
  }

  private exportTeachingGroup(summary: ClassSummaryMetrics, options: ExportOptions): string {
    const lines: string[] = [];
    const taskName = summary.taskTitle || '本次作业';
    lines.push(`【教学分析】${taskName}`);
    lines.push(`班级：${summary.classId} | 生成时间：${summary.generatedAt.toLocaleString()}`);
    lines.push('');
    lines.push(`【整体评价】${summary.overallAssessment.levelLabel}`);
    lines.push(summary.overallAssessment.summary);
    lines.push('');
    lines.push(`【核心指标(按学生统计)】`);
    lines.push(`  提交率：${(summary.submissionRate * 100).toFixed(1)}% (${summary.submittedCount}/${summary.totalStudents})`);
    lines.push(`  平均分：${summary.averageScore.toFixed(1)}  中位数：${summary.medianScore.toFixed(1)}`);
    lines.push(`  及格率：${(summary.passRate * 100).toFixed(1)}%  优秀率：${(summary.excellentRate * 100).toFixed(1)}%`);
    lines.push(`  最高分/最低分：${summary.highestScore.toFixed(1)} / ${summary.lowestScore.toFixed(1)}`);
    lines.push('');
    if (options.includeScoreDistribution) {
      const sd = summary.scoreDistribution;
      lines.push(`【成绩分布】`);
      lines.push(`  优秀：${sd.excellentCount}人(${(sd.excellentRate * 100).toFixed(1)}%)`);
      lines.push(`  良好：${sd.goodCount}人(${(sd.goodRate * 100).toFixed(1)}%)`);
      lines.push(`  及格：${sd.passCount}人(${(sd.passRate * 100).toFixed(1)}%)`);
      lines.push(`  不及格：${sd.failCount}人(${(sd.failRate * 100).toFixed(1)}%)`);
      lines.push('');
    }
    if (summary.tagPerformance.length > 0) {
      lines.push(`【知识点掌握】`);
      for (const tag of summary.tagPerformance.sort((a, b) => a.passRate - b.passRate)) {
        const flag = tag.passRate >= 0.8 ? '✅' : tag.passRate >= 0.6 ? '⚠️' : '❌';
        lines.push(`  ${flag} ${tag.tagName}(${tag.questionCount}题)：正确率${(tag.passRate * 100).toFixed(0)}%，均分${tag.averageScore.toFixed(1)}`);
      }
      lines.push('');
    }
    if (options.includeWeakPoints && summary.commonErrors.length > 0) {
      lines.push(`【常见问题】`);
      for (let i = 0; i < Math.min(3, summary.commonErrors.length); i++) {
        const e = summary.commonErrors[i];
        lines.push(`  ${i + 1}. [${e.categoryName}] ${e.description} (${e.occurrenceCount}次/${e.affectedStudents}人)`);
        if (e.suggestion) lines.push(`     建议：${e.suggestion}`);
      }
      lines.push('');
    }
    if (options.includeActionItems && summary.overallAssessment.actionItems.length > 0) {
      lines.push(`【教学建议】`);
      for (const item of summary.overallAssessment.actionItems) lines.push(`  • ${item}`);
    }
    return lines.join('\n');
  }

  private exportSimple(summary: ClassSummaryMetrics, options: ExportOptions): string {
    const lines: string[] = [];
    const taskName = summary.taskTitle || '作业';
    lines.push(`${taskName} - 班级${summary.classId}`);
    lines.push(`平均分:${summary.averageScore.toFixed(1)} 及格率:${(summary.passRate * 100).toFixed(0)}% 优秀率:${(summary.excellentRate * 100).toFixed(0)}%`);
    lines.push(`提交:${summary.submittedCount}/${summary.totalStudents}(${(summary.submissionRate * 100).toFixed(0)}%)`);
    return lines.join('\n');
  }

  private buildBar(rate: number, width: number = 10): string {
    const filled = Math.round(rate * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
