import { InputValidationRule, AnswerValue, ValidationResult } from '../types';

export class InputValidator {
  validate(answer: AnswerValue, rule?: InputValidationRule): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rule) {
      return { valid: true, errors: [], warnings: [] };
    }

    if (rule.required && (answer === null || answer === undefined || answer === '')) {
      errors.push('答案不能为空');
      return { valid: false, errors, warnings };
    }

    if (answer === null || answer === undefined || answer === '') {
      return { valid: true, errors: [], warnings: [] };
    }

    switch (rule.type) {
      case 'string':
        this.validateString(answer, rule, errors, warnings);
        break;
      case 'number':
        this.validateNumber(answer, rule, errors, warnings);
        break;
      case 'array':
        this.validateArray(answer, rule, errors, warnings);
        break;
      case 'boolean':
        this.validateBoolean(answer, rule, errors, warnings);
        break;
      case 'code':
        this.validateCode(answer, rule, errors, warnings);
        break;
      default:
        break;
    }

    if (rule.allowedValues && rule.allowedValues.length > 0) {
      this.validateAllowedValues(answer, rule.allowedValues, errors);
    }

    if (rule.pattern) {
      this.validatePattern(answer, rule.pattern, errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateString(
    answer: AnswerValue,
    rule: InputValidationRule,
    errors: string[],
    warnings: string[],
  ): void {
    if (typeof answer !== 'string') {
      errors.push('答案必须是字符串类型');
      return;
    }

    if (rule.minLength !== undefined && answer.length < rule.minLength) {
      errors.push(`答案长度不能少于 ${rule.minLength} 个字符`);
    }

    if (rule.maxLength !== undefined && answer.length > rule.maxLength) {
      errors.push(`答案长度不能超过 ${rule.maxLength} 个字符`);
    }
  }

  private validateNumber(
    answer: AnswerValue,
    rule: InputValidationRule,
    errors: string[],
    _warnings: string[],
  ): void {
    const numValue = typeof answer === 'number' ? answer : parseFloat(String(answer));

    if (isNaN(numValue)) {
      errors.push('答案必须是有效的数字');
      return;
    }

    if (rule.min !== undefined && numValue < rule.min) {
      errors.push(`答案不能小于 ${rule.min}`);
    }

    if (rule.max !== undefined && numValue > rule.max) {
      errors.push(`答案不能大于 ${rule.max}`);
    }
  }

  private validateArray(
    answer: AnswerValue,
    rule: InputValidationRule,
    errors: string[],
    warnings: string[],
  ): void {
    if (!Array.isArray(answer)) {
      errors.push('答案必须是数组类型');
      return;
    }

    if (rule.minLength !== undefined && answer.length < rule.minLength) {
      errors.push(`至少需要选择 ${rule.minLength} 个选项`);
    }

    if (rule.maxLength !== undefined && answer.length > rule.maxLength) {
      errors.push(`最多只能选择 ${rule.maxLength} 个选项`);
    }

    if (answer.length === 0) {
      warnings.push('未选择任何选项');
    }
  }

  private validateBoolean(
    answer: AnswerValue,
    _rule: InputValidationRule,
    errors: string[],
    _warnings: string[],
  ): void {
    if (typeof answer !== 'boolean') {
      errors.push('答案必须是布尔类型');
    }
  }

  private validateCode(
    answer: AnswerValue,
    rule: InputValidationRule,
    errors: string[],
    warnings: string[],
  ): void {
    if (typeof answer !== 'string') {
      errors.push('代码答案必须是字符串类型');
      return;
    }

    if (rule.minLength !== undefined && answer.length < rule.minLength) {
      warnings.push('代码可能过于简短，请确保逻辑完整');
    }

    if (rule.maxLength !== undefined && answer.length > rule.maxLength) {
      warnings.push('代码较长，建议优化精简');
    }

    const trimmedAnswer = answer.trim();
    if (trimmedAnswer.length === 0) {
      errors.push('代码不能为空');
    }
  }

  private validateAllowedValues(
    answer: AnswerValue,
    allowedValues: string[],
    errors: string[],
  ): void {
    const answerStr = Array.isArray(answer)
      ? answer.map(String)
      : [String(answer)];

    for (const val of answerStr) {
      if (!allowedValues.includes(val)) {
        errors.push(`无效的选项值: ${val}`);
      }
    }
  }

  private validatePattern(
    answer: AnswerValue,
    pattern: string,
    errors: string[],
  ): void {
    try {
      const regex = new RegExp(pattern);
      const answerStr = String(answer);
      if (!regex.test(answerStr)) {
        errors.push('答案格式不正确');
      }
    } catch {
      errors.push('格式校验规则配置错误');
    }
  }
}
