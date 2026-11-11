import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import {
  LoadState,
  ProgressBar,
  SectionHeading,
} from "../components/LearningUI";
import { useSkills } from "../components/SkillMap";
import { learningPaths, pathTopics, topicState } from "../learning";
import useCatalogue from "../useCatalogue";

export default function PathsPage() {
  const { categories, error, retry } = useCatalogue();
  const { skills, signedIn, progressError, progressLoading } = useSkills(
    categories ?? [],
  );
  const [focus, setFocus] = useState("");
  const doneByTopic = new Map(
    skills.flatMap((c) => c.topics).map((t) => [t.slug, t.done]),
  );
  return (
    <div className="page-stack">
      <header className="max-w-3xl">
        <p className="eyebrow">LEARNING PATHS / SOFTWARE ENGINEERING</p>
        <h1 className="mt-4 text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.1] tracking-tightest">
          Give your learning
          <br />a direction.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          A useful sequence, a clear outcome, and room to explore. Pick a role,
          follow the foundations, and bring your knowledge into interview
          practice.
        </p>
      </header>
      <nav
        aria-label="Choose a learning path"
        className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:scroll-px-0"
      >
        {learningPaths.map((path) => (
          <a key={path.slug} className="outline-btn shrink-0 snap-start whitespace-nowrap" href={`#${path.slug}`}>
            <Icon name={path.icon} className="h-4 w-4" />
            {path.name}
          </a>
        ))}
      </nav>
      {!categories && <LoadState error={error} retry={retry} />}
      {progressError && (
        <p role="alert" className="surface p-4 text-sm text-muted">
          {progressError}
        </p>
      )}
      {categories &&
        learningPaths.map((path, index) => {
          const topics = pathTopics(path, categories);
          const total = topics.reduce((n, t) => n + t.lessonCount, 0);
          const done = topics.reduce(
            (n, t) => n + (doneByTopic.get(t.slug) ?? 0),
            0,
          );
          const next = topics.find(
            (t) => (doneByTopic.get(t.slug) ?? 0) < t.lessonCount,
          );
          return (
            <section
              id={path.slug}
              key={path.slug}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <div className="grid lg:grid-cols-[.8fr_1.2fr]">
                <div
                  className={`tone-${path.tone} border-b border-line bg-canvas p-7 sm:p-9 lg:border-b-0 lg:border-r`}
                >
                  <div className="flex items-center gap-3">
                    <span className="icon-tile">
                      <Icon name={path.icon} className="h-6 w-6" />
                    </span>
                    <p className="eyebrow">PATH 0{index + 1}</p>
                  </div>
                  <h2 className="mt-6 text-3xl font-semibold leading-tight">
                    {path.name}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {path.description}
                  </p>
                  <h3 className="mt-7 text-xs font-semibold uppercase tracking-widest text-muted">
                    What you’ll work towards
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {path.outcomes.map((outcome) => (
                      <li
                        className="flex items-start gap-2 text-sm"
                        key={outcome}
                      >
                        <Icon
                          name="check"
                          className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                        />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-7 text-xs text-muted">
                    {topics.length} available {topics.length === 1 ? "topic" : "topics"} · {total} guided {total === 1 ? "lesson" : "lessons"}
                  </p>
                  {signedIn && !progressError && !progressLoading && (
                    <div className="mt-3">
                      <ProgressBar
                        done={done}
                        total={total}
                        label={`${path.name} lessons completed`}
                      />
                      <p className="mt-2 text-xs text-muted">
                        {done} of {total} lessons complete
                      </p>
                    </div>
                  )}
                  {next && (
                    <Link className="btn mt-6" to={`/topics/${next.slug}`}>
                      {done ? "Continue this path" : "Start this path"}
                      <Icon name="arrow" className="h-4 w-4" />
                    </Link>
                  )}
                  {!next && topics.length > 0 && (
                    <Link className="btn mt-6" to="/practice">
                      Put it into practice
                      <Icon name="arrow" className="h-4 w-4" />
                    </Link>
                  )}
                  <button
                    className="link mt-4 block min-h-11 text-sm"
                    onClick={() => setFocus(path.slug)}
                    aria-pressed={focus === path.slug}
                  >
                    {focus === path.slug
                      ? "Selected for this visit"
                      : "Highlight this path"}
                  </button>
                </div>
                <div className="p-7 sm:p-9">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Your learning sequence
                    </h3>
                    {focus === path.slug && (
                      <span className="badge">Your focus</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Start at the top or jump to a topic you need.
                  </p>
                  <ol className="mt-6 divide-y divide-line">
                    {topics.map((topic, i) => {
                      const complete =
                        (doneByTopic.get(topic.slug) ?? 0) >= topic.lessonCount;
                      return (
                        <li key={topic.slug}>
                          <Link
                            className="group flex items-center gap-4 py-4"
                            to={`/topics/${topic.slug}`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${complete && signedIn ? "border-accent bg-accent text-white" : "border-line bg-canvas text-muted"}`}
                            >
                              {complete && signedIn ? (
                                <Icon name="check" className="h-4 w-4" />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold group-hover:text-accent">
                                {topic.name}
                              </span>
                              <span className="mt-1 block text-xs text-muted">
                                {topic.lessonCount} lessons
                                {signedIn && !progressError && !progressLoading
                                  ? ` · ${topicState(doneByTopic.get(topic.slug) ?? 0, topic.lessonCount)}`
                                  : ""}
                              </span>
                            </span>
                            <Icon name="arrow" className="h-4 w-4 text-muted" />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                  {topics.length === 0 && (
                    <p className="mt-5 text-muted">
                      No lessons are published for this path yet. Explore the
                      library while content is added.
                    </p>
                  )}
                  <div className="mt-6 flex items-start gap-3 rounded-xl bg-accent-soft p-4">
                    <Icon
                      name="target"
                      className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                    />
                    <p className="text-xs leading-relaxed">
                      After each topic, explain one idea without your notes.
                      Then{" "}
                      <Link className="link" to="/practice">
                        try an interview exercise
                      </Link>{" "}
                      to find what needs another pass.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      <section>
        <SectionHeading
          kicker="YOUR PATH CAN CHANGE"
          title="Keep the foundations. Follow the questions."
          description="These paths organize the lessons already available. Completing them records learning activity; interview readiness comes from applying, reviewing, and explaining your work."
          action={
            <Link to="/#topics" className="outline-btn">
              Browse every topic
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          }
        />
      </section>
    </div>
  );
}
