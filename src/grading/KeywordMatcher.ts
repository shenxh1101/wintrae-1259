import { KeywordRule, KeywordMatch, AnswerValue } from '../types';

export class KeywordMatcher {
  match(answer: AnswerValue, rules: KeywordRule[]): KeywordMatch[] {
    if (!answer || typeof answer !== 'string') {
      return rules.map(rule => ({
        word: rule.word,
        matched: false,
        earnedScore: 0,
        maxScore: rule.score,
      }));
    }

    return rules.map(rule => this.matchSingleKeyword(answer, rule));
  }

  private matchSingleKeyword(answer: string, rule: KeywordRule): KeywordMatch {
    const searchWords = [rule.word, ...(rule.synonym || [])];
    const flags = rule.caseSensitive ? 'g' : 'gi';

    let matched = false;
    let matchedSynonym: string | undefined;
    let position: number | undefined;

    for (const word of searchWords) {
      const regex = new RegExp(this.escapeRegex(word), flags);
      const match = regex.exec(answer);
      if (match) {
        matched = true;
        matchedSynonym = word === rule.word ? undefined : word;
        position = match.index;
        break;
      }
    }

    return {
      word: rule.word,
      matched,
      earnedScore: matched ? rule.score : 0,
      maxScore: rule.score,
      position,
      matchedSynonym,
    };
  }

  calculateKeywordScore(matches: KeywordMatch[]): number {
    return matches.reduce((sum, match) => sum + match.earnedScore, 0);
  }

  checkRequiredKeywords(matches: KeywordMatch[], rules: KeywordRule[]): string[] {
    const missingRequired: string[] = [];

    for (const rule of rules) {
      if (rule.required) {
        const match = matches.find(m => m.word === rule.word);
        if (!match || !match.matched) {
          missingRequired.push(rule.word);
        }
      }
    }

    return missingRequired;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
