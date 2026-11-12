import type { Reel } from "./pages/ReelsPage";

// Temporary sample data for the reels page. Replace with the real catalogue when the content is ready.
export const mockReels: Reel[] = [
  {
    key: "mock/sealed-types",
    href: "/topics/java-records/sealed-types",
    topicName: "Java records",
    title: "Sealed types",
    step: 3,
    sentences: [
      "Sealed types limit which classes may extend them.",
      "The compiler knows every possible case, so a switch can be checked for completeness.",
    ],
  },
  {
    key: "mock/why-records",
    href: "/topics/java-records/why-records",
    topicName: "Java records",
    title: "Why records exist",
    step: 1,
    sentences: [
      "Records are immutable data carriers.",
      "They remove boilerplate for equals, hashCode and toString.",
      "Use them for data that should not change after it is created.",
    ],
  },
  {
    key: "mock/prompt-basics",
    href: "/topics/genai-prompting/prompt-basics",
    topicName: "Prompting",
    title: "Prompt basics",
    step: 2,
    sentences: [
      "A clear instruction, the context it needs and the output format matter most.",
      "Ask for the format you want, such as a list or JSON, instead of hoping for it.",
    ],
  },
  {
    key: "mock/streams-laziness",
    href: "/topics/java-streams/laziness",
    topicName: "Java streams",
    title: "Laziness",
    step: 2,
    sentences: [
      "Intermediate stream steps do nothing until a terminal operation runs.",
      "A short-circuit operation such as findFirst can stop the pipeline early.",
    ],
  },
];
