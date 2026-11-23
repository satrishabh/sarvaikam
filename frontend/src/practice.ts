export interface PracticeQuestion {
  id: string;
  category: string;
  title: string;
  difficulty: string;
  minutes: number;
  topic: string;
  prompt: string;
  constraints: string[];
  hints: string[];
  criteria: string[];
  outline: string[];
}

/** The first practice exercise for a topic, if one is published. */
export function practiceForTopic(topicSlug: string, questions: PracticeQuestion[]): PracticeQuestion | undefined {
  return questions.find((q) => q.topic === topicSlug);
}
