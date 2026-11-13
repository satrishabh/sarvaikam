import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import {
  LoadState,
  ProgressBar,
  SectionHeading,
} from "../components/LearningUI";
import { useSkills } from "../components/SkillMap";
import { usePracticeQuestions } from "../usePracticeQuestions";
import useCatalogue from "../useCatalogue";

const details: Record<
  string,
  { icon: string; area: string; question: string; outcome: string }
> = {
  "coding-interviews": {
    icon: "code",
    area: "PROBLEM SOLVING",
    question: "pair-sum",
    outcome: "Clarify, solve, test, and explain complexity.",
  },
  "system-design-interviews": {
    icon: "layers",
    area: "SYSTEMS THINKING",
    question: "url-shortener",
    outcome: "Turn requirements into a design with clear trade-offs.",
  },
  "sql-interviews": {
    icon: "chart",
    area: "DATA & QUERIES",
    question: "top-customers",
    outcome: "Reason about data grain, queries, and edge cases.",
  },
  "behavioral-interviews": {
    icon: "user",
    area: "PEOPLE & STORIES",
    question: "difficult-feedback",
    outcome: "Build specific, honest stories about your work.",
  },
  "devops-cloud-interviews": {
    icon: "cloud",
    area: "RELIABILITY & DELIVERY",
    question: "failed-deployment",
    outcome: "Explain safe delivery and production decisions.",
  },
};
const warmup = [
  {
    title: "Tell your story",
    detail:
      "Choose a real example of feedback. Explain the context, your actions, and what changed.",
    question: "difficult-feedback",
  },
  {
    title: "Solve, then explain",
    detail:
      "Work through a pair-sum problem. Test duplicates and a missing pair.",
    question: "pair-sum",
  },
  {
    title: "Design a small system",
    detail: "Clarify a URL shortener’s requirements before sketching a design.",
    question: "url-shortener",
  },
  {
    title: "Think in data",
    detail:
      "Build a monthly aggregation, then rank the results. Explain your tie policy.",
    question: "top-customers",
  },
  {
    title: "Reason under pressure",
    detail: "Walk through a failed deployment, from mitigation to follow-up.",
    question: "failed-deployment",
  },
  {
    title: "Try a harder variation",
    detail:
      "Merge intervals. State your boundary assumptions and test a nested case.",
    question: "merge-intervals",
  },
  {
    title: "Return to the difficult bit",
    detail:
      "Repeat an exercise, compare your reasoning, and choose one next improvement.",
    question: "notification-system",
  },
];
export default function InterviewPrepPage() {
  const { questions: practiceQuestions } = usePracticeQuestions();
  const { categories, error, retry } = useCatalogue();
  const { skills, signedIn, progressLoading, progressError } = useSkills(
    categories ?? [],
  );
  const [day, setDay] = useState(0);
  const category = categories?.find((c) => c.slug === "interview-preparation");
  const skill = skills.find((c) => c.slug === "interview-preparation");
  const total = category?.topics.reduce((n, t) => n + t.lessonCount, 0) ?? 0;
  const selected = warmup[day];
  return (
    <div className="page-stack">
      <section className="interview-intro grid overflow-hidden rounded-[24px] border border-line bg-surface lg:grid-cols-[1.1fr_.9fr]">
        <div className="p-7 sm:p-12">
          <p className="eyebrow">THE INTERVIEW WORKSHOP</p>
          <h1 className="mt-5 text-[clamp(2.4rem,5vw,3.8rem)] font-semibold leading-[1.08] tracking-tightest">
            Know your stuff.
            <br />
            <span className="text-accent">Show your thinking.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Build the understanding behind a strong answer. Then practise saying
            it, solving it, and defending your choices.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/practice" className="btn">
              Start a practice session
              <Icon name="play" className="h-4 w-4" />
            </Link>
            <a href="#tracks" className="outline-btn">
              Explore prep tracks
            </a>
          </div>
          <p className="mt-6 text-xs text-muted">
            {practiceQuestions.length} practice exercises ·{" "}
            {categories
              ? `${total} published prep lessons`
              : "Guided prep lessons"}{" "}
            · Self-paced
          </p>
        </div>
        <div className="soft-panel hidden p-7 text-ink sm:p-10 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-accent">
            A USEFUL PRACTICE LOOP
          </p>
          <ol className="mt-7 space-y-6">
            {[
              [
                "01",
                "Learn the pattern",
                "Read a lesson and work through its examples.",
              ],
              [
                "02",
                "Try it without notes",
                "Use a timed prompt to make your thinking visible.",
              ],
              [
                "03",
                "Review, then repeat",
                "Use the checklist to decide what to improve.",
              ],
            ].map(([n, title, copy]) => (
              <li className="flex gap-4" key={n}>
                <span className="font-mono text-xs text-accent">{n}</span>
                <div>
                  <h2 className="text-lg font-semibold text-ink">{title}</h2>
                  <p className="mt-1 text-sm text-muted">{copy}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-muted">
            Practice is a place to find your gaps. Lesson completion and
            self-review are not an interview score.
          </p>
        </div>
      </section>
      <section id="tracks">
        <SectionHeading
          kicker="FIVE WAYS TO GET SHARPER"
          title="Choose the conversation you’re preparing for."
          description="Study the foundations in each track, then try a related exercise in the practice room."
        />
        {!categories ? (
          <LoadState error={error} retry={retry} />
        ) : !category ? (
          <div className="surface p-7">
            <h3 className="text-xl font-semibold">
              Prep lessons haven’t been published yet.
            </h3>
            <p className="mt-2 text-muted">
              You can still use the practice room while new lessons are being
              added.
            </p>
            <Link to="/practice" className="btn mt-5">
              Open practice room
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Object.keys(details)
              .map((slug) => category.topics.find((t) => t.slug === slug))
              .filter((t) => !!t)
              .map((topic) => {
                const detail = details[topic.slug];
                const done =
                  skill?.topics.find((t) => t.slug === topic.slug)?.done ?? 0;
                return (
                  <article
                    key={topic.slug}
                    className="surface flex flex-col p-6"
                  >
                    <div className="flex items-center justify-between">
                      <span className="icon-tile">
                        <Icon name={detail.icon} className="h-6 w-6" />
                      </span>
                      <span className="text-xs text-muted">
                        {topic.lessonCount} lessons
                      </span>
                    </div>
                    <p className="mt-6 text-[10px] font-semibold tracking-[.16em] text-muted">
                      {detail.area}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">{topic.name}</h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                      {detail.outcome}
                    </p>
                    {signedIn && !progressLoading && !progressError && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs text-muted">
                          {done}/{topic.lessonCount} lessons complete
                        </p>
                        <ProgressBar
                          done={done}
                          total={topic.lessonCount}
                          label={`${topic.name} lesson progress`}
                        />
                      </div>
                    )}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                      <Link
                        className="link inline-flex min-h-11 items-center gap-2 text-sm"
                        to={`/topics/${topic.slug}`}
                      >
                        Study this track
                        <Icon name="arrow" className="h-4 w-4" />
                      </Link>
                      <Link
                        className="btn-quiet px-3 text-xs"
                        to={`/practice?question=${detail.question}`}
                      >
                        Try an exercise
                      </Link>
                    </div>
                  </article>
                );
              })}
            <Link
              to="/practice"
              className="soft-panel flex flex-col items-start justify-between rounded-2xl p-7 text-ink"
            >
              <Icon name="target" className="h-8 w-8 text-accent" />
              <div className="mt-8">
                <h3 className="text-2xl font-semibold text-ink">
                  Less scrolling.
                  <br />
                  More deliberate practice.
                </h3>
                <p className="mt-3 text-sm text-muted">
                  Pick a prompt, set a timer, and see how your reasoning holds
                  up.
                </p>
              </div>
              <span className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent">
                Enter the practice room
                <Icon name="arrow" className="h-4 w-4" />
              </span>
            </Link>
          </div>
        )}
      </section>
      <section>
        <SectionHeading
          kicker="A SUGGESTED 7-SESSION WARM-UP"
          title="Build a rhythm that fits your week."
          description="Use these as seven sessions, not a deadline. Repeat or skip a session to match your goals."
        />
        <div className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[300px_1fr]">
          <div
            className="border-b border-line p-4 md:border-b-0 md:border-r"
            role="group"
            aria-label="Choose a warm-up session"
          >
            {warmup.map((item, i) => (
              <button
                key={item.title}
                aria-pressed={day === i}
                className={`flex min-h-14 w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-sm ${day === i ? "bg-accent-soft font-semibold text-accent-strong" : "text-muted hover:bg-canvas"}`}
                onClick={() => setDay(i)}
              >
                <span className="font-mono text-xs">0{i + 1}</span>
                {item.title}
              </button>
            ))}
          </div>
          <div
            className="flex flex-col justify-center p-7 sm:p-10"
            aria-live="polite"
          >
            <span className="eyebrow">SESSION 0{day + 1}</span>
            <h3 className="mt-4 text-3xl font-semibold tracking-tightest">
              {selected.title}
            </h3>
            <p className="mt-4 max-w-lg text-muted">{selected.detail}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "State your assumptions before answering.",
                "Work through one concrete example.",
                "Choose one thing to improve after reviewing.",
              ].map((text) => (
                <li className="flex items-start gap-2" key={text}>
                  <Icon name="check" className="mt-0.5 h-4 w-4 text-accent" />
                  {text}
                </li>
              ))}
            </ul>
            <Link
              className="btn mt-7 self-start"
              to={`/practice?question=${selected.question}`}
            >
              Try this session
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-7 rounded-2xl bg-accent-soft p-7 sm:p-9">
        <div className="max-w-2xl">
          <p className="eyebrow">BUILD THE KNOWLEDGE BEHIND THE ANSWER</p>
          <h2 className="mt-3 text-2xl font-semibold">
            Need to revisit the foundations?
          </h2>
          <p className="mt-2 text-sm text-muted">
            Follow a backend, full-stack, or cloud path before returning to
            interview practice.
          </p>
        </div>
        <Link className="outline-btn" to="/paths">
          Explore learning paths
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
