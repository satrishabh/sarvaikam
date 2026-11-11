import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, can, type User } from "../api";
import { useAuth } from "../auth";

const statusCopy = {
  NONE: [
    "Business access",
    "Get exclusive learning content at no charge for your business.",
  ],
  PENDING: [
    "Your application is being reviewed",
    "You can keep learning while an administrator reviews your business details.",
  ],
  APPROVED: [
    "Your business is approved",
    "Your current role and permissions below show the access available to your account.",
  ],
  REJECTED: [
    "Your application needs an update",
    "Review the feedback below, update your details, and apply again.",
  ],
};
export function BusinessAccessPage() {
  const { user, ready, refreshUser } = useAuth();
  const [organization, setOrganization] = useState("");
  const [website, setWebsite] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (user) {
      setOrganization(user.organization);
      setWebsite(user.businessWebsite);
      setReason(user.businessReason);
    }
  }, [user?.id, user?.businessStatus]);
  if (!ready) return <p role="status">Loading your profile…</p>;
  if (!user)
    return (
      <div className="surface mx-auto max-w-lg p-8">
        <h1 className="text-3xl font-semibold">Your learning starts here.</h1>
        <p className="my-4 text-muted">
          Sign in to manage your profile and apply for business access.
        </p>
        <Link className="btn" to="/login?account=business">
          Sign in
        </Link>
      </div>
    );
  const [heading, description] =
    statusCopy[user.businessStatus] ?? statusCopy.NONE;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.applyBusiness({
        organization: organization.trim(),
        website: website.trim(),
        reason: reason.trim(),
      });
      await refreshUser();
      setNotice(
        "Application sent. Your learning account stays active while we review it.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not send your application",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/profile"
          className="link mb-4 inline-flex min-h-11 items-center"
        >
          Back to your profile
        </Link>
        <p className="eyebrow">BUSINESS ACCESS</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tightest">
          Business access.
        </h1>
        <p className="mt-2 text-muted">
          Free exclusive content for approved businesses. Your learning account
          stays active throughout.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <div className="hidden lg:block">
          <AccountSummary user={user} />
        </div>
        <section
          className="surface p-6 sm:p-8"
          aria-labelledby="business-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">BUSINESS MEMBERSHIP</p>
            <span className="badge">
              {user.businessStatus === "NONE"
                ? "Optional"
                : user.businessStatus.toLowerCase()}
            </span>
          </div>
          <h2 id="business-heading" className="mt-4 text-2xl font-semibold">
            {heading}
          </h2>
          <p className="mt-2 text-base text-muted">{description}</p>
          {user.reviewNote && (
            <div className="mt-5 rounded-xl bg-track p-4 text-base">
              <p className="font-medium">Review feedback</p>
              <p className="mt-1 whitespace-pre-wrap">{user.reviewNote}</p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-base text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 text-base text-accent">
              {notice}
            </p>
          )}
          {user.role === "USER" &&
          ["NONE", "REJECTED", "APPROVED"].includes(user.businessStatus) ? (
            <form className="mt-6 space-y-5" onSubmit={submit} aria-busy={busy}>
              <fieldset className="space-y-5" disabled={busy}>
                <label className="field">
                  Organization name
                  <input
                    className="input"
                    autoComplete="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </label>
                <label className="field">
                  Business website
                  <input
                    aria-label="Business website"
                    className="input"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    required
                    pattern="https://.+"
                    maxLength={500}
                    placeholder="https://your-business.com"
                    aria-describedby="website-help"
                  />
                  <span id="website-help" className="field-help">
                    Use your organization's public HTTPS website.
                  </span>
                </label>
                <label className="field">
                  How will your business use Sarvaikam?
                  <textarea
                    aria-label="How will your business use Sarvaikam?"
                    className="input min-h-32 py-3"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    minLength={20}
                    maxLength={2000}
                    aria-describedby="reason-help"
                  />
                  <span id="reason-help" className="field-help">
                    Share your learning goals and who will benefit. 20–2,000
                    characters.
                  </span>
                </label>
                <p className="text-sm text-muted">
                  An administrator will review these details. Business access is
                  free after approval. Your current access continues while your
                  application is pending.
                </p>
                <button className="btn" disabled={busy}>
                  {busy
                    ? "Sending application…"
                    : user.businessStatus === "REJECTED"
                      ? "Apply again"
                      : "Apply for business access"}
                </button>
              </fieldset>
            </form>
          ) : (
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-base">
                {user.role === "ADMIN"
                  ? "You have full administrator access."
                  : user.organization || "Your application details are saved."}
              </p>
              <Link
                className="link mt-4 inline-flex min-h-11 items-center"
                to="/"
              >
                Continue learning
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type SavedLesson = { title: string; href: string };

function SavedLessons() {
  const [lessons, setLessons] = useState<SavedLesson[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api
      .bookmarks()
      .then(async (bookmarks) => {
        const slugs = [...new Set(bookmarks.map((item) => item.topicSlug))];
        const topics = await Promise.allSettled(slugs.map((slug) => api.topic(slug)));
        const known = new Map<number, SavedLesson>();
        for (const result of topics) {
          if (result.status !== "fulfilled") continue;
          for (const lesson of result.value.lessons) {
            known.set(lesson.id, {
              title: lesson.title,
              href: `/topics/${result.value.slug}/${lesson.slug}`,
            });
          }
        }
        // Lessons that were removed from content are skipped rather than shown broken.
        const saved = bookmarks.flatMap((item) => known.get(item.lessonId) ?? []);
        if (active) setLessons(saved);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="soft-panel rounded-2xl p-6 sm:p-8" aria-labelledby="saved-heading">
      <h2 id="saved-heading" className="text-2xl font-semibold">
        Saved lessons
      </h2>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-accent-strong">
          Saved lessons could not be loaded: {error}
        </p>
      ) : lessons === null ? (
        <p className="mt-4 text-sm text-muted">Loading saved lessons…</p>
      ) : lessons.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Use “Save for later” on any lesson to find it here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {lessons.map((lesson) => (
            <li key={lesson.href}>
              <Link to={lesson.href} className="link block py-3 text-base">
                {lesson.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { user, ready } = useAuth();
  if (!ready) return <p role="status">Loading your profile…</p>;
  if (!user)
    return (
      <div className="surface mx-auto max-w-lg p-8">
        <h1 className="text-3xl font-semibold">Your learning starts here.</h1>
        <p className="my-4 text-muted">
          Sign in to see your account and learning access.
        </p>
        <Link className="btn" to="/login">
          Sign in
        </Link>
      </div>
    );
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tightest">
          Hello, {user.name.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-muted">
          Your profile and learning access, in one place.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <AccountSummary user={user} />

        <div className="space-y-6">
          <SavedLessons />
          <section className="soft-panel rounded-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">
              Make time for your next skill.
            </h2>
            <p className="mt-3 text-muted">
              Choose a learning path, revisit your lessons, or prepare for your
              next interview.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn" to="/paths">
                Explore learning paths
              </Link>
              <Link className="btn-quiet" to="/interview-prep">
                Prepare for interviews
              </Link>
            </div>
          </section>
          {user.role !== "ADMIN" && (
            <section
              className="surface p-6 sm:p-8"
              aria-labelledby="optional-business"
            >
              <p className="eyebrow">OPTIONAL BUSINESS ACCESS</p>
              <h2 id="optional-business" className="mt-3 text-xl font-semibold">
                Learning with your business?
              </h2>
              <p className="mt-2 text-muted">
                {user.businessStatus === "NONE"
                  ? "Apply for free access to exclusive content. You can continue learning with your current account."
                  : statusCopy[user.businessStatus][1]}
              </p>
              <Link
                className="link mt-4 inline-flex min-h-11 items-center"
                to="/profile/business"
              >
                {user.businessStatus === "NONE"
                  ? "Explore business access"
                  : "View business membership"}
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSummary({ user }: { user: User }) {
  return (
    <aside className="surface p-6">
      <div
        aria-hidden="true"
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-2xl font-semibold"
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
      <h2 className="break-words text-xl font-semibold">{user.name}</h2>
      <p className="break-all text-base text-muted">{user.email}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="badge">
          {user.role === "USER"
            ? "Normal user"
            : user.role === "BUSINESS"
              ? "Business"
              : "Admin"}
        </span>
        <span className="badge">Email verified</span>
      </div>
      <dl className="mt-6 border-t border-line pt-4 text-base">
        <dt className="text-muted">Member since</dt>
        <dd>
          {new Date(user.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </dd>
      </dl>
      <h3 className="mt-6 text-sm font-semibold">Your access</h3>
      <ul className="mt-2 space-y-2 text-sm text-muted">
        <li>Standard learning library</li>
        {can(user, "content.exclusive") && (
          <li>Exclusive content · no payment</li>
        )}
        {can(user, "assets.download") && <li>Learning resource downloads</li>}
        {can(user, "content.manage") && (
          <li>
            <Link to="/admin" className="link">
              Manage learning content
            </Link>
          </li>
        )}
        {can(user, "candidates.view") && (
          <li>
            <Link to="/admin/users" className="link">
              View candidates
            </Link>
          </li>
        )}
      </ul>
    </aside>
  );
}
