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
