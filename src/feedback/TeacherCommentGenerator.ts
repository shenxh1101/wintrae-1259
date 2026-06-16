import { GradingResult, TeacherCommentDraft } from '../types';
import { ErrorClassifier } from '../grading/ErrorClassifier';

export class TeacherCommentGenerator {
  private errorClassifier: ErrorClassifier = new ErrorClassifier();

  generate(result: GradingResult): TeacherCommentDraft {
    const overallComment = this.generateOverallComment(result);
    const detailedComments = this.generateDetailedComments(result);
    const positivePoints = this.generatePositivePoints(result);
    const areasForImprovement = this.generateAreasForImprovement(result);
    const followUpQuestions = this.generateFollowUpQuestions(result);
    const tags = this.generateTags(result);

    return {
      questionId: result.questionId,
      studentId: result.studentId,
      overallComment,
      detailedComments,
      positivePoints,
      areasForImprovement,
      followUpQuestions,
      tags,
      editable: true,
    };
  }

  private generateOverallComment(result: GradingResult): string {
    const percentage = result.percentage;
    const attemptInfo = result.attemptNumber > 1
      ? `（第${result.attemptNumber}次提交）`
      : '';

    if (percentage >= 90) {
      return `学生${result.studentId}本题表现优秀${attemptInfo}，得分${result.earnedScore}/${result.totalScore}。对知识点掌握扎实，解题思路清晰，能够准确应用相关概念。值得表扬！`;
    } else if (percentage >= 80) {
      return `学生${result.studentId}本题表现良好${attemptInfo}，得分${result.earnedScore}/${result.totalScore}。整体掌握情况不错，存在一些小的疏漏，稍加注意即可达到优秀水平。`;
    } else if (percentage >= 60) {
      return `学生${result.studentId}本题基本达标${attemptInfo}，得分${result.earnedScore}/${result.totalScore}。对基础知识有一定掌握，但在应用层面还需要加强练习。`;
    } else if (percentage >= 40) {
      return `学生${result.studentId}本题表现有待提高${attemptInfo}，得分${result.earnedScore}/${result.totalScore}。对部分概念的理解存在偏差，建议回顾相关知识点后再进行练习。`;
    } else if (percentage > 0) {
      return `学生${result.studentId}本题表现不够理想${attemptInfo}，得分${result.earnedScore}/${result.totalScore}。对核心概念的理解存在较大困难，需要重点辅导。`;
    } else {
      return `学生${result.studentId}本题未获得分数${attemptInfo}。可能对相关知识点完全不理解，或者存在审题失误，需要重点关注和辅导。`;
    }
  }

  private generateDetailedComments(result: GradingResult): string[] {
    const comments: string[] = [];

    if (result.stepScores && result.stepScores.length > 0) {
      const passedSteps = result.stepScores.filter(s => s.passed);
      const partialSteps = result.stepScores.filter(
        s => s.earnedScore > 0 && s.earnedScore < s.maxScore,
      );
      const failedSteps = result.stepScores.filter(s => s.earnedScore === 0);

      if (passedSteps.length > 0) {
        const stepNames = passedSteps.map(s => s.description).join('、');
        comments.push(`以下步骤完成正确：${stepNames}`);
      }

      if (partialSteps.length > 0) {
        const stepNames = partialSteps.map(s => s.description).join('、');
        comments.push(`以下步骤部分正确，需要加强：${stepNames}`);
      }

      if (failedSteps.length > 0) {
        const stepNames = failedSteps.map(s => s.description).join('、');
        comments.push(`以下步骤存在错误或缺失：${stepNames}`);
      }
    }

    if (result.keywordMatches && result.keywordMatches.length > 0) {
      const matched = result.keywordMatches.filter(km => km.matched);
      const missed = result.keywordMatches.filter(km => !km.matched && km.maxScore > 0);

      if (matched.length > 0) {
        const words = matched.map(km => km.word).join('、');
        comments.push(`正确使用了以下关键术语：${words}`);
      }

      if (missed.length > 0) {
        const words = missed.map(km => km.word).join('、');
        comments.push(`未使用以下关键术语：${words}`);
      }
    }

    if (result.errors && result.errors.length > 0) {
      const errorSummary = this.summarizeErrors(result);
      if (errorSummary) {
        comments.push(errorSummary);
      }
    }

    return comments;
  }

  private summarizeErrors(result: GradingResult): string | undefined {
    if (!result.errors || result.errors.length === 0) return undefined;

    const highSeverity = result.errors.filter(e => e.severity === 'high');
    const mediumSeverity = result.errors.filter(e => e.severity === 'medium');

    if (highSeverity.length > 0) {
      const categories = [...new Set(highSeverity.map(e =>
        this.errorClassifier.getCategoryName(e.category),
      ))].join('、');
      return `存在严重错误类型：${categories}，需要重点关注`;
    }

    if (mediumSeverity.length > 0) {
      const categories = [...new Set(mediumSeverity.map(e =>
        this.errorClassifier.getCategoryName(e.category),
      ))].join('、');
      return `存在中等程度错误：${categories}，需要注意改进`;
    }

    return undefined;
  }

  private generatePositivePoints(result: GradingResult): string[] {
    const points: string[] = [];

    if (result.percentage >= 80) {
      points.push('整体掌握程度良好，对知识点理解到位');
    }

    if (result.stepScores) {
      const passedSteps = result.stepScores.filter(s => s.passed);
      if (passedSteps.length === result.stepScores.length && result.stepScores.length > 1) {
        points.push('解题过程完整，步骤清晰，逻辑性强');
      }
    }

    if (result.keywordMatches) {
      const matchedRequired = result.keywordMatches.filter(
        km => km.matched,
      );
      if (matchedRequired.length >= 2) {
        points.push('能够准确运用专业术语进行表达');
      }
    }

    if (result.isPartial && result.percentage >= 50) {
      points.push('虽然未得满分，但展现了较好的思考过程');
    }

    if (result.attemptNumber > 1 && result.percentage >= 60) {
      points.push('能够从错误中学习，多次尝试后取得进步');
    }

    if (result.percentage >= 90 && result.errors && result.errors.length === 0) {
      points.push('答案近乎完美，没有明显错误');
    }

    return points;
  }

  private generateAreasForImprovement(result: GradingResult): string[] {
    const areas: string[] = [];

    if (result.percentage < 60) {
      areas.push('需要加强基础概念的学习和理解');
    }

    if (result.errors) {
      const conceptualErrors = result.errors.filter(
        e => e.category === 'conceptual_mistake' || e.category === 'wrong_approach',
      );
      if (conceptualErrors.length > 0) {
        areas.push('对核心概念的理解存在偏差，建议重新学习相关章节');
      }

      const calculationErrors = result.errors.filter(
        e => e.category === 'calculation_error',
      );
      if (calculationErrors.length > 0) {
        areas.push('计算准确性有待提高，建议养成验算习惯');
      }

      const missingSteps = result.errors.filter(
        e => e.category === 'missing_step',
      );
      if (missingSteps.length > 0) {
        areas.push('解题过程不够完整，存在步骤跳跃');
      }

      const formatErrors = result.errors.filter(
        e => e.category === 'format_error' || e.category === 'grammar_error',
      );
      if (formatErrors.length > 0) {
        areas.push('答案格式和语言表达需要规范');
      }
    }

    if (result.keywordMatches) {
      const missedRequired = result.keywordMatches.filter(
        km => !km.matched && km.maxScore > 0,
      );
      if (missedRequired.length >= 2) {
        areas.push('专业术语的运用不够准确和全面');
      }
    }

    if (result.stepScores && result.stepScores.length > 1) {
      const failedSteps = result.stepScores.filter(s => s.earnedScore === 0);
      if (failedSteps.length > 0) {
        areas.push('部分解题步骤存在根本性错误');
      }
    }

    if (result.percentage < 80 && result.percentage >= 50) {
      areas.push('需要通过更多练习来巩固和熟练应用');
    }

    return areas;
  }

  private generateFollowUpQuestions(result: GradingResult): string[] {
    const questions: string[] = [];

    if (result.percentage < 60) {
      questions.push('是否理解本题考查的核心概念？');
      questions.push('在哪个环节遇到了困难？');
    }

    if (result.errors?.some(e => e.category === 'conceptual_mistake')) {
      questions.push('能否用自己的话解释相关概念？');
    }

    if (result.stepScores) {
      const failedSteps = result.stepScores.filter(s => s.earnedScore === 0);
      if (failedSteps.length > 0) {
        questions.push('能否参考解析后，独立完成出错的步骤？');
      }
    }

    if (result.percentage >= 80 && result.percentage < 95) {
      questions.push('检查一下，是否有因为粗心而失分的地方？');
    }

    if (result.percentage >= 90) {
      questions.push('能否尝试用另一种方法解答此题？');
      questions.push('能否给同学讲解这道题的解题思路？');
    }

    if (result.attemptNumber > 1) {
      questions.push('从之前的错误中学到了什么？');
    }

    return questions;
  }

  private generateTags(result: GradingResult): string[] {
    const tags: string[] = [];

    if (result.percentage >= 90) {
      tags.push('优秀');
    } else if (result.percentage >= 80) {
      tags.push('良好');
    } else if (result.percentage >= 60) {
      tags.push('及格');
    } else {
      tags.push('需关注');
    }

    if (result.isPartial) {
      tags.push('部分得分');
    }

    if (result.attemptNumber > 1) {
      tags.push('多次提交');
    }

    if (result.errors?.some(e => e.severity === 'high')) {
      tags.push('有严重错误');
    }

    if (result.stepScores && result.stepScores.length > 0) {
      const allPassed = result.stepScores.every(s => s.passed);
      if (allPassed) {
        tags.push('步骤完整');
      }
    }

    for (const tag of result.tags) {
      tags.push(tag);
    }

    return tags;
  }
}
