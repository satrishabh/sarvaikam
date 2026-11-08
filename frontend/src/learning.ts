import { Category, TopicSummary } from "./api";

export const learningPaths = [
  {
    slug: "backend",
    name: "Backend engineer",
    subtitle: "Build services that hold up.",
    icon: "layers",
    tone: "teal",
    description:
      "Connect language fundamentals, APIs, data, and distributed systems. Then practise explaining your decisions.",
    topics: [
      "java",
      "spring-boot",
      "databases-sql",
      "redis",
      "microservices",
      "system-design-interviews",
    ],
    outcomes: [
      "Build and reason about APIs",
      "Choose data and caching strategies",
      "Explain system trade-offs",
    ],
  },
  {
    slug: "full-stack",
    name: "Full-stack foundations",
    subtitle: "Start with the application core.",
    icon: "code",
    tone: "violet",
    description:
      "Start with server-side foundations: TypeScript, Node.js, storage, and delivery. Frontend lessons can be added as the catalogue grows.",
    topics: [
      "nodejs",
      "typescript-nestjs",
      "databases-sql",
      "docker",
      "coding-interviews",
      "behavioral-interviews",
    ],
    outcomes: [
      "Understand service boundaries",
      "Work with typed application code",
      "Solve and communicate clearly",
    ],
  },
  {
    slug: "cloud",
    name: "Cloud & platform engineer",
    subtitle: "Make reliable delivery a skill.",
    icon: "cloud",
    tone: "blue",
    description:
      "Follow infrastructure from containers to orchestration, cloud, automation, and operating production systems.",
    topics: [
      "docker",
      "kubernetes",
      "terraform",
      "aws",
      "ci-cd",
      "observability",
      "devops-cloud-interviews",
    ],
    outcomes: [
      "Understand delivery pipelines",
      "Design repeatable infrastructure",
      "Talk through production incidents",
    ],
  },
] as const;
export type LearningPath = (typeof learningPaths)[number];
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
