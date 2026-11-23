/** One question of a lesson's quick check (GET .../lessons/{lesson}/quick-check). */
export interface QuickCheckQuestion {
  question: string;
  options: string[];
  /** Index into options of the right answer. */
  answer: number;
  explain: string;
}

/** Number of questions answered correctly; unanswered questions (undefined) count as wrong. */
export function quickCheckScore(
  questions: QuickCheckQuestion[],
  chosen: (number | undefined)[],
): number {
  return questions.filter((q, i) => chosen[i] === q.answer).length;
}
