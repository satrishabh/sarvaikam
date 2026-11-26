import { useEffect, useState } from "react";
import { api } from "../api";
import { QuickCheckQuestion, quickCheckScore } from "../quickCheck";
import Icon from "./Icon";

/** A short self-check at the end of a lesson. Practice only: it never changes completion. */
export default function QuickCheck({ topicSlug, lessonSlug }: { topicSlug: string; lessonSlug: string }) {
  const [questions, setQuestions] = useState<QuickCheckQuestion[]>([]);
  const [chosen, setChosen] = useState<(number | undefined)[]>([]);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let active = true;
    setQuestions([]);
    setChosen([]);
    setChecked(false);
    api
      .quickCheck(topicSlug, lessonSlug)
      .then((data) => {
        if (active) setQuestions(data);
      })
      .catch(() => {}); // no quick check is shown; the lesson still works
    return () => {
      active = false;
    };
  }, [topicSlug, lessonSlug]);
  if (!questions.length) return null;
  const score = quickCheckScore(questions, chosen);
  const allAnswered = questions.every((_, i) => chosen[i] !== undefined);
  const choose = (question: number, option: number) =>
    setChosen((current) => {
      const next = [...current];
      next[question] = option;
      return next;
    });
  return (
    <section aria-labelledby="quick-check" className="mt-10 rounded-2xl border border-line bg-surface p-6">
      <p className="text-sm font-medium text-muted">
        {questions.length} questions · about a minute
      </p>
      <h2 id="quick-check" className="mt-2 text-xl font-semibold">
        Quick check
      </h2>
      <form
        className="mt-5 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          setChecked(true);
        }}
      >
        {questions.map((q, qi) => (
          <fieldset key={q.question} className="space-y-2">
            <legend className="mb-2 font-medium">
              {qi + 1}. {q.question}
            </legend>
            {q.options.map((option, oi) => {
              const right = checked && oi === q.answer;
              const wrong = checked && chosen[qi] === oi && oi !== q.answer;
              return (
                <label
                  key={option}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${right ? "border-accent bg-accent-soft" : wrong ? "border-danger/40 bg-danger/5" : "border-line"}`}
                >
                  <input
                    type="radio"
                    className="mt-1"
                    name={`quick-check-${qi}`}
                    checked={chosen[qi] === oi}
                    disabled={checked}
                    onChange={() => choose(qi, oi)}
                  />
                  <span className="flex-1">{option}</span>
                  {right && <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />}
                  {(right || wrong) && (
                    <span className="sr-only">{right ? "Correct answer" : "Your answer, incorrect"}</span>
                  )}
                </label>
              );
            })}
            {checked && <p className="text-sm text-muted">{q.explain}</p>}
          </fieldset>
        ))}
        <p role="status" className="text-sm font-medium">
          {checked
            ? score === questions.length
              ? `All ${score} right. Mark the lesson complete when you’re ready.`
              : `${score} of ${questions.length} right. Reread the parts you missed, then try again.`
            : ""}
        </p>
        {checked ? (
          <button
            type="button"
            className="outline-btn"
            onClick={() => {
              setChosen([]);
              setChecked(false);
            }}
          >
            Try again
          </button>
        ) : (
          <button type="submit" className="btn" disabled={!allAnswered}>
            Check answers
          </button>
        )}
      </form>
    </section>
  );
}
