import {
  BatchFeedbackRequest,
  BatchFeedbackResult,
  PerStudentFeedback,
  PerQuestionFeedback,
  PerQuestionResult,
  GradingResult,
  StudentFeedback,
  TeacherCommentDraft,
  GradingTask,
  BatchExportOptions,
  BatchExportView,
} from '../types';
import { StudentFeedbackGenerator } from './StudentFeedbackGenerator';
import { TeacherCommentGenerator } from './TeacherCommentGenerator';

export class BatchFeedbackGenerator {
  private studentFeedbackGenerator: StudentFeedbackGenerator;
  private teacherCommentGenerator: TeacherCommentGenerator;

  constructor() {
    this.studentFeedbackGenerator = new StudentFeedbackGenerator();
    this.teacherCommentGenerator = new TeacherCommentGenerator();
  }

  generate(
    request: BatchFeedbackRequest,
    task: GradingTask,
  ): BatchFeedbackResult {
    const { taskId, studentIds, questionIds } = request;
    const targetQuestionIds = questionIds || task.questions.map(q => q.questionId);

    const perStudent: PerStudentFeedback[] = [];
    const questionScoreMap = new Map<string, { earned: number[]; total: number; passed: number; excellent: number; answered: number }>();

    for (const qid of targetQuestionIds) {
      const question = task.questions.find(q => q.questionId === qid);
      if (question) {
        questionScoreMap.set(qid, {
          earned: [],
          total: question.totalScore,
          passed: 0,
          excellent: 0,
          answered: 0,
        });
      }
    }

    for (const studentId of studentIds) {
      const studentResults = task.gradingResults.get(studentId);
      if (!studentResults) continue;

      const questionResults: PerQuestionResult[] = [];
      const studentFeedbackMap: Record<string, StudentFeedback> = {};
      const teacherCommentMap: Record<string, TeacherCommentDraft> = {};
      let totalEarned = 0;
      let totalMax = 0;
      let allPassed = true;
      let hasResults = false;

      for (const qid of targetQuestionIds) {
        const result = studentResults.get(qid);
        if (!result) continue;
        hasResults = true;

        const feedback = this.studentFeedbackGenerator.generate(result);
        const comment = this.teacherCommentGenerator.generate(result);

        studentFeedbackMap[qid] = feedback;
        teacherCommentMap[qid] = comment;

        const qData = questionScoreMap.get(qid);
        if (qData) {
          qData.answered++;
          qData.earned.push(result.earnedScore);
          if (result.passed) qData.passed++;
          if (result.percentage >= 90) qData.excellent++;
        }

        questionResults.push({
          questionId: qid,
          earnedScore: result.earnedScore,
          totalScore: result.totalScore,
          passed: result.passed,
          percentage: result.percentage,
        });

        totalEarned += result.earnedScore;
        totalMax += result.totalScore;
        if (!result.passed) allPassed = false;
      }

      if (!hasResults) continue;

      const overallPercentage = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;

      perStudent.push({
        studentId,
        totalScore: totalEarned,
        maxScore: totalMax,
        overallPercentage,
        passed: allPassed,
        questionResults,
        studentFeedback: studentFeedbackMap,
        teacherComment: teacherCommentMap,
      });

      const existingFeedbacks = task.feedbacks.get(studentId) || new Map();
      for (const [qid, fb] of Object.entries(studentFeedbackMap)) {
        existingFeedbacks.set(qid, fb);
      }
      task.feedbacks.set(studentId, existingFeedbacks);

      const existingComments = task.teacherComments.get(studentId) || new Map();
      for (const [qid, cm] of Object.entries(teacherCommentMap)) {
        existingComments.set(qid, cm);
      }
      task.teacherComments.set(studentId, existingComments);
    }

    const perQuestion: PerQuestionFeedback[] = [];
    for (const [qid, data] of questionScoreMap.entries()) {
      const avg = data.answered > 0
        ? data.earned.reduce((s, v) => s + v, 0) / data.answered
        : 0;
      perQuestion.push({
        questionId: qid,
        totalStudents: studentIds.length,
        answeredCount: data.answered,
        averageScore: avg,
        passRate: data.answered > 0 ? data.passed / data.answered : 0,
        excellentRate: data.answered > 0 ? data.excellent / data.answered : 0,
      });
    }

    return {
      taskId,
      taskTitle: task.title,
      totalStudents: perStudent.length,
      totalQuestions: targetQuestionIds.length,
      perStudent,
      perQuestion,
    };
  }

  getStudentFeedbackByQuestion(
    result: BatchFeedbackResult,
    questionId: string,
  ): { studentId: string; feedback: StudentFeedback; comment: TeacherCommentDraft; result: PerQuestionResult }[] {
    const list: { studentId: string; feedback: StudentFeedback; comment: TeacherCommentDraft; result: PerQuestionResult }[] = [];

    for (const ps of result.perStudent) {
      const fb = ps.studentFeedback[questionId];
      const cm = ps.teacherComment[questionId];
      const rs = ps.questionResults.find(q => q.questionId === questionId);
      if (fb && cm && rs) {
        list.push({ studentId: ps.studentId, feedback: fb, comment: cm, result: rs });
      }
    }

    return list;
  }

  formatBatchResult(result: BatchFeedbackResult): string {
    const lines: string[] = [];
    lines.push(`========================================`);
    lines.push(`   批量反馈报告`);
    lines.push(`========================================`);
    if (result.taskTitle) lines.push(`作业: ${result.taskTitle}`);
    lines.push(`任务ID: ${result.taskId}`);
    lines.push(`学生数: ${result.totalStudents}  题目数: ${result.totalQuestions}`);
    lines.push('');

    lines.push(`--- 题目汇总 ---`);
    for (const pq of result.perQuestion) {
      const status = pq.passRate >= 0.8 ? '✅' : pq.passRate >= 0.6 ? '⚠️' : '❌';
      lines.push(`  ${status} 题目${pq.questionId}: 均分${pq.averageScore.toFixed(1)} 及格率${(pq.passRate * 100).toFixed(0)}% 优秀率${(pq.excellentRate * 100).toFixed(0)}% (答题${pq.answeredCount}/${pq.totalStudents}人)`);
    }
    lines.push('');

    lines.push(`--- 学生成绩 ---`);
    for (const ps of result.perStudent.sort((a, b) => b.overallPercentage - a.overallPercentage)) {
      const flag = ps.overallPercentage >= 90 ? '⭐' : ps.passed ? '✅' : '❌';
      lines.push(`  ${flag} ${ps.studentId}: ${ps.totalScore}/${ps.maxScore}分 (${ps.overallPercentage.toFixed(1)}%)`);
    }

    return lines.join('\n');
  }

  exportByView(result: BatchFeedbackResult, options: BatchExportOptions): string {
    if (options.view === 'by_question') {
      if (!options.questionId) {
        const lines: string[] = [];
        for (const pq of result.perQuestion) {
          lines.push(this.exportByQuestion(result, pq.questionId, options));
          lines.push('');
        }
        return lines.join('\n');
      }
      return this.exportByQuestion(result, options.questionId, options);
    } else {
      if (!options.studentId) {
        const lines: string[] = [];
        for (const ps of result.perStudent.sort((a, b) => b.overallPercentage - a.overallPercentage)) {
          lines.push(this.exportByStudent(result, ps.studentId, options));
          lines.push('');
        }
        return lines.join('\n');
      }
      return this.exportByStudent(result, options.studentId, options);
    }
  }

  private exportByQuestion(
    result: BatchFeedbackResult,
    questionId: string,
    options: BatchExportOptions,
  ): string {
    const lines: string[] = [];
    const qInfo = result.perQuestion.find(q => q.questionId === questionId);
    if (!qInfo) return '';

    const qFlag = qInfo.passRate >= 0.8 ? '✅' : qInfo.passRate >= 0.6 ? '⚠️' : '❌';
    lines.push(`========================================`);
    lines.push(`  题目 ${questionId} 共性反馈`);
    lines.push(`========================================`);
    lines.push(`${qFlag} 均分: ${qInfo.averageScore.toFixed(1)} | 及格率: ${(qInfo.passRate * 100).toFixed(1)}% | 优秀率: ${(qInfo.excellentRate * 100).toFixed(1)}% | 答题: ${qInfo.answeredCount}/${qInfo.totalStudents}人`);
    lines.push('');

    const studentRows = this.getStudentFeedbackByQuestion(result, questionId);
    const allStrengths = new Map<string, number>();
    const allImprovements = new Map<string, number>();
    const allErrors = new Map<string, number>();

    for (const row of studentRows) {
      for (const s of row.feedback.strengths) {
        allStrengths.set(s, (allStrengths.get(s) || 0) + 1);
      }
      for (const im of row.feedback.improvements) {
        allImprovements.set(im, (allImprovements.get(im) || 0) + 1);
      }
      for (const ef of row.feedback.errorFeedback) {
        const key = `${ef.categoryName}: ${ef.description}`;
        allErrors.set(key, (allErrors.get(key) || 0) + 1);
      }
    }

    if (allStrengths.size > 0) {
      lines.push(`【全班共同亮点】`);
      const sortedStrengths = Array.from(allStrengths.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [text, count] of sortedStrengths) {
        lines.push(`  ✅ ${text} (${count}人)`);
      }
      lines.push('');
    }

    if (allImprovements.size > 0) {
      lines.push(`【全班需改进】`);
      const sortedImps = Array.from(allImprovements.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [text, count] of sortedImps) {
        lines.push(`  ⚠️ ${text} (${count}人)`);
      }
      lines.push('');
    }

    if (allErrors.size > 0) {
      lines.push(`【全班主要错误】`);
      const sortedErrors = Array.from(allErrors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [text, count] of sortedErrors) {
        lines.push(`  ❌ ${text} (${count}人)`);
      }
      lines.push('');
    }

    if (options.includeTeacherComment !== false) {
      lines.push(`【教师参考评语】`);
      const topStudent = studentRows.find(s => s.result.percentage >= 90);
      if (topStudent) {
        lines.push(`  优秀示例评语: ${topStudent.comment.overallComment}`);
      }
      const midStudent = studentRows.find(s => s.result.passed && s.result.percentage < 90);
      if (midStudent) {
        lines.push(`  良好示例评语: ${midStudent.comment.overallComment}`);
      }
      const lowStudent = studentRows.find(s => !s.result.passed);
      if (lowStudent) {
        lines.push(`  待提升示例评语: ${lowStudent.comment.overallComment}`);
      }
    }

    lines.push('');
    lines.push(`【学生逐人得分】`);
    for (const row of studentRows.sort((a, b) => b.result.percentage - a.result.percentage)) {
      const flag = row.result.percentage >= 90 ? '⭐' : row.result.passed ? '✅' : '❌';
      lines.push(`  ${flag} ${row.studentId}: ${row.result.earnedScore}/${row.result.totalScore}分 (${row.result.percentage.toFixed(1)}%)`);
      if (options.includeStudentFeedback !== false) {
        lines.push(`     反馈: ${row.feedback.overallMessage}`);
      }
    }

    return lines.join('\n');
  }

  private exportByStudent(
    result: BatchFeedbackResult,
    studentId: string,
    options: BatchExportOptions,
  ): string {
    const lines: string[] = [];
    const ps = result.perStudent.find(s => s.studentId === studentId);
    if (!ps) return '';

    const overallFlag = ps.overallPercentage >= 90 ? '⭐' : ps.passed ? '✅' : '❌';
    lines.push(`========================================`);
    lines.push(`  学生 ${ps.studentId} 完整反馈`);
    lines.push(`========================================`);
    lines.push(`${overallFlag} 总分: ${ps.totalScore}/${ps.maxScore}分 | 得分率: ${ps.overallPercentage.toFixed(1)}% | 整体: ${ps.passed ? '已达标' : '待努力'}`);
    lines.push('');

    for (const qr of ps.questionResults.sort((a, b) => a.percentage - b.percentage)) {
      const fb = ps.studentFeedback[qr.questionId];
      const cm = ps.teacherComment[qr.questionId];
      const qFlag = qr.percentage >= 90 ? '⭐' : qr.passed ? '✅' : '❌';
      lines.push(`【题目${qr.questionId}】 ${qFlag} ${qr.earnedScore}/${qr.totalScore}分 (${qr.percentage.toFixed(1)}%)`);

      if (options.includeStudentFeedback !== false && fb) {
        lines.push(`  📢 学生反馈: ${fb.overallMessage}`);
        if (fb.strengths.length > 0) {
          lines.push(`  ✅ 优点: ${fb.strengths.slice(0, 2).join('；')}`);
        }
        if (fb.improvements.length > 0) {
          lines.push(`  ⚠️ 改进: ${fb.improvements.slice(0, 2).join('；')}`);
        }
        if (fb.encouragement) {
          lines.push(`  💪 鼓励: ${fb.encouragement}`);
        }
      }

      if (options.includeTeacherComment !== false && cm) {
        lines.push(`  👩‍🏫 教师评语: ${cm.overallComment}`);
        if (cm.followUpQuestions.length > 0) {
          lines.push(`  ❓ 跟进问题: ${cm.followUpQuestions.slice(0, 2).join('；')}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
