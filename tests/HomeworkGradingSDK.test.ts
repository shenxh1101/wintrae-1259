import { HomeworkGradingSDK } from '../src';
import {
  QuestionRule,
  SubmittedAnswer,
  BatchGradingRequest,
  RetryPolicy,
} from '../src/types';

describe('HomeworkGradingSDK', () => {
  let sdk: HomeworkGradingSDK;

  const singleChoiceRule: QuestionRule = {
    questionId: 'q1',
    questionType: 'single_choice',
    tags: ['foundation', 'vocabulary'],
    totalScore: 10,
    passScore: 6,
    options: [
      { id: 'A', content: '选项A' },
      { id: 'B', content: '选项B', isCorrect: true },
      { id: 'C', content: '选项C' },
      { id: 'D', content: '选项D' },
    ],
    allowPartialScore: false,
    difficulty: 2,
  };

  const multipleChoiceRule: QuestionRule = {
    questionId: 'q2',
    questionType: 'multiple_choice',
    tags: ['foundation', 'grammar'],
    totalScore: 15,
    passScore: 9,
    options: [
      { id: 'A', content: '选项A', isCorrect: true },
      { id: 'B', content: '选项B', isCorrect: true },
      { id: 'C', content: '选项C' },
      { id: 'D', content: '选项D', isCorrect: true },
    ],
    allowPartialScore: true,
    keywords: [
      { word: '分析', score: 2 },
      { word: '排除', score: 2 },
    ],
    difficulty: 3,
  };

  const calculationRule: QuestionRule = {
    questionId: 'q3',
    questionType: 'calculation',
    tags: ['application', 'problem_solving'],
    totalScore: 20,
    passScore: 12,
    correctAnswer: 42,
    allowPartialScore: true,
    steps: [
      { id: 's1', description: '设定变量', score: 5, keywords: ['设', '变量', 'x'] },
      { id: 's2', description: '列方程式', score: 5, keywords: ['方程', '等式', '='] },
      { id: 's3', description: '解方程', score: 5, keywords: ['解', '计算', '化简'] },
      { id: 's4', description: '得出结果', score: 5, expectedContent: '42' },
    ],
    keywords: [
      { word: '解方程', score: 2, required: true },
      { word: '验证', score: 1 },
    ],
    difficulty: 4,
  };

  const essayRule: QuestionRule = {
    questionId: 'q4',
    questionType: 'essay',
    tags: ['analysis', 'critical_thinking'],
    totalScore: 30,
    passScore: 18,
    allowPartialScore: true,
    keywords: [
      { word: '人工智能', score: 3, required: true, synonym: ['AI', '人工智慧'] },
      { word: '机器学习', score: 3, required: true, synonym: ['ML'] },
      { word: '深度学习', score: 3, synonym: ['DL'] },
      { word: '神经网络', score: 3 },
      { word: '伦理', score: 2 },
      { word: '社会影响', score: 2 },
    ],
    steps: [
      { id: 'e1', description: '引言与背景介绍', score: 6, keywords: ['引言', '背景', '介绍'] },
      { id: 'e2', description: '核心概念阐述', score: 8, keywords: ['概念', '定义', '原理'] },
      { id: 'e3', description: '应用案例分析', score: 8, keywords: ['应用', '案例', '分析'] },
      { id: 'e4', description: '总结与展望', score: 8, keywords: ['总结', '展望', '未来'] },
    ],
    validation: {
      type: 'string',
      minLength: 50,
      maxLength: 2000,
      required: true,
    },
    difficulty: 5,
  };

  const retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    allowRetryAfterFail: true,
    scorePenaltyPerAttempt: 2,
    maxPenaltyPercentage: 20,
  };

  beforeEach(() => {
    sdk = new HomeworkGradingSDK();
  });

  describe('Task Management', () => {
    it('should create a task successfully', () => {
      const task = sdk.createTask({
        taskId: 'task001',
        classId: 'class001',
        title: '数学期中考试',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy,
      });

      expect(task.taskId).toBe('task001');
      expect(task.classId).toBe('class001');
      expect(task.title).toBe('数学期中考试');
      expect(task.questions.length).toBe(2);
      expect(task.retryPolicy.maxAttempts).toBe(3);
      expect(task.status).toBe('created');
    });

    it('should throw error when creating duplicate task', () => {
      sdk.createTask({
        taskId: 'task001',
        title: '测试任务',
        questions: [singleChoiceRule],
      });

      expect(() => {
        sdk.createTask({
          taskId: 'task001',
          title: '重复任务',
          questions: [singleChoiceRule],
        });
      }).toThrow('任务 task001 已存在');
    });

    it('should get task by id', () => {
      sdk.createTask({
        taskId: 'task001',
        title: '测试任务',
        questions: [singleChoiceRule],
      });

      const task = sdk.getTask('task001');
      expect(task).toBeDefined();
      expect(task?.taskId).toBe('task001');
    });

    it('should return undefined for non-existent task', () => {
      const task = sdk.getTask('non-existent');
      expect(task).toBeUndefined();
    });
  });

  describe('Answer Submission', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'task001',
        title: '测试任务',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy,
      });
    });

    it('should accept valid single choice answer', () => {
      const result = sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      expect(result.accepted).toBe(true);
      expect(result.attemptNumber).toBe(1);
      expect(result.remainingAttempts).toBe(2);
      expect(result.nextAttemptAllowed).toBe(true);
      expect(result.message).toBe('答案提交成功');
    });

    it('should reject invalid answer format', () => {
      const result = sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: ['A', 'B'],
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      expect(result.accepted).toBe(false);
      expect(result.message).toContain('答案格式错误');
    });

    it('should track multiple attempts correctly', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'A',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      expect(result.accepted).toBe(true);
      expect(result.attemptNumber).toBe(2);
      expect(result.remainingAttempts).toBe(1);
    });

    it('should reject submission after max attempts', () => {
      for (let i = 0; i < 3; i++) {
        sdk.submitAnswer('task001', {
          questionId: 'q1',
          answer: 'A',
          studentId: 'stu001',
          submissionTime: new Date(),
          attemptNumber: i + 1,
        });
      }

      const result = sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 4,
      });

      expect(result.accepted).toBe(false);
      expect(result.message).toContain('已达到最大尝试次数');
      expect(result.remainingAttempts).toBe(0);
    });

    it('should reject submission for non-existent task', () => {
      const result = sdk.submitAnswer('non-existent', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      expect(result.accepted).toBe(false);
      expect(result.message).toContain('不存在');
    });
  });

  describe('Grading', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'task001',
        title: '测试任务',
        questions: [singleChoiceRule, multipleChoiceRule, calculationRule, essayRule],
        retryPolicy,
      });
    });

    it('should grade single choice correctly', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu001', 'q1');

      expect(result.earnedScore).toBe(10);
      expect(result.totalScore).toBe(10);
      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.isPartial).toBe(false);
    });

    it('should grade wrong single choice as 0', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'A',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu001', 'q1');

      expect(result.earnedScore).toBe(0);
      expect(result.passed).toBe(false);
    });

    it('should grade multiple choice with partial score', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q2',
        answer: ['A', 'B'],
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu001', 'q2');

      expect(result.earnedScore).toBeGreaterThan(0);
      expect(result.earnedScore).toBeLessThan(15);
      expect(result.isPartial).toBe(true);
    });

    it('should grade calculation with steps', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q3',
        answer:
          '设x为未知数，根据题意列方程：2x + 10 = 94。解方程得：2x = 84，x = 42。',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu001', 'q3');

      expect(result.stepScores).toBeDefined();
      expect(result.stepScores!.length).toBe(4);
      expect(result.keywordMatches).toBeDefined();
      expect(result.earnedScore).toBeGreaterThan(10);
      expect(result.errors).toBeDefined();
    });

    it('should apply retry penalty on multiple attempts', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'A',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 2,
      });

      const result = sdk.gradeSubmission('task001', 'stu001', 'q1');

      expect(result.earnedScore).toBeLessThan(10);
      expect(result.earnedScore).toBeGreaterThan(0);
    });

    it('should grade essay with keywords and steps', () => {
      const essayAnswer = `
        引言：人工智能正在深刻改变我们的社会。
        人工智能（AI）是计算机科学的重要分支。机器学习（ML）是实现人工智能的重要手段。
        概念阐述：人工智能的核心是模拟人类智能。机器学习通过数据训练模型。
        深度学习（DL）是机器学习的一种，基于神经网络。
        应用案例：人工智能在医疗、金融等领域有广泛应用。
        案例分析显示，AI技术大大提高了工作效率。
        总结：人工智能技术发展迅速。
        展望：未来需要关注AI的伦理问题和社会影响。
      `;

      sdk.submitAnswer('task001', {
        questionId: 'q4',
        answer: essayAnswer,
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu001', 'q4');

      expect(result.stepScores).toBeDefined();
      expect(result.stepScores!.length).toBe(4);
      expect(result.keywordMatches).toBeDefined();
      expect(result.keywordMatches!.length).toBe(6);
      expect(result.earnedScore).toBeGreaterThan(15);
      expect(result.passed).toBe(true);
    });

    it('should match keyword synonyms', () => {
      const essayAnswer = 'AI和ML是重要的技术概念。深度学习基于神经网络，这些技术在各个领域都有广泛应用。' +
        '我们需要关注其伦理问题和社会影响。AI技术发展迅速，ML算法不断优化。';

      sdk.submitAnswer('task001', {
        questionId: 'q4',
        answer: essayAnswer,
        studentId: 'stu002',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu002', 'q4');
      const aiMatch = result.keywordMatches?.find(km => km.word === '人工智能');
      const mlMatch = result.keywordMatches?.find(km => km.word === '机器学习');

      expect(aiMatch?.matched).toBe(true);
      expect(aiMatch?.matchedSynonym).toBe('AI');
      expect(mlMatch?.matched).toBe(true);
      expect(mlMatch?.matchedSynonym).toBe('ML');
    });
  });

  describe('Batch Grading', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'task001',
        title: '批量批改测试',
        questions: [singleChoiceRule, multipleChoiceRule],
      });
    });

    it('should grade multiple submissions in batch', () => {
      const answers: SubmittedAnswer[] = [
        {
          questionId: 'q1',
          answer: 'B',
          studentId: 'stu001',
          submissionTime: new Date(),
          attemptNumber: 1,
        },
        {
          questionId: 'q1',
          answer: 'A',
          studentId: 'stu002',
          submissionTime: new Date(),
          attemptNumber: 1,
        },
        {
          questionId: 'q1',
          answer: 'B',
          studentId: 'stu003',
          submissionTime: new Date(),
          attemptNumber: 1,
        },
        {
          questionId: 'q2',
          answer: ['A', 'B', 'D'],
          studentId: 'stu001',
          submissionTime: new Date(),
          attemptNumber: 1,
        },
      ];

      answers.forEach(a => sdk.submitAnswer('task001', a));

      const request: BatchGradingRequest = {
        taskId: 'task001',
        answers,
        gradingMode: 'auto',
      };

      const result = sdk.gradeBatch(request);

      expect(result.totalGraded).toBe(4);
      expect(result.results.length).toBe(4);
      expect(result.averageScore).toBeGreaterThan(0);
      expect(result.passRate).toBeGreaterThan(0);
      expect(result.gradingCompletedAt).toBeInstanceOf(Date);

      const passedCount = result.results.filter(r => r.passed).length;
      expect(passedCount).toBeGreaterThan(0);
    });
  });

  describe('Feedback Generation', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'task001',
        title: '反馈测试',
        questions: [singleChoiceRule, calculationRule, essayRule],
      });
    });

    it('should generate student feedback for excellent result', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      sdk.gradeSubmission('task001', 'stu001', 'q1');
      const feedback = sdk.generateStudentFeedback('task001', 'stu001', 'q1');

      expect(feedback.questionId).toBe('q1');
      expect(feedback.studentId).toBe('stu001');
      expect(feedback.overallMessage).toContain('表现非常优秀');
      expect(feedback.strengths.length).toBeGreaterThan(0);
      expect(feedback.encouragement).toBeDefined();
      expect(feedback.nextSteps.length).toBeGreaterThan(0);
    });

    it('should generate student feedback for poor result', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'A',
        studentId: 'stu002',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      sdk.gradeSubmission('task001', 'stu002', 'q1');
      const feedback = sdk.generateStudentFeedback('task001', 'stu002', 'q1');

      expect(feedback.improvements.length).toBeGreaterThan(0);
      expect(feedback.encouragement).toContain('别灰心');
    });

    it('should generate detailed feedback with steps and keywords', () => {
      const essayAnswer = `
        引言：人工智能正在改变世界。
        人工智能（AI）是重要技术。机器学习（ML）是核心方法。
        概念：AI模拟人类智能。ML基于数据训练。
        应用：AI在医疗领域应用广泛。
        总结：AI前景广阔。
        展望：需要关注伦理问题。
      `;

      sdk.submitAnswer('task001', {
        questionId: 'q4',
        answer: essayAnswer,
        studentId: 'stu003',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      sdk.gradeSubmission('task001', 'stu003', 'q4');
      const feedback = sdk.generateStudentFeedback('task001', 'stu003', 'q4');

      expect(feedback.stepFeedback.length).toBe(4);
      expect(feedback.keywordFeedback.length).toBe(6);
      expect(feedback.errorFeedback).toBeDefined();
      expect(feedback.suggestions.length).toBeGreaterThan(0);
    });

    it('should generate teacher comment draft', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      sdk.gradeSubmission('task001', 'stu001', 'q1');
      const comment = sdk.generateTeacherComment('task001', 'stu001', 'q1');

      expect(comment.overallComment).toContain('表现优秀');
      expect(comment.positivePoints.length).toBeGreaterThan(0);
      expect(comment.areasForImprovement).toBeDefined();
      expect(comment.followUpQuestions.length).toBeGreaterThan(0);
      expect(comment.tags).toContain('优秀');
      expect(comment.editable).toBe(true);
    });

    it('should generate teacher comment with improvement areas', () => {
      const calculationAnswer = '答案是42';

      sdk.submitAnswer('task001', {
        questionId: 'q3',
        answer: calculationAnswer,
        studentId: 'stu004',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      sdk.gradeSubmission('task001', 'stu004', 'q3');
      const comment = sdk.generateTeacherComment('task001', 'stu004', 'q3');

      expect(comment.positivePoints).toBeDefined();
      expect(comment.areasForImprovement.length).toBeGreaterThan(0);
      expect(comment.detailedComments.length).toBeGreaterThan(0);
    });

    it('should store and retrieve feedback', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q1',
        answer: 'B',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      sdk.gradeSubmission('task001', 'stu001', 'q1');
      sdk.generateStudentFeedback('task001', 'stu001', 'q1');
      sdk.generateTeacherComment('task001', 'stu001', 'q1');

      const storedFeedback = sdk.getStudentFeedback('task001', 'stu001', 'q1');
      const storedComment = sdk.getTeacherComment('task001', 'stu001', 'q1');

      expect(storedFeedback).toBeDefined();
      expect(storedComment).toBeDefined();
    });
  });

  describe('Class Summary', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'task001',
        classId: 'class001',
        title: '班级汇总测试',
        questions: [singleChoiceRule, multipleChoiceRule, calculationRule],
      });

      const students = ['stu001', 'stu002', 'stu003', 'stu004', 'stu005'];
      const answers: SubmittedAnswer[] = [];

      students.forEach((stuId, index) => {
        answers.push({
          questionId: 'q1',
          answer: index < 3 ? 'B' : 'A',
          studentId: stuId,
          submissionTime: new Date(),
          attemptNumber: 1,
        });
        answers.push({
          questionId: 'q2',
          answer: index < 2 ? ['A', 'B', 'D'] : ['A', 'C'],
          studentId: stuId,
          submissionTime: new Date(),
          attemptNumber: 1,
        });
        answers.push({
          questionId: 'q3',
          answer:
            index < 4
              ? '设x，列方程2x+10=94，解方程得x=42。验证正确。'
              : '不知道',
          studentId: stuId,
          submissionTime: new Date(),
          attemptNumber: 1,
        });
      });

      answers.forEach(a => sdk.submitAnswer('task001', a));

      const request: BatchGradingRequest = {
        taskId: 'task001',
        answers,
        gradingMode: 'auto',
      };

      sdk.gradeBatch(request);
    });

    it('should generate class summary metrics', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);

      expect(summary.classId).toBe('class001');
      expect(summary.taskId).toBe('task001');
      expect(summary.totalStudents).toBe(10);
      expect(summary.submittedCount).toBe(5);
      expect(summary.submissionRate).toBe(0.5);
      expect(summary.averageScore).toBeGreaterThan(0);
      expect(summary.medianScore).toBeGreaterThan(0);
      expect(summary.passRate).toBeGreaterThan(0);
      expect(summary.excellentRate).toBeGreaterThanOrEqual(0);
      expect(summary.questionPerformance.length).toBe(3);
      expect(summary.tagPerformance.length).toBeGreaterThan(0);
      expect(summary.errorDistribution.length).toBeGreaterThan(0);
      expect(summary.commonErrors.length).toBeGreaterThan(0);
    });

    it('should calculate question performance correctly', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);
      const q1Performance = summary.questionPerformance.find(
        q => q.questionId === 'q1',
      );

      expect(q1Performance).toBeDefined();
      expect(q1Performance!.passRate).toBe(0.6);
      expect(q1Performance!.difficulty).toBe(2);
    });

    it('should calculate tag performance', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);

      expect(summary.tagPerformance.length).toBeGreaterThan(0);
      summary.tagPerformance.forEach(tag => {
        expect(tag.averageScore).toBeGreaterThanOrEqual(0);
        expect(tag.passRate).toBeGreaterThanOrEqual(0);
        expect(tag.passRate).toBeLessThanOrEqual(1);
      });
    });

    it('should generate formatted summary report', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);
      const formatted = sdk.formatClassSummary(summary);

      expect(formatted).toContain('班级作业总览报告');
      expect(formatted).toContain('班级: class001');
      expect(formatted).toContain('提交率:');
      expect(formatted).toContain('及格率:');
      expect(formatted).toContain('整体评价');
      expect(formatted).toContain('核心指标');
    });

    it('should include overall assessment in summary', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);

      expect(summary.overallAssessment).toBeDefined();
      expect(summary.overallAssessment.levelLabel).toBeDefined();
      expect(summary.overallAssessment.summary.length).toBeGreaterThan(0);
      expect(summary.overallAssessment.highlights.length).toBeGreaterThanOrEqual(0);
    });

    it('should include score distribution', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);

      expect(summary.scoreDistribution).toBeDefined();
      const sd = summary.scoreDistribution;
      expect(sd.excellentCount + sd.goodCount + sd.passCount + sd.failCount).toBeGreaterThan(0);
    });

    it('should generate filtered summary by tag', () => {
      const view = sdk.generateFilteredSummaryByTag('task001', 'class001', 10, 'foundation');

      expect(view.filterType).toBe('tag');
      expect(view.filterLabel).toContain('基础');
      expect(view.totalQuestions).toBeGreaterThan(0);
      expect(view.passRate).toBeGreaterThanOrEqual(0);
      expect(view.passRate).toBeLessThanOrEqual(1);
    });

    it('should generate filtered summary by question type', () => {
      const view = sdk.generateFilteredSummaryByQuestionType('task001', 'class001', 10, 'single_choice');

      expect(view.filterType).toBe('questionType');
      expect(view.filterLabel).toContain('单选');
    });

    it('should format filtered summary view', () => {
      const view = sdk.generateFilteredSummaryByTag('task001', 'class001', 10, 'foundation');
      const formatted = sdk.formatFilteredSummary(view);

      expect(formatted).toContain('专项分析');
      expect(formatted).toContain('正确率');
    });

    it('should export summary for class notice', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);
      const exported = sdk.exportClassSummary(summary, { format: 'class_notice' });

      expect(exported).toContain('各位同学');
      expect(exported).toContain('平均分');
      expect(exported).toContain('及格率');
    });

    it('should export summary for teaching group', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);
      const exported = sdk.exportClassSummary(summary, {
        format: 'teaching_group',
        includeScoreDistribution: true,
        includeWeakPoints: true,
        includeActionItems: true,
      });

      expect(exported).toContain('教学分析');
      expect(exported).toContain('整体评价');
      expect(exported).toContain('核心指标');
    });

    it('should export simple summary', () => {
      const summary = sdk.generateClassSummary('task001', 'class001', 10);
      const exported = sdk.exportClassSummary(summary, { format: 'simple' });

      expect(exported.length).toBeGreaterThan(0);
      expect(exported).toContain('平均分');
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      sdk.registerQuestionRules([singleChoiceRule, essayRule]);
    });

    it('should validate answer format', () => {
      const result1 = sdk.validateAnswer('q1', 'B');
      expect(result1.valid).toBe(true);

      const result2 = sdk.validateAnswer('q1', ['A', 'B']);
      expect(result2.valid).toBe(false);
      expect(result2.errors.length).toBeGreaterThan(0);
    });

    it('should validate essay answer length', () => {
      const shortAnswer = '太短了';
      const result1 = sdk.validateAnswer('q4', shortAnswer);
      expect(result1.valid).toBe(false);
      expect(result1.errors[0]).toContain('不能少于');

      const longAnswer = 'a'.repeat(3000);
      const result2 = sdk.validateAnswer('q4', longAnswer);
      expect(result2.valid).toBe(false);

      const validAnswer = '这是一个足够长的答案，用来测试验证功能是否正常工作。'.repeat(3);
      const result3 = sdk.validateAnswer('q4', validAnswer);
      expect(result3.valid).toBe(true);
    });

    it('should return error for non-existent question', () => {
      const result = sdk.validateAnswer('non-existent', 'test');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('未找到题目');
    });
  });

  describe('Error Classification', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'task001',
        title: '错误分类测试',
        questions: [calculationRule],
      });
    });

    it('should classify conceptual mistakes', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q3',
        answer: '我认为答案是100，因为这看起来像是一个整数。',
        studentId: 'stu001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu001', 'q3');

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      const hasConceptualError = result.errors!.some(
        e => e.category === 'conceptual_mistake',
      );
      expect(hasConceptualError).toBe(true);
    });

    it('should classify missing steps', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q3',
        answer: '42',
        studentId: 'stu002',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu002', 'q3');

      const hasMissingStep = result.errors!.some(
        e => e.category === 'missing_step',
      );
      expect(hasMissingStep).toBe(true);
    });

    it('should classify incomplete answers', () => {
      sdk.submitAnswer('task001', {
        questionId: 'q3',
        answer: '',
        studentId: 'stu003',
        submissionTime: new Date(),
        attemptNumber: 1,
      });

      const result = sdk.gradeSubmission('task001', 'stu003', 'q3');

      const hasIncomplete = result.errors!.some(
        e => e.category === 'incomplete_answer',
      );
      expect(hasIncomplete).toBe(true);
    });
  });

  describe('Attempt Tracking', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'task001',
        title: '尝试次数测试',
        questions: [singleChoiceRule],
        retryPolicy,
      });
    });

    it('should track attempt count correctly', () => {
      for (let i = 0; i < 2; i++) {
        sdk.submitAnswer('task001', {
          questionId: 'q1',
          answer: 'A',
          studentId: 'stu001',
          submissionTime: new Date(),
          attemptNumber: i + 1,
        });
      }

      const attemptCount = sdk.getAttemptCount('task001', 'stu001', 'q1');
      const remainingAttempts = sdk.getRemainingAttempts('task001', 'stu001', 'q1');

      expect(attemptCount).toBe(2);
      expect(remainingAttempts).toBe(1);
    });

    it('should return correct remaining attempts', () => {
      const remaining = sdk.getRemainingAttempts('task001', 'stu001', 'q1');
      expect(remaining).toBe(3);
    });
  });

  describe('Batch Feedback', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'batch-task',
        title: '批量反馈测试作业',
        classId: 'class-batch',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy,
      });

      const students = ['batch-stu1', 'batch-stu2', 'batch-stu3'];
      for (const sid of students) {
        sdk.submitAnswer('batch-task', {
          questionId: 'q1',
          answer: 'B',
          studentId: sid,
          submissionTime: new Date(),
          attemptNumber: 1,
        });
        sdk.gradeSubmission('batch-task', sid, 'q1');

        sdk.submitAnswer('batch-task', {
          questionId: 'q3',
          answer: '设x为未知数，列方程：2x+10=94。2x=84，x=42。验证正确。',
          studentId: sid,
          submissionTime: new Date(),
          attemptNumber: 1,
        });
        sdk.gradeSubmission('batch-task', sid, 'q3');
      }
    });

    it('should generate batch feedback for multiple students', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1', 'batch-stu2', 'batch-stu3'],
      });

      expect(result.totalStudents).toBe(3);
      expect(result.totalQuestions).toBe(2);
      expect(result.perStudent.length).toBe(3);
      expect(result.perQuestion.length).toBe(2);
    });

    it('should include student feedback and teacher comments in batch', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1'],
      });

      const student = result.perStudent[0];
      expect(student.studentId).toBe('batch-stu1');
      expect(Object.keys(student.studentFeedback).length).toBeGreaterThan(0);
      expect(Object.keys(student.teacherComment).length).toBeGreaterThan(0);
      expect(student.questionResults.length).toBe(2);
    });

    it('should generate per question statistics', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1', 'batch-stu2', 'batch-stu3'],
      });

      for (const pq of result.perQuestion) {
        expect(pq.answeredCount).toBe(3);
        expect(pq.averageScore).toBeGreaterThanOrEqual(0);
        expect(pq.passRate).toBeGreaterThanOrEqual(0);
      }
    });

    it('should format batch feedback result', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1', 'batch-stu2'],
      });
      const formatted = sdk.formatBatchFeedback(result);

      expect(formatted).toContain('批量反馈报告');
      expect(formatted).toContain('题目汇总');
      expect(formatted).toContain('学生成绩');
    });

    it('should filter by specific question ids', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1'],
        questionIds: ['q1'],
      });

      expect(result.totalQuestions).toBe(1);
      expect(result.perStudent[0].questionResults.length).toBe(1);
      expect(result.perStudent[0].questionResults[0].questionId).toBe('q1');
    });
  });

  describe('Integration Test - Full Workflow', () => {
    it('should complete full workflow from task creation to feedback', () => {
      const task = sdk.createTask({
        taskId: 'integration-task',
        classId: 'class-integration',
        title: '集成测试作业',
        description: '这是一个集成测试任务',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy: {
          maxAttempts: 2,
          allowRetryAfterFail: true,
          scorePenaltyPerAttempt: 1,
        },
      });

      expect(task.status).toBe('created');

      const submitResult1 = sdk.submitAnswer('integration-task', {
        questionId: 'q1',
        answer: 'A',
        studentId: 'student-001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });
      expect(submitResult1.accepted).toBe(true);

      const submitResult2 = sdk.submitAnswer('integration-task', {
        questionId: 'q3',
        answer: '设x为未知数，根据题意列方程：2x + 10 = 94。解方程，计算得：2x = 84，x = 42。验证：2*42+10=94，答案正确。',
        studentId: 'student-001',
        submissionTime: new Date(),
        attemptNumber: 1,
      });
      expect(submitResult2.accepted).toBe(true);

      const gradingResult1 = sdk.gradeSubmission('integration-task', 'student-001', 'q1');
      expect(gradingResult1.passed).toBe(false);

      const gradingResult3 = sdk.gradeSubmission('integration-task', 'student-001', 'q3');
      expect(gradingResult3.passed).toBe(true);
      expect(gradingResult3.stepScores?.length).toBe(4);

      const feedback1 = sdk.generateStudentFeedback('integration-task', 'student-001', 'q1');
      expect(feedback1.encouragement).toBeDefined();

      const comment1 = sdk.generateTeacherComment('integration-task', 'student-001', 'q1');
      expect(comment1.areasForImprovement.length).toBeGreaterThan(0);

      const allResults = sdk.getAllGradingResults('integration-task', 'student-001');
      expect(allResults.length).toBe(2);

      const classSummary = sdk.generateClassSummary('integration-task', 'class-integration', 30);
      expect(classSummary.submittedCount).toBe(1);

      const formattedSummary = sdk.formatClassSummary(classSummary);
      expect(formattedSummary).toContain('集成测试作业');
    });
  });
});
