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
}
