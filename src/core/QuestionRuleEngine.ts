import { QuestionRule, QuestionType, QuestionOption, ValidationResult } from '../types';
import { InputValidator } from './InputValidator';

export class QuestionRuleEngine {
  private rules: Map<string, QuestionRule> = new Map();
  private validator: InputValidator = new InputValidator();

  registerRule(rule: QuestionRule): void {
    this.validateRule(rule);
    this.rules.set(rule.questionId, rule);
  }

  registerRules(rules: QuestionRule[]): void {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }

  getRule(questionId: string): QuestionRule | undefined {
    return this.rules.get(questionId);
  }

  hasRule(questionId: string): boolean {
    return this.rules.has(questionId);
  }

  getAllRules(): QuestionRule[] {
    return Array.from(this.rules.values());
  }

  validateAnswer(
    questionId: string,
    answer: unknown,
  ): ValidationResult {
    const rule = this.getRule(questionId);
    if (!rule) {
      return {
        valid: false,
        errors: [`未找到题目 ${questionId} 的批改规则`],
        warnings: [],
      };
    }

    const typeValidation = this.validateAnswerType(rule.questionType, answer);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    const formatValidation = this.validator.validate(answer as never, rule.validation);

    return {
      valid: typeValidation.valid && formatValidation.valid,
      errors: [...typeValidation.errors, ...formatValidation.errors],
      warnings: [...typeValidation.warnings, ...formatValidation.warnings],
    };
  }

  private validateRule(rule: QuestionRule): void {
    const errors: string[] = [];

    if (!rule.questionId) {
      errors.push('题目ID不能为空');
    }

    if (rule.totalScore <= 0) {
      errors.push('题目总分必须大于0');
    }

    if (rule.passScore < 0 || rule.passScore > rule.totalScore) {
      errors.push('及格分数必须在0到总分之间');
    }

    if (rule.allowPartialScore && !rule.steps && !rule.keywords) {
      errors.push('启用部分得分时，必须配置步骤规则或关键词规则');
    }

    this.validateTypeSpecificRules(rule, errors);

    if (errors.length > 0) {
      throw new Error(`题目规则配置错误: ${errors.join('; ')}`);
    }
  }

  private validateTypeSpecificRules(rule: QuestionRule, errors: string[]): void {
    switch (rule.questionType) {
      case 'single_choice':
      case 'multiple_choice':
        if (!rule.options || rule.options.length < 2) {
          errors.push('选择题至少需要2个选项');
        }
        if (rule.questionType === 'single_choice') {
          const correctCount = rule.options?.filter(o => o.isCorrect).length || 0;
          if (correctCount !== 1) {
            errors.push('单选题必须且只能有一个正确答案');
          }
        }
        break;
      case 'true_false':
        if (typeof rule.correctAnswer !== 'boolean') {
          errors.push('判断题的正确答案必须是布尔类型');
        }
        break;
      case 'fill_blank':
        if (!rule.correctAnswer && !rule.acceptedAnswers) {
          errors.push('填空题必须配置正确答案或可接受答案列表');
        }
        break;
      case 'calculation':
        if (rule.correctAnswer === undefined || rule.correctAnswer === null) {
          errors.push('计算题必须配置正确答案');
        }
        break;
      default:
        break;
    }
  }

  private validateAnswerType(
    questionType: QuestionType,
    answer: unknown,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (questionType) {
      case 'single_choice':
        if (typeof answer !== 'string' && typeof answer !== 'number') {
          errors.push('单选题答案必须是字符串或数字');
        }
        break;
      case 'multiple_choice':
        if (!Array.isArray(answer)) {
          errors.push('多选题答案必须是数组');
        } else if (answer.length === 0) {
          warnings.push('未选择任何选项');
        }
        break;
      case 'true_false':
        if (typeof answer !== 'boolean') {
          errors.push('判断题答案必须是布尔类型');
        }
        break;
      case 'fill_blank':
      case 'short_answer':
      case 'essay':
        if (typeof answer !== 'string') {
          errors.push('文本类题目答案必须是字符串');
        }
        break;
      case 'calculation':
        if (typeof answer !== 'number' && typeof answer !== 'string') {
          errors.push('计算题答案必须是数字或字符串');
        }
        break;
      case 'coding':
        if (typeof answer !== 'string') {
          errors.push('编程题答案必须是代码字符串');
        }
        break;
      default:
        errors.push('未知的题目类型');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getCorrectOptions(questionId: string): QuestionOption[] {
    const rule = this.getRule(questionId);
    if (!rule || !rule.options) return [];
    return rule.options.filter(o => o.isCorrect);
  }

  getCorrectAnswer(questionId: string): unknown {
    const rule = this.getRule(questionId);
    if (!rule) return undefined;

    if (rule.correctAnswer !== undefined) {
      return rule.correctAnswer;
    }

    if (rule.acceptedAnswers && rule.acceptedAnswers.length > 0) {
      return rule.acceptedAnswers[0];
    }

    if (rule.options) {
      return rule.options.filter(o => o.isCorrect).map(o => o.id);
    }

    return undefined;
  }
}
