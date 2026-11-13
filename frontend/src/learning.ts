import { Category, TopicSummary, LessonSummary, LearningStage } from "./api";

export interface LearningPath {
  slug: string; name: string; subtitle: string; icon: string; tone: string;
  description: string; topics: string[]; outcomes: string[]; priority: number;
}
export function pathTopics(
  path: LearningPath,
  categories: Category[],
): TopicSummary[] {
  const topics = new Map(
    categories.flatMap((c) => c.topics).map((t) => [t.slug, t]),
  );
  return path.topics
    .map((slug) => topics.get(slug))
    .filter((topic): topic is TopicSummary => !!topic && topic.lessonCount > 0);
}
export const levelName = (level: string) =>
  ({
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
  })[level] ?? level;
export const progressPercent = (done: number, total: number) =>
  total ? Math.min(100, Math.round((done / total) * 100)) : 0;
export const topicState = (done: number, total: number) =>
  total > 0 && done >= total
    ? "Complete"
    : done > 0
      ? "In progress"
      : total === 0
        ? "No lessons yet"
        : "Not started";

export const learningStages = [
  { key: "STARTER", name: "Starter", description: "Build the foundations, learn the vocabulary, and follow your first worked examples.", readiness: "Move on when you can explain the basics and complete a small task without following every step." },
  { key: "INTERMEDIATE", name: "Intermediate", description: "Connect the ideas, solve practical problems, and build with more independence.", readiness: "Move on when you can build a working example, test edge cases, and explain your choices." },
  { key: "ADVANCED", name: "Advanced", description: "Explore production concerns, failure modes, performance, and engineering trade-offs.", readiness: "Try a deep dive when you want to investigate the internals behind a specific problem." },
  { key: "DEEP_DIVE", name: "Deep Dive", description: "Optional specialist study: internals, unusual edge cases, and deeper investigations. Choose it when it supports your interests or work.", readiness: "This level is optional. Finishing the core path does not require these lessons." },
] as const;
export function lessonStage(lesson: Pick<LessonSummary, "stage">): LearningStage {
  return learningStages.some(stage => stage.key === lesson.stage) ? lesson.stage! : "STARTER";
}
export function stageName(stage?: LearningStage): string {
  return learningStages.find(item => item.key === stage)?.name ?? "Starter";
}
export function orderedLessons(lessons: LessonSummary[]): LessonSummary[] {
  const rank = (lesson: LessonSummary) => learningStages.findIndex(stage => stage.key === lessonStage(lesson));
  return [...lessons].sort((a, b) => rank(a) - rank(b) || a.stepNumber - b.stepNumber || a.id - b.id);
}
export function groupedLessons(lessons: LessonSummary[]) {
  const ordered = orderedLessons(lessons);
  return learningStages.map(stage => ({ ...stage, lessons: ordered.filter(lesson => lessonStage(lesson) === stage.key) }));
}
