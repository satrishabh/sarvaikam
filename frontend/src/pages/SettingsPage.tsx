import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import ReaderSettings from "../components/ReaderSettings";
import useReaderPreferences from "../useReaderPreferences";

const shortcuts: [string, string][] = [
  ["→ or ↑", "Next section in the swipe deck"],
  ["← or ↓", "Previous section in the swipe deck"],
  ["Esc", "Close the swipe deck or a panel"],
  ["Tab", "Move between controls"],
];

export default function SettingsPage() {
  const { user, logout, logoutEverywhere } = useAuth();
  const { preferences, theme, saved, syncFailed, change } = useReaderPreferences();
  const navigate = useNavigate();
  const [everywhere, setEverywhere] = useState<"idle" | "busy" | "failed">("idle");
  const signOut = () => {
    navigate("/", { replace: true });
    void logout();
  };
  const signOutEverywhere = async () => {
    if (!window.confirm("Sign out on every device, including this one?")) return;
    setEverywhere("busy");
    try {
      await logoutEverywhere();
      navigate("/", { replace: true });
    } catch {
      setEverywhere("failed");
    }
  };

  const joinedDate = (() => {
    if (!user?.createdAt) return null;
    const date = new Date(user.createdAt);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  })();

  return (
    <div className="page-stack">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold">Reading, shortcuts and account</h1>
        <p className="mt-2 text-muted">Changes apply straight away and follow your account when you are signed in.</p>
      </header>

      <section className="surface p-6" aria-labelledby="settings-reading">
        <h2 id="settings-reading" className="text-xl font-semibold">Reading and appearance</h2>
        <div className="mt-5">
          <ReaderSettings
            value={{ ...preferences, theme }}
            onChange={change}
            saved={saved}
            signedIn={!!user}
            syncFailed={syncFailed}
          />
        </div>
      </section>

      <section className="surface p-6" aria-labelledby="settings-shortcuts">
        <h2 id="settings-shortcuts" className="text-xl font-semibold">Keyboard shortcuts</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          {shortcuts.map(([keys, action]) => (
            <div key={keys} className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-0">
              <dt>
                <kbd className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-xs">{keys}</kbd>
              </dt>
              <dd className="text-right text-muted">{action}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="surface p-6" aria-labelledby="settings-account">
        <h2 id="settings-account" className="text-xl font-semibold">Account</h2>
        {user ? (
          <>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Name</dt>
                <dd>{user.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Member since</dt>
                <dd>{joinedDate ?? "Not available"}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/profile" className="outline-btn">Manage profile</Link>
              <button className="outline-btn" onClick={signOut}>
                Sign out
              </button>
              <button
                className="btn-quiet"
                onClick={() => void signOutEverywhere()}
                disabled={everywhere === "busy"}
              >
                {everywhere === "busy" ? "Signing out everywhere…" : "Sign out of all devices"}
              </button>
            </div>
            <p className="mt-3 text-sm text-muted">
              Signing out removes this account's practice notes, reading history, and daily goal from this browser.
              Your progress stays saved to your account.
            </p>
            {everywhere === "failed" && (
              <p role="alert" className="mt-3 text-sm text-danger">
                Other devices could not be signed out right now. You are still signed in here; try again shortly.
              </p>
            )}
          </>
        ) : (
          <div className="mt-4">
            <p className="text-muted">Sign in to sync your settings and progress across devices.</p>
            <Link to="/login" className="btn mt-4">Sign in or register</Link>
          </div>
        )}
      </section>
    </div>
  );
}
