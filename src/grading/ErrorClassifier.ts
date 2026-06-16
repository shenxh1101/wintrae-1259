import { ErrorCategory, ErrorInstance, AnswerValue, StepScore, KeywordMatch } from '../types';

export interface ClassificationContext {
  answer: AnswerValue;
  correctAnswer: AnswerValue;
  stepScores?: StepScore[];
  keywordMatches?: KeywordMatch[];
  earnedScore: number;
  totalScore: number;
}

export class ErrorClassifier {
  private categoryNames: Record<ErrorCategory, string> = {
    conceptual_mistake: '概念错误',
    calculation_error: '计算错误',
    missing_step: '步骤缺失',
    wrong_approach: '方法错误',
    careless_mistake: '粗心错误',
    format_error: '格式错误',
    incomplete_answer: '答案不完整',
    irrelevant_content: '内容不相关',
    grammar_error: '语法错误',
    logic_error: '逻辑错误',
  };

  classify(context: ClassificationContext): ErrorInstance[] {
    const errors: ErrorInstance[] = [];

    if (context.answer === null || context.answer === undefined || context.answer === '') {
      errors.push(this.createError('incomplete_answer', '未提交答案', 'high', '请填写完整答案'));
      return errors;
    }

    this.classifyFormatErrors(context, errors);
    this.classifyContentErrors(context, errors);
    this.classifyStepErrors(context, errors);
    this.classifyKeywordErrors(context, errors);

    return errors;
  }

  getCategoryName(category: ErrorCategory): string {
    return this.categoryNames[category] || category;
  }

  private classifyFormatErrors(context: ClassificationContext, errors: ErrorInstance[]): void {
    const answerStr = String(context.answer);

    if (answerStr.trim().length < 5 && context.totalScore > 5) {
      errors.push(
        this.createError(
          'incomplete_answer',
          '答案过于简短',
          'medium',
          '请补充详细的解答过程和说明',
        ),
      );
    }

    if (typeof context.answer === 'string' && context.answer.length > 0) {
      const trimmed = context.answer.trim();
      if (trimmed !== context.answer) {
        errors.push(
          this.createError('format_error', '答案包含多余的空白字符', 'low', '请注意答案格式规范'),
        );
      }

      if (this.hasCommonTypos(context.answer)) {
        errors.push(
          this.createError(
            'careless_mistake',
            '答案中可能存在拼写或打字错误',
            'low',
            '请仔细检查答案的文字表述',
          ),
        );
      }
    }

    if (typeof context.answer === 'string' && typeof context.correctAnswer === 'string') {
      if (this.hasGrammarIssues(context.answer, context.correctAnswer)) {
        errors.push(
          this.createError(
            'grammar_error',
            '答案存在语法或表达问题',
            'medium',
            '注意语法规范和表达准确性',
          ),
        );
      }
    }
  }

  private classifyContentErrors(context: ClassificationContext, errors: ErrorInstance[]): void {
    const percentage = context.totalScore > 0 ? context.earnedScore / context.totalScore : 0;

    if (percentage === 0) {
      if (this.isCompletelyIrrelevant(context.answer, context.correctAnswer)) {
        errors.push(
          this.createError(
            'irrelevant_content',
            '答案与题目要求无关',
            'high',
            '请仔细审题，确保回答针对题目要求',
          ),
        );
      } else {
        errors.push(
          this.createError(
            'conceptual_mistake',
            '对知识点的理解存在根本性错误',
            'high',
            '建议重新学习相关概念，理解核心原理后再作答',
          ),
        );
      }
    } else if (percentage < 0.3) {
      errors.push(
        this.createError(
          'wrong_approach',
          '解题思路或方法存在较大偏差',
            'high',
          '建议回顾解题方法，寻找正确的解题路径',
        ),
      );
    } else if (percentage < 0.6) {
      errors.push(
        this.createError(
          'conceptual_mistake',
          '对部分概念的理解存在偏差',
          'medium',
          '建议加强对相关概念的理解和应用练习',
        ),
      );
    } else if (percentage < 0.8 && context.stepScores) {
      const partialSteps = context.stepScores.filter(
        s => s.earnedScore > 0 && s.earnedScore < s.maxScore,
      );
      if (partialSteps.length > 0) {
        errors.push(
          this.createError(
            'calculation_error',
            '部分计算或推导存在误差',
            'low',
            '注意计算过程的准确性，建议进行验算',
          ),
        );
      }
    }
  }

  private classifyStepErrors(context: ClassificationContext, errors: ErrorInstance[]): void {
    if (!context.stepScores || context.stepScores.length === 0) return;

    const missingSteps = context.stepScores.filter(s => s.earnedScore === 0);
    const partialSteps = context.stepScores.filter(
      s => s.earnedScore > 0 && s.earnedScore < s.maxScore,
    );

    if (missingSteps.length > 0) {
      const missingNames = missingSteps.map(s => `"${s.description}"`).join('、');
      errors.push(
        this.createError(
          'missing_step',
          `缺少关键解题步骤: ${missingNames}`,
          'high',
          '确保解题过程完整，不要跳过关键步骤',
        ),
      );
    }

    if (partialSteps.length > 0) {
      errors.push(
        this.createError(
          'logic_error',
          '部分步骤的逻辑推导不够严谨',
          'medium',
          '检查每一步的推导逻辑，确保论据充分',
        ),
      );
    }
  }

  private classifyKeywordErrors(context: ClassificationContext, errors: ErrorInstance[]): void {
    if (!context.keywordMatches || context.keywordMatches.length === 0) return;

    const missedKeywords = context.keywordMatches.filter(km => !km.matched && km.maxScore > 0);

    if (missedKeywords.length >= 2) {
      const missedWords = missedKeywords.map(km => `"${km.word}"`).join('、');
      errors.push(
        this.createError(
          'conceptual_mistake',
          `答案中缺少关键术语或概念: ${missedWords}`,
          'medium',
          '建议使用专业术语准确表达，确保覆盖核心概念',
        ),
      );
    }
  }

  private createError(
    category: ErrorCategory,
    description: string,
    severity: 'low' | 'medium' | 'high',
    suggestion: string,
  ): ErrorInstance {
    return { category, description, severity, suggestion };
  }

  private hasCommonTypos(text: string): boolean {
    const commonMistakes = [/的地得/g, /在再/g, /做作/g];
    return false;
  }

  private hasGrammarIssues(answer: string, _correct: string): boolean {
    if (answer.length < 10) return false;
    const hasLongSentence = answer.split(/[。！？.!?]/).some(s => s.length > 100);
    return hasLongSentence;
  }

  private isCompletelyIrrelevant(answer: AnswerValue, correct: AnswerValue): boolean {
    if (typeof answer !== 'string' || typeof correct !== 'string') return false;

    const answerWords = new Set(answer.toLowerCase().split(/\s+/));
    const correctWords = new Set(correct.toLowerCase().split(/\s+/));

    let overlap = 0;
    for (const word of answerWords) {
      if (correctWords.has(word)) overlap++;
    }

    return overlap === 0 && answerWords.size > 3;
  }
}
