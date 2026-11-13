import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSkills } from "../components/SkillMap";
import SkillMap from "../components/SkillMap";
import Momentum from "../components/Momentum";
import Icon from "../components/Icon";
import {
  LoadState,
  PathCard,
  SectionHeading,
  TopicCard,
} from "../components/LearningUI";
import useLearningPaths from "../useLearningPaths";
import useCatalogue from "../useCatalogue";

export default function HomePage() {
  const { paths, error: pathsError, retry: retryPaths } = useLearningPaths();
  const { categories, error, retry } = useCatalogue();
  const {
    skills,
    signedIn,
    items,
    user,
    progressLoading,
    progressError,
    reloadProgress,
  } = useSkills(categories ?? []);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [visible, setVisible] = useState(9);
  const topics = useMemo(
    () =>
      (categories ?? [])
        .flatMap((c) => c.topics)
        .filter(
          (t) =>
            (subject === "all" || t.categorySlug === subject) &&
            `${t.name} ${t.summary}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        ),
    [categories, subject, query],
  );
  const allTopics = (categories ?? []).flatMap((c) => c.topics);
  const previewSkills = [...skills].sort((a, b) => {
    const focus = ["coding-interviews", "java", "databases-sql"];
    const rank = (topics: typeof a.topics) => {
      const index = focus.findIndex((slug) =>
        topics.some((t) => t.slug === slug),
      );
      return index < 0 ? focus.length : index;
    };
    return rank(a.topics) - rank(b.topics);
  });
  const lessonCount = allTopics.reduce((n, t) => n + t.lessonCount, 0);
  const doneByTopic = new Map(
    skills.flatMap((c) => c.topics).map((t) => [t.slug, t.done]),
  );
  return (
    <div className="page-stack">
      <section className="mobile-start lg:hidden">
        <p className="text-sm text-muted">
          {user
            ? `Welcome back, ${user.name.split(" ")[0]}.`
            : "Your engineering notebook"}
        </p>
        <h1 className="reveal mt-2 text-[clamp(1.9rem,7.5vw,2.6rem)] font-semibold leading-tight tracking-tightest">
          What will you learn next?
        </h1>
        <p className="reveal mt-3 text-base text-muted" style={{ animationDelay: "120ms" }}>
          {user
            ? "Build a skill, work through a lesson, or practise an interview question."
            : "Read it like a story. Swipe through each section. Explain it out loud until it sticks."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link to="/paths" className="btn px-3">
            Find a path
          </Link>
          <Link to="/practice" className="outline-btn px-3">
            Practice
          </Link>
        </div>
        <a href="#topics" className="mobile-search mt-5">
          <Icon name="search" />
          <span>Find a topic in the library</span>
          <Icon name="chevron" className="ml-auto h-4 w-4" />
        </a>
      </section>
      <section className="soft-panel relative isolate hidden overflow-hidden rounded-[24px] p-7 text-ink sm:p-12 lg:block lg:p-14">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />A WORKSPACE
              FOR YOUR NEXT CHAPTER
            </p>
            <h1 className="reveal mt-6 max-w-xl text-[clamp(2.6rem,5vw,4.5rem)] font-semibold leading-[1.06] tracking-tightest text-ink">
              Learn deeply.
              <br />
              Build confidently.
              <br />
              <span className="text-accent">Interview clearly.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
              Read it like a story. Swipe through each section. Explain it out
              loud until it sticks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn" to="/paths">
                Find your learning path
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium text-ink hover:bg-white/70"
                to="/practice"
              >
                Try a practice session
                <Icon name="play" className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-5 border-t border-line pt-5 text-xs text-muted">
              <span className="flex items-center gap-2">
                <Icon name="book" className="h-4 w-4" />
                {categories
                  ? `${lessonCount} guided lessons`
                  : "Guided lessons"}
              </span>
              <span className="flex items-center gap-2">
                <Icon name="target" className="h-4 w-4" />
                Interview practice
              </span>
              <span className="flex items-center gap-2">
                <Icon name="chart" className="h-4 w-4" />
                Saved progress
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[420px]">
            <div
              className="reveal rounded-2xl border border-line bg-white/90 p-5 shadow-lg shadow-ink/5 sm:p-7"
              style={{ animationDelay: "160ms" }}
            >
              <div className="flex items-center justify-between border-b border-line pb-5">
                <span className="text-xs font-medium text-muted">
                  YOUR ENGINEERING JOURNEY
                </span>
                <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] text-muted">
                  A suggested approach
                </span>
              </div>
              <ol className="mt-6 space-y-0">
                {[
                  {
                    icon: "book",
                    title: "Understand the foundations",
                    detail: "Languages, data, and how systems work",
                    tag: "01 / LEARN",
                  },
                  {
                    icon: "code",
                    title: "Put ideas into practice",
                    detail: "Work through examples and exercises",
                    tag: "02 / APPLY",
                  },
                  {
                    icon: "target",
                    title: "Explain your thinking",
                    detail: "Coding, design, SQL, and your stories",
                    tag: "03 / PREPARE",
                  },
                ].map((item, i) => (
                  <li
                    key={item.title}
                    className="relative flex gap-4 pb-8 last:pb-0"
                  >
                    {i < 2 && (
                      <span
                        aria-hidden
                        className="absolute left-5 top-11 h-[calc(100%-3rem)] w-px bg-line"
                      />
                    )}
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${i === 2 ? "bg-accent text-white" : "border border-line bg-white/70 text-accent"}`}
                    >
                      <Icon name={item.icon} className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[9px] font-semibold tracking-[.16em] text-muted">
                        {item.tag}
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-ink">
                        {item.title}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-7 flex items-center gap-3 rounded-xl border border-line bg-white/70 p-3">
                <Icon name="spark" className="h-5 w-5 text-accent" />
                <p className="text-xs text-muted">
                  You choose the pace. We make the next step clear.
                </p>
              </div>
            </div>
            <div
              className="reveal mt-5 rounded-2xl border border-line bg-white/90 p-5 shadow-lg shadow-ink/5"
              style={{ animationDelay: "320ms" }}
            >
              <p className="text-xs font-medium text-muted">TRY IT · SWIPE A LESSON</p>
              <div className="swipe-demo mt-4" aria-hidden>
                <div className="swipe-under" />
                <div className="swipe-card">
                  <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-accent">
                    Section 2 of 6
                  </p>
                  <p className="mt-2 text-base font-semibold text-ink">Your first configuration</p>
                  <div className="mt-4 space-y-2">
                    <span className="block h-2 w-full rounded bg-line" />
                    <span className="block h-2 w-5/6 rounded bg-line" />
                    <span className="block h-2 w-2/3 rounded bg-line" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted">
                Swipe right or up to continue. Every section becomes a card.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Link
        to="/topics/forward-deployed-engineer"
        className="surface group grid gap-5 p-6 transition-colors hover:border-accent/40 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
      >
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            New course
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Forward Deployed Engineering
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
            Discovery, prototypes, evaluation, production handoff and the trade-offs
            you will face with real customers. Eight lessons.
          </p>
        </div>
        <span className="btn w-fit">
          Start the course
          <Icon name="arrow" className="h-4 w-4" />
        </span>
      </Link>

      {user && !progressLoading && !progressError && (
        <Momentum items={items} name={user.name} />
      )}
      {progressError && (
        <div
          role="alert"
          className="surface flex flex-wrap items-center gap-4 p-5"
        >
          <p className="flex-1 text-sm text-muted">{progressError}</p>
          <button className="outline-btn" onClick={reloadProgress}>
            Reload progress
          </button>
        </div>
      )}

      <section>
        <SectionHeading
          kicker="A DIRECTION, NOT A GUESS"
          title="Start with where you want to go."
          description="Explore Gen AI, AI / ML, cloud platform, full stack, backend, and forward deployed engineering, in that priority order."
          action={
            <Link
              className="link inline-flex min-h-11 items-center gap-2 text-sm"
              to="/paths"
            >
              Explore the paths
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          }
        />
        {categories && paths ? (
          <div className="grid gap-5 md:grid-cols-3">
            {paths.map((path) => (
              <PathCard key={path.slug} path={path} categories={categories} />
            ))}
          </div>
        ) : (
          <LoadState error={error || pathsError} retry={() => { retry(); retryPaths(); }} />
        )}
      </section>

      <section className="grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[.9fr_1.1fr]">
        <div className="bg-accent-soft/50 p-7 sm:p-9">
          <p className="eyebrow">THE INTERVIEW WORKSHOP</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tightest">
            Good answers start
            <br />
            with better practice.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            Think through a problem, write an answer, and review your reasoning.
            A little structure makes each session count.
          </p>
          <Link to="/interview-prep" className="btn mt-6">
            Explore interview prep
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
        <div className="p-7 sm:p-9">
          <div className="flex items-center justify-between">
            <span className="topic-tag">SYSTEM DESIGN</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Icon name="clock" className="h-4 w-4" />
              20-minute exercise
            </span>
          </div>
          <h3 className="mt-5 text-2xl font-semibold">
            How would you design a URL shortener?
          </h3>
          <p className="mt-3 text-sm text-muted">
            Start with the requirements. Consider identifiers, storage,
            redirects, and the trade-offs you would make.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Clarify", "Design", "Review"].map((s, i) => (
              <span key={s} className="topic-tag">
                0{i + 1} · {s}
              </span>
            ))}
          </div>
          <Link
            to="/practice?question=url-shortener"
            className="link mt-6 inline-flex min-h-11 items-center gap-2 text-sm"
          >
            Open the practice room
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section>
        <SectionHeading
          kicker={
            signedIn
              ? "YOUR LEARNING, MADE VISIBLE"
              : "A CLEAR VIEW OF YOUR SKILLS"
          }
          title={
            signedIn
              ? "Your skill map. Your next step."
              : "A skill map with a next step."
          }
          description={
            signedIn
              ? "See which topics you’ve started, what you’ve finished, and where to go next."
              : "Explore each subject and its topics. Sign in when you’re ready to save your completed lessons."
          }
          action={
            <Link to="/skills" className="outline-btn text-sm">
              Open full skill map
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          }
        />
        {categories && !progressLoading && !progressError ? (
          <SkillMap skills={previewSkills} signedIn={signedIn} limit={3} />
        ) : progressError ? (
          <p className="surface p-6 text-sm text-muted">
            Reload your saved progress above to view your skill map accurately.
          </p>
        ) : (
          <p className="surface p-6 text-sm text-muted">Your skill map appears here once the library loads.</p>
        )}
      </section>

      <section id="topics">
        <SectionHeading
          kicker="THE LEARNING LIBRARY"
          title="Follow your curiosity."
          description="Find a specific technology or explore a new area. Every topic opens into an ordered lesson sequence."
        />
        <div className="surface mb-6 grid gap-4 p-4 sm:grid-cols-[1fr_240px]">
          <label className="relative block">
            <span className="sr-only">Search the learning library</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-3 h-5 w-5 text-muted"
            />
            <input
              type="search"
              className="input pl-11"
              placeholder="Search a technology or skill…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(9);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Filter by subject</span>
            <select
              className="input"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setVisible(9);
              }}
            >
              <option value="all">All subjects</option>
              {categories?.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {categories ? (
          <>
            <p role="status" className="mb-5 text-xs text-muted">
              {topics.length} {topics.length === 1 ? "topic" : "topics"}
              {query ? ` matching “${query}”` : " to explore"}
            </p>
            {topics.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topics.slice(0, visible).map((topic) => (
                  <TopicCard
                    key={topic.slug}
                    topic={topic}
                    done={doneByTopic.get(topic.slug)}
                    signedIn={signedIn && !progressLoading && !progressError}
                  />
                ))}
              </div>
            ) : (
              <div className="surface p-9 text-center">
                <h3 className="text-xl font-semibold">
                  No topics match this search.
                </h3>
                <p className="mt-2 text-muted">
                  Try another keyword or choose all subjects.
                </p>
                <button
                  className="outline-btn mt-5"
                  onClick={() => {
                    setQuery("");
                    setSubject("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {visible < topics.length && (
              <div className="mt-7 text-center">
                <button
                  className="outline-btn"
                  onClick={() => setVisible((n) => n + 9)}
                >
                  Show more topics
                  <Icon name="chevron" className="h-4 w-4 rotate-90" />
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="surface p-6 text-sm text-muted">Topics appear here once the library loads.</p>
        )}
      </section>
      <section className="flex flex-wrap items-center justify-between gap-7 rounded-2xl border border-line bg-accent-soft p-7 sm:p-9">
        <div>
          <p className="eyebrow">BETTER, TOGETHER</p>
          <h2 className="mt-2 text-2xl font-semibold">
            Build a learning habit across your team.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Approved businesses receive exclusive learning content at no charge.
            Apply from your profile.
          </p>
        </div>
        <Link
          to={
            user ? "/profile/business" : "/login?mode=register&account=business"
          }
          className="outline-btn"
        >
          Explore business access
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
