import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { can } from "./api";
import Icon from "./components/Icon";
import HomePage from "./pages/HomePage";
const AdminPage = lazy(() => import("./pages/AdminPage"));
const InterviewPrepPage = lazy(() => import("./pages/InterviewPrepPage"));
const LessonPage = lazy(() => import("./pages/LessonPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const TopicPage = lazy(() => import("./pages/TopicPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PathsPage = lazy(() => import("./pages/PathsPage"));
const PracticePage = lazy(() => import("./pages/PracticePage"));

const navigation = [
  { to: "/", name: "Overview", icon: "book" },
  { to: "/paths", name: "Learning paths", icon: "layers" },
  { to: "/interview-prep", name: "Interview prep", icon: "target" },
  { to: "/skills", name: "My skills", icon: "chart" },
];
export default function App() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const location = useLocation();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        document
          .querySelector<HTMLButtonElement>('[aria-controls="mobile-nav"]')
          ?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  useEffect(() => {
    setOpen(false);
    const title =
      (
        {
          "/": "Learn. Build. Prepare.",
          "/paths": "Learning paths",
          "/skills": "Skill map",
          "/practice": "Practice room",
          "/interview-prep": "Interview prep",
          "/profile": "Your profile",
          "/login": "Sign in",
          "/admin": "Content studio",
          "/admin/users": "Profile management",
        } as Record<string, string>
      )[location.pathname] ?? "Learn";
    document.title = `${title} | Sarvaikam`;
    if (location.hash) {
      let target = location.hash.slice(1);
      try {
        target = decodeURIComponent(target);
      } catch {
        /* Keep malformed fragment text inert. */
      }
      const find = () => {
        const element = document.getElementById(target);
        if (element) {
          element.scrollIntoView();
          return true;
        }
        return false;
      };
      if (find()) return;
      const observer = new MutationObserver(() => {
        if (find()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = window.setTimeout(() => observer.disconnect(), 10_000);
      return () => {
        observer.disconnect();
        window.clearTimeout(timer);
      };
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  const links = (
    <>
      {navigation.map((item) => (
        <NavLink
          key={item.to}
          end={item.to === "/"}
          to={item.to}
          className="workspace-nav"
        >
          <Icon name={item.icon} className="h-4 w-4" />
          {item.name}
        </NavLink>
      ))}
      {can(user, "content.manage") && (
        <NavLink to="/admin" end className="workspace-nav">
          Content
        </NavLink>
      )}
      {can(user, "candidates.view") && (
        <NavLink to="/admin/users" className="workspace-nav">
          People
        </NavLink>
      )}
    </>
  );
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-[1240px] items-center gap-5 px-5 sm:px-8">
          <Link
            to="/"
            aria-label="Sarvaikam home"
            className="mr-auto flex shrink-0 items-center gap-2.5 lg:mr-3"
          >
            <img src="/logo-mark.png" alt="" className="h-9 w-9 rounded-xl" />
            <span className="text-xl font-semibold tracking-tight">
              Sarvaikam
              <span className="ml-2 hidden rounded border border-line px-1.5 py-0.5 align-middle text-[9px] font-medium tracking-[.12em] text-muted xl:inline">
                LEARN
              </span>
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden flex-1 flex-wrap items-center gap-1 lg:flex"
          >
            {links}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <NavLink to="/profile" className="workspace-nav">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline">My account</span>
              </NavLink>
            ) : (
              <Link to="/login" className="btn px-4">
                Sign in
              </Link>
            )}
            <button
              className="btn-quiet px-2 lg:hidden"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(!open)}
            >
              <Icon name={open ? "close" : "menu"} />
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            className="mx-auto grid max-w-[1240px] gap-1 border-t border-line px-5 py-4 lg:hidden"
          >
            {links}
            {user && (
              <button
                className="workspace-nav"
                onClick={() =>
                  void logout().catch((cause) => setLogoutError(cause.message))
                }
              >
                Sign out
              </button>
            )}
          </nav>
        )}
      </header>
      {logoutError && (
        <p role="alert" className="mx-auto px-5 pt-4 text-danger">
          {logoutError}
        </p>
      )}
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-9 sm:px-8 sm:py-12"
      >
        <Suspense
          fallback={
            <div role="status" className="space-y-5 py-8">
              <p className="text-sm text-muted">Loading your workspace…</p>
              <div className="skeleton h-12 w-2/3" />
              <div className="skeleton h-48" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/paths" element={<PathsPage />} />
            <Route path="/interview-prep" element={<InterviewPrepPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/topics/:topicSlug" element={<TopicPage />} />
            <Route
              path="/topics/:topicSlug/:lessonSlug"
              element={<LessonPage />}
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route
              path="*"
              element={
                <div className="py-24 text-center">
                  <p className="eyebrow">404 / A SMALL DETOUR</p>
                  <h1 className="mt-3 text-4xl font-semibold">
                    This page doesn’t exist.
                  </h1>
                  <Link className="btn mt-7" to="/">
                    Back to learning
                  </Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer className="mt-10 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-7 px-5 py-9 sm:px-8">
          <div>
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <img src="/logo-mark.png" alt="" className="h-6 w-6" />
              Sarvaikam
            </Link>
            <p className="mt-2 text-xs text-muted">
              Build understanding. Practise deliberately. Keep moving.
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted"
          >
            <Link className="hover:text-accent" to="/paths">
              Learning paths
            </Link>
            <Link className="hover:text-accent" to="/interview-prep">
              Interview prep
            </Link>
            <Link className="hover:text-accent" to="/practice">
              Practice room
            </Link>
            {user ? (
              <button
                onClick={() =>
                  void logout().catch((cause) => setLogoutError(cause.message))
                }
                className="hover:text-accent"
              >
                Sign out
              </button>
            ) : (
              <Link
                className="hover:text-accent"
                to="/login?mode=register&account=business"
              >
                For businesses
              </Link>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
