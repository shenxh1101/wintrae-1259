import { StepRule, StepScore, AnswerValue } from '../types';

export class StepGrader {
  grade(answer: AnswerValue, steps: StepRule[]): StepScore[] {
    return steps.map(step => this.gradeSingleStep(answer, step));
  }

  calculateStepScore(scores: StepScore[]): number {
    return scores.reduce((sum, score) => sum + score.earnedScore, 0);
  }

  getMaxStepScore(steps: StepRule[]): number {
    return steps.reduce((sum, step) => sum + step.score, 0);
  }

  private gradeSingleStep(answer: AnswerValue, step: StepRule): StepScore {
    let earnedScore = 0;
    let passed = false;

    if (step.expectedContent && typeof answer === 'string') {
      const answerLower = answer.toLowerCase();
      const expectedLower = step.expectedContent.toLowerCase();

      if (answerLower.includes(expectedLower)) {
        earnedScore = step.score;
        passed = true;
      } else if (step.keywords && step.keywords.length > 0) {
        const matchedKeywords = step.keywords.filter(kw =>
          answerLower.includes(kw.toLowerCase()),
        );
        const matchRate = matchedKeywords.length / step.keywords.length;

        if (matchRate >= 0.8) {
          earnedScore = step.score;
          passed = true;
        } else if (matchRate >= 0.5) {
          earnedScore = Math.round(step.score * 0.5);
          passed = false;
        } else if (matchRate > 0) {
          earnedScore = Math.round(step.score * 0.2);
          passed = false;
        }
      }
    } else if (step.keywords && step.keywords.length > 0 && typeof answer === 'string') {
      const answerLower = answer.toLowerCase();
      const matchedKeywords = step.keywords.filter(kw =>
        answerLower.includes(kw.toLowerCase()),
      );
      const matchRate = matchedKeywords.length / step.keywords.length;

      if (matchRate >= 1) {
        earnedScore = step.score;
        passed = true;
      } else if (matchRate >= 0.7) {
        earnedScore = Math.round(step.score * 0.7);
        passed = false;
      } else if (matchRate >= 0.4) {
        earnedScore = Math.round(step.score * 0.4);
        passed = false;
      }
    }

    return {
      stepId: step.id,
      description: step.description,
      earnedScore,
      maxScore: step.score,
      passed,
      feedback: this.generateStepFeedback(step, earnedScore, passed),
    };
  }

  private generateStepFeedback(
    step: StepRule,
    earnedScore: number,
    passed: boolean,
  ): string | undefined {
    if (passed) {
      const excellent = [
        `很好！"${step.description}"这一步完成得非常出色。`,
        `"${step.description}"步骤正确，继续保持！`,
        `完美！"${step.description}"这一步没有问题。`,
      ];
      return excellent[Math.floor(Math.random() * excellent.length)];
    } else if (earnedScore > 0) {
      return `"${step.description}"这一步部分正确，可以再仔细检查一下。`;
    } else {
      return `"${step.description}"这一步需要改进，请参考解析重新思考。`;
    }
  }
}
