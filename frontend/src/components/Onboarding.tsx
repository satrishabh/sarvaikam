import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Category } from "../api";
import { useAuth } from "../auth";
import { GOAL_OPTIONS, goalStore } from "../engagement";
import {
  followPath,
  LearningPath,
  needsOnboarding,
  pathTopics,
  readOnboardingSkipped,
  skipOnboarding,
} from "../learning";
import Icon from "./Icon";

/**
 * First-run card for a signed-in learner: choose a path and a daily goal, save both to the account, and start
 * the path's first topic. "Skip for now" hides it on this device; the account can still choose later.
 */
export default function Onboarding({
  paths,
  categories,
}: {
  paths: LearningPath[] | null;
  categories: Category[] | null;
}) {
  const { user, applyUser } = useAuth();
  const navigate = useNavigate();
  const [skipped, setSkipped] = useState(readOnboardingSkipped);
  const [path, setPath] = useState("");
  const [goal, setGoal] = useState<number>(goalStore.get);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!needsOnboarding(user, skipped) || !paths?.length || !categories) return null;
  const start = async () => {
    const chosen = paths.find((p) => p.slug === path);
    if (!chosen || !user) return;
    setSaving(true);
    setError("");
    try {
      applyUser(await api.updateLearningPreferences({ path: chosen.slug, dailyGoal: goal as 1 | 3 | 5 }));
      followPath(chosen.slug);
      goalStore.set(goal);
      const first = pathTopics(chosen, categories)[0];
      navigate(first ? `/topics/${first.slug}` : `/paths#${chosen.slug}`);
    } catch (cause) {
      setError((cause as Error).message || "Your choice could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section aria-labelledby="onboarding-title" className="rounded-2xl border border-accent/20 bg-accent-soft p-6 sm:p-8">
      <p className="text-sm font-medium text-accent-strong">Welcome, {user!.name.split(" ")[0]}</p>
      <h2 id="onboarding-title" className="mt-2 text-2xl font-semibold">
        Let’s set up your learning.
      </h2>
      <form
        className="mt-6 space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <fieldset>
          <legend className="font-medium">1. What do you want to learn?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((p) => (
              <label
                key={p.slug}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-surface p-4 text-sm ${path === p.slug ? "border-accent" : "border-line"}`}
              >
                <input
                  type="radio"
                  name="onboarding-path"
                  className="mt-1"
                  checked={path === p.slug}
                  onChange={() => setPath(p.slug)}
                />
                <span>
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon name={p.icon} className="h-4 w-4" />
                    {p.name}
                  </span>
                  <span className="mt-1 block text-muted">{p.subtitle}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="font-medium">2. How many lessons a day?</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {GOAL_OPTIONS.map((g) => (
              <label
                key={g}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border bg-surface px-4 text-sm ${goal === g ? "border-accent" : "border-line"}`}
              >
                <input type="radio" name="onboarding-goal" checked={goal === g} onChange={() => setGoal(g)} />
                {g} {g === 1 ? "lesson" : "lessons"}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn" disabled={!path || saving}>
            {saving ? "Saving…" : "Start learning"}
            <Icon name="arrow" className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              skipOnboarding(user!.id);
              setSkipped(user!.id);
            }}
          >
            Skip for now
          </button>
        </div>
      </form>
    </section>
  );
}
