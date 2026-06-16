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

    it('should export batch feedback by question view', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1', 'batch-stu2', 'batch-stu3'],
        questionIds: ['q1'],
      });
      const exported = sdk.exportBatchFeedback(result, {
        view: 'by_question',
        questionId: 'q1',
      });

      expect(exported).toContain('题目');
      expect(exported).toContain('共性反馈');
      expect(exported).toContain('均分');
      expect(exported).toContain('及格率');
    });

    it('should export batch feedback by student view', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1', 'batch-stu2'],
      });
      const exported = sdk.exportBatchFeedback(result, {
        view: 'by_student',
        studentId: 'batch-stu1',
      });

      expect(exported).toContain('学生');
      expect(exported).toContain('完整反馈');
      expect(exported).toContain('总分');
      expect(exported).toContain('题目');
    });

    it('should export batch feedback all questions', () => {
      const result = sdk.generateBatchFeedback({
        taskId: 'batch-task',
        studentIds: ['batch-stu1'],
      });
      const exported = sdk.exportBatchFeedback(result, { view: 'by_question' });

      expect(exported.length).toBeGreaterThan(0);
      expect(exported).toContain('q1');
      expect(exported).toContain('q3');
    });
  });

  describe('Advanced Summary & Lesson Review', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'review-task',
        title: '教案复盘测试作业',
        classId: 'class-review',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy,
      });

      const answers: Record<string, Record<string, unknown>> = {
        'r-stu1': { q1: 'B', q3: '设x为未知数，2x+10=94，x=42。验证正确。' },
        'r-stu2': { q1: 'B', q3: '2x=94，x=47。' },
        'r-stu3': { q1: 'A', q3: 'x=40' },
        'r-stu4': { q1: 'B', q3: '根据题意列方程解得x=42' },
      };

      for (const [sid, ans] of Object.entries(answers)) {
        sdk.submitAnswer('review-task', {
          questionId: 'q1',
          answer: ans.q1 as never,
          studentId: sid,
          submissionTime: new Date(),
          attemptNumber: 1,
        });
        sdk.submitAnswer('review-task', {
          questionId: 'q3',
          answer: ans.q3 as never,
          studentId: sid,
          submissionTime: new Date(),
          attemptNumber: 1,
        });
        sdk.gradeSubmission('review-task', sid, 'q1');
        sdk.gradeSubmission('review-task', sid, 'q3');
      }
    });

    it('should calculate metrics by student (one student counts once)', () => {
      const summary = sdk.generateClassSummary('review-task', 'class-review', 6);

      expect(summary.studentScores.length).toBe(4);
      expect(summary.submittedCount).toBe(4);
      expect(summary.submissionRate).toBeCloseTo(4 / 6, 2);
      expect(summary.averageScore).toBeGreaterThan(0);
      expect(summary.passRate).toBeGreaterThanOrEqual(0);
      expect(summary.passRate).toBeLessThanOrEqual(1);
    });

    it('should include score distribution by student', () => {
      const summary = sdk.generateClassSummary('review-task', 'class-review', 6);
      const sd = summary.scoreDistribution;

      expect(sd.excellentCount + sd.goodCount + sd.passCount + sd.failCount).toBe(4);
      expect(sd.excellentRate + sd.goodRate + sd.passRate + sd.failRate).toBeCloseTo(1, 1);
    });

    it('should show student details in filtered view by tag', () => {
      const view = sdk.generateFilteredSummaryByTag('review-task', 'class-review', 6, 'foundation');

      expect(view.studentDetails.length).toBeGreaterThan(0);
      const firstStudent = view.studentDetails[0];
      expect(firstStudent.studentId).toBeDefined();
      expect(firstStudent.percentage).toBeGreaterThanOrEqual(0);
    });

    it('should include weak questions and main errors in student details', () => {
      const view = sdk.generateFilteredSummaryByTag('review-task', 'class-review', 6, 'foundation');

      for (const sd of view.studentDetails) {
        if (sd.weakQuestions.length > 0) {
          expect(sd.weakQuestions[0].questionId).toBeDefined();
          expect(sd.weakQuestions[0].earnedScore).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should suggest teaching order in filtered view', () => {
      const view = sdk.generateFilteredSummaryByTag('review-task', 'class-review', 6, 'application');

      expect(view.suggestedTeachingOrder.length).toBeGreaterThan(0);
      for (const s of view.suggestedTeachingOrder) {
        expect(s.questionId).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(s.priority);
        expect(s.reason.length).toBeGreaterThan(0);
      }
    });

    it('should export lesson review format', () => {
      const summary = sdk.generateClassSummary('review-task', 'class-review', 6);
      const exported = sdk.exportClassSummary(summary, { format: 'lesson_review' });

      expect(exported).toContain('教案复盘');
      expect(exported).toContain('核心指标');
      expect(exported).toContain('共性问题');
      expect(exported).toContain('讲解顺序建议');
      expect(exported).toContain('教研组简报');
    });

    it('should include teaching group conclusion in lesson review', () => {
      const summary = sdk.generateClassSummary('review-task', 'class-review', 6);
      const exported = sdk.exportClassSummary(summary, { format: 'lesson_review' });

      expect(exported).toContain(summary.classId);
      expect(exported).toMatch(/及格率|及格/);
      expect(exported).toMatch(/优秀率|优秀/);
    });

    it('should format filtered summary with student details', () => {
      const view = sdk.generateFilteredSummaryByTag('review-task', 'class-review', 6, 'application');
      const formatted = sdk.formatFilteredSummary(view);

      expect(formatted).toContain('建议讲解顺序');
      expect(formatted).toContain('专项分析');
    });
  });

  describe('Student Detail Filtering & Growth', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'growth-task1',
        title: '第一次作业',
        classId: 'class-growth',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy,
      });

      sdk.createTask({
        taskId: 'growth-task2',
        title: '第二次作业',
        classId: 'class-growth',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy,
      });

      const firstAnswers: Record<string, Record<string, unknown>> = {
        'g-stu1': { q1: 'B', q3: 'x=40' },
        'g-stu2': { q1: 'A', q3: 'x=30' },
        'g-stu3': { q1: 'B', q3: '设未知数，2x+10=94，x=42。验证正确。' },
      };

      for (const [sid, ans] of Object.entries(firstAnswers)) {
        sdk.submitAnswer('growth-task1', {
          questionId: 'q1', answer: ans.q1 as never, studentId: sid,
          submissionTime: new Date(), attemptNumber: 1,
        });
        sdk.submitAnswer('growth-task1', {
          questionId: 'q3', answer: ans.q3 as never, studentId: sid,
          submissionTime: new Date(), attemptNumber: 1,
        });
        sdk.gradeSubmission('growth-task1', sid, 'q1');
        sdk.gradeSubmission('growth-task1', sid, 'q3');
      }

      const secondAnswers: Record<string, Record<string, unknown>> = {
        'g-stu1': { q1: 'B', q3: '设x为未知数，2x+10=94，x=42。验证正确。' },
        'g-stu2': { q1: 'B', q3: '2x+10=94，x=42。' },
        'g-stu3': { q1: 'B', q3: '设未知数，列方程2x+10=94，解方程得x=42。' },
      };

      for (const [sid, ans] of Object.entries(secondAnswers)) {
        sdk.submitAnswer('growth-task2', {
          questionId: 'q1', answer: ans.q1 as never, studentId: sid,
          submissionTime: new Date(), attemptNumber: 1,
        });
        sdk.submitAnswer('growth-task2', {
          questionId: 'q3', answer: ans.q3 as never, studentId: sid,
          submissionTime: new Date(), attemptNumber: 1,
        });
        sdk.gradeSubmission('growth-task2', sid, 'q1');
        sdk.gradeSubmission('growth-task2', sid, 'q3');
      }
    });

    it('should filter students by attention mode', () => {
      const details = sdk.filterStudentDetails('growth-task1', 'foundation', 'class-growth', 3, 'attention');
      for (const d of details) {
        expect(!d.passed || d.percentage < 75).toBe(true);
      }
    });

    it('should filter students by excellent mode', () => {
      const details = sdk.filterStudentDetails('growth-task1', 'foundation', 'class-growth', 3, 'excellent');
      for (const d of details) {
        expect(d.percentage).toBeGreaterThanOrEqual(90);
      }
    });

    it('should filter students by all mode', () => {
      const details = sdk.filterStudentDetails('growth-task1', 'foundation', 'class-growth', 3, 'all');
      expect(details.length).toBeGreaterThan(0);
    });

    it('should respect maxCount in filter', () => {
      const details = sdk.filterStudentDetails('growth-task1', 'foundation', 'class-growth', 3, 'all', 2);
      expect(details.length).toBeLessThanOrEqual(2);
    });

    it('should format student detail list', () => {
      const details = sdk.filterStudentDetails('growth-task1', 'foundation', 'class-growth', 3, 'all');
      const formatted = sdk.formatStudentDetailList(details, 'all');
      expect(formatted).toContain('全部学生');
    });

    it('should generate student growth across tasks', () => {
      const growth = sdk.generateStudentGrowth('g-stu1', ['growth-task1', 'growth-task2']);

      expect(growth.studentId).toBe('g-stu1');
      expect(growth.taskResults.length).toBe(2);
      expect(growth.tagTrends.length).toBeGreaterThan(0);
      expect(growth.latestImprovement).toBeDefined();
    });

    it('should show improvement status', () => {
      const growth = sdk.generateStudentGrowth('g-stu1', ['growth-task1', 'growth-task2']);

      expect(growth.latestImprovement.changeLabel).toBeDefined();
      expect(['improved', 'stable', 'declined']).toContain(growth.latestImprovement.changeLabel);
      expect(growth.latestImprovement.summary.length).toBeGreaterThan(0);
    });

    it('should detect tag trends', () => {
      const growth = sdk.generateStudentGrowth('g-stu1', ['growth-task1', 'growth-task2']);

      expect(growth.tagTrends.length).toBeGreaterThan(0);
      for (const tt of growth.tagTrends) {
        expect(['improving', 'stable', 'declining', 'insufficient_data']).toContain(tt.trend);
      }
    });

    it('should format student growth', () => {
      const growth = sdk.generateStudentGrowth('g-stu1', ['growth-task1', 'growth-task2']);
      const formatted = sdk.formatStudentGrowth(growth);

      expect(formatted).toContain('学生成长追踪');
      expect(formatted).toContain('g-stu1');
      expect(formatted).toContain('历次作业得分');
    });
  });

  describe('Lesson Plan & Templates', () => {
    beforeEach(() => {
      sdk.createTask({
        taskId: 'plan-task',
        title: '教案测试作业',
        classId: 'class-plan',
        questions: [singleChoiceRule, calculationRule],
        retryPolicy,
      });

      const answers: Record<string, Record<string, unknown>> = {
        'p-stu1': { q1: 'B', q3: '设x为未知数，2x+10=94，x=42。验证正确。' },
        'p-stu2': { q1: 'A', q3: 'x=40' },
        'p-stu3': { q1: 'B', q3: '2x=84，x=42。' },
      };

      for (const [sid, ans] of Object.entries(answers)) {
        sdk.submitAnswer('plan-task', {
          questionId: 'q1', answer: ans.q1 as never, studentId: sid,
          submissionTime: new Date(), attemptNumber: 1,
        });
        sdk.submitAnswer('plan-task', {
          questionId: 'q3', answer: ans.q3 as never, studentId: sid,
          submissionTime: new Date(), attemptNumber: 1,
        });
        sdk.gradeSubmission('plan-task', sid, 'q1');
        sdk.gradeSubmission('plan-task', sid, 'q3');
      }
    });

    it('should generate lesson plan with three sections', () => {
      const plan = sdk.generateLessonPlan('plan-task', 'class-plan', 5);

      expect(plan.preClassReview.title).toBe('课前回顾');
      expect(plan.classFocus.title).toBe('课堂重点');
      expect(plan.postClassPractice.title).toBe('课后练习');
    });

    it('should have teaching sequence items', () => {
      const plan = sdk.generateLessonPlan('plan-task', 'class-plan', 5);

      expect(plan.teachingSequence.length).toBeGreaterThan(0);
      for (const ts of plan.teachingSequence) {
        expect(['low_score_question', 'common_error', 'excellent_example']).toContain(ts.type);
        expect(ts.order).toBeGreaterThan(0);
        expect(ts.detail.length).toBeGreaterThan(0);
      }
    });

    it('should format lesson plan', () => {
      const plan = sdk.generateLessonPlan('plan-task', 'class-plan', 5);
      const formatted = sdk.formatLessonPlan(plan, '教案测试作业');

      expect(formatted).toContain('教案');
      expect(formatted).toContain('课前回顾');
      expect(formatted).toContain('课堂重点');
      expect(formatted).toContain('课后练习');
      expect(formatted).toContain('讲解顺序');
    });

    it('should export batch feedback with parent communication template', () => {
      const batchResult = sdk.generateBatchFeedback({
        taskId: 'plan-task',
        studentIds: ['p-stu1', 'p-stu2'],
      });
      const exported = sdk.exportBatchFeedback(batchResult, {
        view: 'by_student',
        studentId: 'p-stu1',
        template: 'parent_communication',
      });

      expect(exported).toContain('家长沟通版');
      expect(exported).toContain('家长您好');
    });

    it('should export batch feedback with student self-eval template', () => {
      const batchResult = sdk.generateBatchFeedback({
        taskId: 'plan-task',
        studentIds: ['p-stu1'],
      });
      const exported = sdk.exportBatchFeedback(batchResult, {
        view: 'by_student',
        studentId: 'p-stu1',
        template: 'student_self_eval',
      });

      expect(exported).toContain('学生自评版');
      expect(exported).toContain('自评问题');
    });

    it('should export question with parent communication template', () => {
      const batchResult = sdk.generateBatchFeedback({
        taskId: 'plan-task',
        studentIds: ['p-stu1', 'p-stu2', 'p-stu3'],
        questionIds: ['q1'],
      });
      const exported = sdk.exportBatchFeedback(batchResult, {
        view: 'by_question',
        questionId: 'q1',
        template: 'parent_communication',
      });

      expect(exported).toContain('家长沟通话术');
    });

    it('should export question with student self-eval template', () => {
      const batchResult = sdk.generateBatchFeedback({
        taskId: 'plan-task',
        studentIds: ['p-stu1', 'p-stu2', 'p-stu3'],
        questionIds: ['q1'],
      });
      const exported = sdk.exportBatchFeedback(batchResult, {
        view: 'by_question',
        questionId: 'q1',
        template: 'student_self_eval',
      });

      expect(exported).toContain('学生自评引导');
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
