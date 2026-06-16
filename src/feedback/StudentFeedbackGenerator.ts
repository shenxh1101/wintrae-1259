import {
  GradingResult,
  StudentFeedback,
  StepFeedback,
  KeywordFeedback,
  ErrorFeedback,
} from '../types';
import { ErrorClassifier } from '../grading/ErrorClassifier';

export class StudentFeedbackGenerator {
  private errorClassifier: ErrorClassifier = new ErrorClassifier();

  generate(result: GradingResult): StudentFeedback {
    const overallMessage = this.generateOverallMessage(result);
    const strengths = this.generateStrengths(result);
    const improvements = this.generateImprovements(result);
    const stepFeedback = this.generateStepFeedback(result);
    const keywordFeedback = this.generateKeywordFeedback(result);
    const errorFeedback = this.generateErrorFeedback(result);
    const suggestions = this.generateSuggestions(result);
    const encouragement = this.generateEncouragement(result);
    const nextSteps = this.generateNextSteps(result);

    return {
      questionId: result.questionId,
      studentId: result.studentId,
      overallMessage,
      strengths,
      improvements,
      stepFeedback,
      keywordFeedback,
      errorFeedback,
      suggestions,
      encouragement,
      nextSteps,
    };
  }

  private generateOverallMessage(result: GradingResult): string {
    const percentage = result.percentage;

    if (percentage >= 90) {
      return `太棒了！你的得分是 ${result.earnedScore}/${result.totalScore} 分，表现非常优秀！`;
    } else if (percentage >= 80) {
      return `很好！你的得分是 ${result.earnedScore}/${result.totalScore} 分，继续保持！`;
    } else if (percentage >= 60) {
      return `不错！你的得分是 ${result.earnedScore}/${result.totalScore} 分，还有提升空间。`;
    } else if (percentage >= 40) {
      return `你的得分是 ${result.earnedScore}/${result.totalScore} 分，需要加强练习。`;
    } else if (percentage > 0) {
      return `你的得分是 ${result.earnedScore}/${result.totalScore} 分，建议回顾相关知识点。`;
    } else {
      return `很遗憾，这次没有得分。别灰心，看看解析再试一次！`;
    }
  }

  private generateStrengths(result: GradingResult): string[] {
    const strengths: string[] = [];

    if (result.percentage >= 80) {
      strengths.push('整体表现优秀，对知识点掌握良好');
    }

    if (result.stepScores) {
      const passedSteps = result.stepScores.filter(s => s.passed);
      if (passedSteps.length > 0) {
        const stepNames = passedSteps.map(s => `"${s.description}"`).join('、');
        strengths.push(`${stepNames} 步骤完成出色`);
      }

      if (passedSteps.length === result.stepScores.length && result.stepScores.length > 1) {
        strengths.push('解题过程完整，逻辑清晰');
      }
    }

    if (result.keywordMatches) {
      const matchedKeywords = result.keywordMatches.filter(km => km.matched);
      if (matchedKeywords.length >= 2) {
        const words = matchedKeywords.map(km => `"${km.word}"`).join('、');
        strengths.push(`正确使用了关键术语 ${words}`);
      }
    }

    if (result.percentage >= 60 && result.attemptNumber > 1) {
      strengths.push(`在第 ${result.attemptNumber} 次尝试中取得了进步`);
    }

    if (strengths.length === 0 && result.percentage > 0) {
      strengths.push('尝试作答，展现了学习态度');
    }

    return strengths;
  }

  private generateImprovements(result: GradingResult): string[] {
    const improvements: string[] = [];

    if (result.stepScores) {
      const failedSteps = result.stepScores.filter(s => !s.passed && s.earnedScore === 0);
      if (failedSteps.length > 0) {
        const stepNames = failedSteps.map(s => `"${s.description}"`).join('、');
        improvements.push(`需要加强 ${stepNames} 步骤的练习`);
      }

      const partialSteps = result.stepScores.filter(
        s => s.earnedScore > 0 && s.earnedScore < s.maxScore,
      );
      if (partialSteps.length > 0) {
        improvements.push('部分步骤的准确性有待提高');
      }
    }

    if (result.keywordMatches) {
      const missedKeywords = result.keywordMatches.filter(
        km => !km.matched && km.maxScore > 0,
      );
      if (missedKeywords.length > 0) {
        const words = missedKeywords.map(km => `"${km.word}"`).join('、');
        improvements.push(`答案中可以加入 ${words} 等关键术语`);
      }
    }

    if (result.errors && result.errors.length > 0) {
      const highSeverityErrors = result.errors.filter(e => e.severity === 'high');
      if (highSeverityErrors.length > 0) {
        improvements.push('存在需要重点关注的错误类型');
      }
    }

    if (result.percentage < 60 && result.percentage > 0) {
      improvements.push('建议回顾基础概念，打好知识根基');
    }

    return improvements;
  }

  private generateStepFeedback(result: GradingResult): StepFeedback[] {
    if (!result.stepScores) return [];

    return result.stepScores.map(step => {
      const ratio = step.maxScore > 0 ? step.earnedScore / step.maxScore : 0;
      let status: StepFeedback['status'];
      let message: string;

      if (ratio === 1) {
        status = 'excellent';
        message = `步骤 "${step.description}" 完成得非常好，获得满分 ${step.earnedScore}/${step.maxScore} 分`;
      } else if (ratio >= 0.7) {
        status = 'good';
        message = `步骤 "${step.description}" 基本正确，获得 ${step.earnedScore}/${step.maxScore} 分`;
      } else if (ratio > 0) {
        status = 'partial';
        message = `步骤 "${step.description}" 部分正确，获得 ${step.earnedScore}/${step.maxScore} 分，还需改进`;
      } else if (step.earnedScore === 0 && step.maxScore > 0) {
        status = 'incorrect';
        message = `步骤 "${step.description}" 存在错误，未获得分数`;
      } else {
        status = 'missing';
        message = `步骤 "${step.description}" 缺失`;
      }

      return {
        stepId: step.stepId,
        description: step.description,
        status,
        message,
        earnedScore: step.earnedScore,
        maxScore: step.maxScore,
      };
    });
  }

  private generateKeywordFeedback(result: GradingResult): KeywordFeedback[] {
    if (!result.keywordMatches) return [];

    return result.keywordMatches.map(km => {
      let message: string;
      if (km.matched) {
        message = km.matchedSynonym
          ? `正确使用了 "${km.word}"（通过同义词 "${km.matchedSynonym}" 识别），获得 ${km.earnedScore} 分`
          : `正确使用了关键词 "${km.word}"，获得 ${km.earnedScore} 分`;
      } else {
        message = `未使用关键词 "${km.word}"，可以考虑加入这个术语`;
      }

      return {
        word: km.word,
        matched: km.matched,
        message,
        earnedScore: km.earnedScore,
        maxScore: km.maxScore,
      };
    });
  }

  private generateErrorFeedback(result: GradingResult): ErrorFeedback[] {
    if (!result.errors || result.errors.length === 0) return [];

    return result.errors.map(error => ({
      category: error.category,
      categoryName: this.errorClassifier.getCategoryName(error.category),
      description: error.description,
      suggestion: error.suggestion || '请仔细检查并改正',
      severity: error.severity,
    }));
  }

  private generateSuggestions(result: GradingResult): string[] {
    const suggestions: string[] = [];
    const percentage = result.percentage;

    if (percentage < 60) {
      suggestions.push('建议重新学习相关章节的基础概念');
    }

    if (result.errors?.some(e => e.category === 'calculation_error')) {
      suggestions.push('计算完成后建议进行验算，提高准确性');
    }

    if (result.errors?.some(e => e.category === 'missing_step')) {
      suggestions.push('解题时注意步骤完整性，不要跳过关键环节');
    }

    if (result.errors?.some(e => e.category === 'conceptual_mistake')) {
      suggestions.push('建议通过实例加深对概念的理解');
    }

    if (result.stepScores && result.stepScores.length > 0) {
      const failedSteps = result.stepScores.filter(s => s.earnedScore === 0);
      if (failedSteps.length > 0) {
        suggestions.push('参考解析，理解每个解题步骤的原理');
      }
    }

    if (percentage >= 80 && percentage < 95) {
      suggestions.push('注意细节，争取获得更高分数');
    }

    return suggestions;
  }

  private generateEncouragement(result: GradingResult): string {
    const percentage = result.percentage;

    if (percentage >= 90) {
      return '优秀！你的努力得到了回报，继续保持这份认真和专注！';
    } else if (percentage >= 70) {
      return '做得不错！每一次进步都是成长的见证，继续加油！';
    } else if (percentage >= 50) {
      return '你已经迈出了重要的一步！再努力一点，就能看到更大的进步！';
    } else if (percentage > 0) {
      return '别灰心！学习是一个过程，每一次尝试都在为成功积累经验。';
    } else {
      return '别灰心！每个人都有从零开始的时候。看看解析，理解后再试一次，你一定可以的！';
    }
  }

  private generateNextSteps(result: GradingResult): string[] {
    const nextSteps: string[] = [];
    const percentage = result.percentage;

    if (percentage < 60) {
      nextSteps.push('复习相关知识点，夯实基础');
      nextSteps.push('完成几道同类型的基础练习题');
    }

    if (result.stepScores) {
      const failedSteps = result.stepScores.filter(s => s.earnedScore === 0);
      if (failedSteps.length > 0) {
        nextSteps.push('对照参考答案，理解每个解题步骤');
      }
    }

    if (result.errors?.some(e => e.category === 'calculation_error')) {
      nextSteps.push('进行专门的计算练习，提高计算准确率');
    }

    if (percentage >= 80) {
      nextSteps.push('尝试挑战更高难度的同类题目');
      nextSteps.push('总结解题方法，形成自己的解题思路');
    }

    if (nextSteps.length === 0) {
      nextSteps.push('继续保持良好的学习状态');
      nextSteps.push('帮助同学讲解这道题目，加深理解');
    }

    return nextSteps;
  }
}
