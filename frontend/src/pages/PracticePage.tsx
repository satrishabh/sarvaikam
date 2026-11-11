import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import { PracticeQuestion, practiceQuestions } from "../practice";

function Session({
  question,
  owner,
}: {
  question: PracticeQuestion;
  owner: string;
}) {
  const key = `sarvaikam.practice.v1.${owner}.${question.id}`;
  const [notes, setNotes] = useState(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });
  const [saved, setSaved] = useState(false);
  const [minutes, setMinutes] = useState(question.minutes);
  const [remaining, setRemaining] = useState(question.minutes * 60);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [hint, setHint] = useState(0);
  const [review, setReview] = useState(false);
  const [checks, setChecks] = useState<number[]>([]);
  const [reflection, setReflection] = useState("");
  const [summary, setSummary] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"prompt" | "answer">("prompt");
  useEffect(() => {
    try {
      localStorage.setItem(key, notes);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [key, notes]);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setDeadline(null);
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const toggleTimer = () => {
    if (deadline) {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setDeadline(null);
    } else {
      setDeadline(Date.now() + (remaining || minutes * 60) * 1000);
      setStarted(true);
    }
  };
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.05fr]">
      <div
        className="practice-switch lg:hidden"
        role="group"
        aria-label="Practice view"
      >
        <button
          aria-pressed={mobilePanel === "prompt"}
          onClick={() => setMobilePanel("prompt")}
        >
          Question & hints
        </button>
        <button
          aria-pressed={mobilePanel === "answer"}
          onClick={() => setMobilePanel("answer")}
        >
          Answer & review
        </button>
      </div>
      <section
        className={`practice-prompt surface p-6 sm:p-8 ${mobilePanel === "prompt" ? "" : "hidden lg:block"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="topic-tag">{question.category}</span>
          <span className="topic-tag">{question.difficulty}</span>
          <span className="ml-auto text-xs text-muted">
            {question.minutes}-minute suggestion
          </span>
        </div>
        <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tightest">
          {question.title}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted">
          {question.prompt}
        </p>
        <h3 className="mt-7 text-xs font-semibold uppercase tracking-widest text-muted">
          Clarify before you solve
        </h3>
        <ul className="mt-4 space-y-3">
          {question.constraints.map((item) => (
            <li key={item} className="flex gap-3 text-sm">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-7 border-t border-line pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Need a nudge?</h3>
            <button
              className="outline-btn text-xs"
              onClick={() =>
                setHint((n) => Math.min(n + 1, question.hints.length))
              }
              disabled={hint >= question.hints.length}
            >
              {hint >= question.hints.length
                ? "All hints shown"
                : `Show hint ${hint + 1}`}
            </button>
          </div>
          <div aria-live="polite">
            {question.hints.slice(0, hint).map((item, i) => (
              <p
                key={item}
                className="mt-3 rounded-xl bg-accent-soft p-4 text-sm"
              >
                <span className="font-semibold">Hint {i + 1}. </span>
                {item}
              </p>
            ))}
          </div>
        </div>
        <Link
          className="link mt-6 inline-flex min-h-11 items-center gap-2 text-sm"
          to={`/topics/${question.topic}`}
        >
          Review the related lessons
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
        <button
          className="btn mt-5 w-full lg:hidden"
          onClick={() => {
            setMobilePanel("answer");
            requestAnimationFrame(() =>
              document
                .getElementById("practice-answer")
                ?.scrollIntoView({ block: "start" }),
            );
          }}
        >
          Write your answer
        </button>
      </section>
      <div
        id="practice-answer"
        className={`practice-answer space-y-5 ${mobilePanel === "answer" ? "" : "hidden lg:block"}`}
      >
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-canvas p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                YOUR PRACTICE TIMER
              </p>
              <p
                role="timer"
                aria-label="Time remaining"
                className={`mt-1 font-mono text-3xl font-medium tabular-nums ${remaining === 0 ? "text-danger" : ""}`}
              >
                {clock}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label>
                <span className="sr-only">Session length</span>
                <select
                  className="input w-24 text-sm"
                  value={minutes}
                  disabled={started}
                  onChange={(e) => {
                    setMinutes(Number(e.target.value));
                    setRemaining(Number(e.target.value) * 60);
                  }}
                >
                  {[5, 10, 15, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} min
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn px-4"
                onClick={toggleTimer}
                disabled={review}
              >
                {deadline ? "Pause" : started ? "Resume" : "Start session"}
              </button>
              <button
                className="btn-quiet px-3 text-xs"
                onClick={() => {
                  setDeadline(null);
                  setRemaining(minutes * 60);
                  setStarted(false);
                }}
              >
                Reset timer
              </button>
            </div>
          </div>
          {remaining === 0 && (
            <p
              role="status"
              className="border-b border-line bg-gold-soft px-5 py-3 text-sm"
            >
              Time is up. You can keep writing or move to self-review.
            </p>
          )}
          <div className="p-5">
            <label htmlFor="practice-notes" className="text-sm font-semibold">
              Your reasoning, code, or answer
            </label>
            <p id="draft-help" className="mt-1 text-xs text-muted">
              Write notes here, or practise out loud. Avoid passwords and
              confidential information.
            </p>
            <textarea
              id="practice-notes"
              aria-describedby="draft-help draft-status"
              className="input mt-4 min-h-[300px] resize-y py-4 font-mono text-sm leading-relaxed"
              placeholder="Start with the questions you would ask. Then work through your approach…"
              value={notes}
              maxLength={40000}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
                setSummary(false);
              }}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p id="draft-status" className="text-[11px] text-muted">
                {saved
                  ? "Draft saved in this browser · not uploaded"
                  : "Draft is not saved yet"}{" "}
                · {notes.length.toLocaleString()}/40,000
              </p>
              <button
                className="min-h-11 px-2 text-xs text-muted hover:text-danger"
                onClick={() => {
                  if (
                    notes &&
                    window.confirm("Clear your saved notes for this question?")
                  )
                    setNotes("");
                }}
              >
                Clear notes
              </button>
            </div>
            <button
              className="btn mt-4 w-full"
              onClick={() => {
                setDeadline(null);
                setReview(true);
                setSummary(false);
              }}
            >
              Review my approach
              <Icon name="arrow" className="h-4 w-4" />
            </button>
          </div>
        </section>
        {review && (
          <section className="surface p-6" aria-labelledby="review-heading">
            <p className="eyebrow">REFLECT, THEN REFINE</p>
            <h2 id="review-heading" className="mt-2 text-2xl font-semibold">
              How did your approach hold up?
            </h2>
            <p className="mt-2 text-sm text-muted">
              This is self-review, not an automated grade. Tick only what you
              can demonstrate in your answer.
            </p>
            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">Self-review checklist</legend>
              {question.criteria.map((criterion, i) => (
                <label
                  key={criterion}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-canvas p-3 text-sm"
                >
                  <input
                    className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
                    type="checkbox"
                    checked={checks.includes(i)}
                    onChange={(e) => {
                      setChecks(
                        e.target.checked
                          ? [...checks, i]
                          : checks.filter((n) => n !== i),
                      );
                      setSummary(false);
                    }}
                  />
                  <span>{criterion}</span>
                </label>
              ))}
            </fieldset>
            <details className="mt-5 rounded-xl border border-line p-4">
              <summary className="cursor-pointer text-sm font-semibold text-accent">
                Compare with an approach outline
              </summary>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-muted">
                {question.outline.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </details>
            <label className="field mt-5">
              One thing to improve next time
              <input
                className="input"
                value={reflection}
                maxLength={300}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="For example: test the empty-input case first"
              />
            </label>
            <p className="mt-2 text-xs text-muted">
              This reflection stays on this page. Your answer draft is saved
              separately in this browser.
            </p>
            <button className="btn mt-5" onClick={() => setSummary(true)}>
              Finish self-review
            </button>
            {summary && (
              <div
                role="status"
                className="mt-5 rounded-xl bg-accent-soft p-4 text-sm"
              >
                <p className="font-semibold">
                  A useful session, with a next step.
                </p>
                <p className="mt-2">
                  You checked {checks.length} of {question.criteria.length}{" "}
                  review points.{" "}
                  {reflection
                    ? `Your next focus: ${reflection}`
                    : "Choose one unchecked point to work on next."}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Practice reviews do not change lesson completion or certify
                  interview readiness.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
export default function PracticePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get("question");
  const question =
    practiceQuestions.find((q) => q.id === requested) ?? practiceQuestions[0];
  const categories = [...new Set(practiceQuestions.map((q) => q.category))];
  const [category, setCategory] = useState(question.category);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    setCategory(question.category);
  }, [question.category]);
  return (
    <div className="practice-page space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <Link to="/interview-prep" className="link inline-flex items-center gap-1 text-xs">
            <Icon name="chevron" className="h-3 w-3 rotate-180" />
            Back to interview prep
          </Link>
          <h1 className="mt-3 hidden text-[clamp(2rem,5vw,3.3rem)] font-semibold leading-tight tracking-tightest lg:block">
            A little practice.
            <br />A clearer next attempt.
          </h1>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight lg:hidden">
            Practice room
          </h1>
          <p className="mt-4 hidden max-w-2xl text-muted lg:block">
            Choose a question, make your thinking visible, and reflect on what
            to improve. No microphone or camera is used.
          </p>
        </div>
        <span className="badge">
          {practiceQuestions.length} guided exercises
        </span>
      </header>
      <div>
        <button
          className="practice-picker-toggle lg:hidden"
          onClick={() => setPickerOpen((value) => !value)}
          aria-expanded={pickerOpen}
          aria-controls="exercise-picker"
        >
          <span>
            <span className="block text-xs text-muted">
              {question.category}
            </span>
            <span className="mt-1 block text-sm font-semibold">
              {question.title}
            </span>
          </span>
          <span className="ml-auto flex items-center gap-1 text-xs text-accent">
            Change
            <Icon name="chevron" className="h-4 w-4 rotate-90" />
          </span>
        </button>
        <section
          id="exercise-picker"
          aria-label="Choose a practice exercise"
          className={`surface gap-4 p-5 sm:grid-cols-[240px_1fr] ${pickerOpen ? "grid mt-3 lg:mt-0" : "hidden lg:grid"}`}
        >
          <label className="field">
            Practice area
            <select
              className="input"
              value={category}
              onChange={(e) => {
                const value = e.target.value;
                setCategory(value);
                const next = practiceQuestions.find(
                  (q) => q.category === value,
                )!;
                setParams({ question: next.id });
              }}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Question
            <select
              className="input"
              value={question.id}
              onChange={(e) => {
                setParams({ question: e.target.value });
                setPickerOpen(false);
              }}
            >
              {practiceQuestions
                .filter((q) => q.category === category)
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
            </select>
          </label>
        </section>
      </div>
      <Session
        key={`${user?.id ?? "guest"}-${question.id}`}
        question={question}
        owner={user?.id ?? "guest"}
      />
    </div>
  );
}
