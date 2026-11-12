import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { can } from "./api";
import Icon from "./components/Icon";
import MobileSheet from "./components/MobileSheet";
import useScrollHidden from "./useScrollHidden";
import HomePage from "./pages/HomePage";
import LegalPage from "./pages/LegalPage";
const AdminPage = lazy(() => import("./pages/AdminPage"));
const InterviewPrepPage = lazy(() => import("./pages/InterviewPrepPage"));
const LessonPage = lazy(() => import("./pages/LessonPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const TopicPage = lazy(() => import("./pages/TopicPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const BusinessAccessPage = lazy(() =>
  import("./pages/ProfilePage").then((module) => ({
    default: module.BusinessAccessPage,
  })),
);
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PathsPage = lazy(() => import("./pages/PathsPage"));
const PracticePage = lazy(() => import("./pages/PracticePage"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));

const navigation = [
  { to: "/", name: "Overview", icon: "book" },
  { to: "/paths", name: "Learning paths", icon: "layers" },
  { to: "/reels", name: "Reels", icon: "play" },
  { to: "/interview-prep", name: "Interview prep", icon: "target" },
  { to: "/skills", name: "My skills", icon: "chart" },
];
export default function App() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const location = useLocation();
  const isReader = /^\/topics\/[^/]+\/[^/]+\/?$/.test(location.pathname);
  const isReels = location.pathname === "/reels";
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const barHidden = useScrollHidden();
  useEffect(() => {
    const viewport = window.visualViewport;
    const measure = () => {
      const editing = document.activeElement?.matches(
        'input, textarea, [contenteditable="true"]',
      );
      setKeyboardOpen(
        !!editing && !!viewport && window.innerHeight - viewport.height > 150,
      );
    };
    viewport?.addEventListener("resize", measure);
    document.addEventListener("focusin", measure);
    document.addEventListener("focusout", measure);
    const resize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
      measure();
    };
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", measure);
      document.removeEventListener("focusin", measure);
      document.removeEventListener("focusout", measure);
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    setOpen(false);
    const title =
      (
        {
          "/": "Learn. Build. Prepare.",
          "/paths": "Learning paths",
          "/reels": "Reels",
          "/skills": "Skill map",
          "/practice": "Practice room",
          "/interview-prep": "Interview prep",
          "/privacy": "Privacy",
          "/terms": "Terms",
          "/contact": "Contact",
          "/profile": "Your profile",
          "/profile/business": "Business access",
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
    <div
      className={`app-shell flex min-h-screen flex-col ${isReader ? "is-reader" : ""} ${isReels ? "is-reels" : ""}`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <header className="app-header sticky top-0 z-30 bg-surface/85 saturate-150 backdrop-blur-xl">
        <div className="app-header-inner mx-auto flex min-h-[76px] max-w-[1240px] items-center gap-5 px-5 sm:px-8">
          <Link
            to="/"
            aria-label="Sarvaikam home"
            className="mr-auto flex shrink-0 items-center gap-2.5 lg:mr-3"
          >
            <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="h-8 w-8 text-[#10231e]">
              <path d="M7 25 17 7l5 9-7 12H7Zm13 6 9-15 5 9-4 6H20Z" fill="currentColor" />
              <circle cx="30" cy="8" r="3" fill="currentColor" />
            </svg>
            <span className="flex items-baseline gap-1.5 text-xl font-semibold tracking-tight">
              Sarvaikam
              <span className="text-xs font-medium text-muted">Learn</span>
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden flex-1 flex-wrap items-center gap-1 lg:flex"
          >
            {links}
          </nav>
          <div className="flex items-center gap-2">
            {/* Desktop only: on small screens Settings lives in the More sheet. */}
            <NavLink to="/settings" className="workspace-nav hidden lg:inline-flex">
              Settings
            </NavLink>
            {user ? (
              <NavLink
                to="/profile"
                className="workspace-nav"
                aria-label="Your account"
              >
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
              className={`btn-quiet px-2 lg:hidden ${isReader ? "" : "hidden"}`}
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-haspopup="dialog"
              onClick={() => setOpen(!open)}
            >
              <Icon name={open ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>
      <MobileSheet
        id="mobile-nav"
        open={open}
        title="Your learning workspace"
        onClose={() => setOpen(false)}
      >
        <p className="mb-5 text-sm text-muted">
          {user
            ? `Signed in as ${user.name}`
            : "Learn at your pace. Sign in to save progress."}
        </p>
        <nav aria-label="Mobile navigation" className="grid gap-1">
          {links}
          <NavLink to="/practice" className="workspace-nav">
            <Icon name="play" className="h-4 w-4" />
            Practice room
          </NavLink>
          <NavLink to={user ? "/profile" : "/login"} className="workspace-nav">
            <Icon name="user" className="h-4 w-4" />
            {user ? "Your account & access" : "Sign in or register"}
          </NavLink>
          <NavLink to="/settings" className="workspace-nav">
            <Icon name="menu" className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
        <div className="mt-6 border-t border-line pt-5 text-sm">
          <p className="font-semibold">Learning details</p>
          <p className="mt-2 text-muted">
            Your lesson completion is saved to your account. Practice drafts
            stay in this browser.
          </p>
          {user && (
            <button
              className="outline-btn mt-5"
              onClick={() => {
                setOpen(false);
                void logout().catch((cause) => setLogoutError(cause.message));
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </MobileSheet>
      {logoutError && (
        <p role="alert" className="mx-auto px-5 pt-4 text-danger">
          {logoutError}
        </p>
      )}
      <main
        id="main-content"
        className="app-main mx-auto w-full max-w-[1240px] flex-1 px-5 py-9 sm:px-8 sm:py-12"
      >
        <Suspense
          fallback={
            <div role="status" className="space-y-5 py-8">
              <p className="text-sm text-muted">Loading your workspaceâ€¦</p>
              <div className="skeleton h-12 w-2/3" />
              <div className="skeleton h-48" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/paths" element={<PathsPage />} />
            <Route path="/reels" element={<ReelsPage />} />
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
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile/business" element={<BusinessAccessPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="/contact" element={<LegalPage kind="contact" />} />
            <Route
              path="*"
              element={
                <div className="py-24 text-center">
                  <p className="eyebrow">404 / A SMALL DETOUR</p>
                  <h1 className="mt-3 text-4xl font-semibold">
                    This page doesnâ€™t exist.
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
      {!isReader && !isReels && (
        <nav
          aria-label="Mobile primary navigation"
          className={`mobile-tabs ${keyboardOpen ? "keyboard-open" : ""} ${barHidden ? "is-hidden" : ""}`}
        >
          {/* Skills lives in the More sheet; Reels takes the slot Prep used to have. */}
          {[
            { to: "/", label: "Home", icon: "book" },
            { to: "/paths", label: "Paths", icon: "layers" },
            { to: "/reels", label: "Reels", icon: "play" },
            { to: "/interview-prep", label: "Prep", icon: "target" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={
                (
                  item.to === "/interview-prep"
                    ? location.pathname === item.to ||
                      location.pathname === "/practice"
                    : location.pathname === item.to
                )
                  ? "page"
                  : undefined
              }
            >
              <Icon name={item.icon} className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setOpen(true)}
            aria-label="More workspace options"
            aria-haspopup="dialog"
          >
            <Icon name="menu" className="h-5 w-5" />
            <span>More</span>
          </button>
        </nav>
      )}
      <footer className="app-footer mt-10 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-7 px-5 py-9 sm:px-8">
          <div>
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="h-6 w-6 text-[#10231e]">
                <path d="M7 25 17 7l5 9-7 12H7Zm13 6 9-15 5 9-4 6H20Z" fill="currentColor" />
                <circle cx="30" cy="8" r="3" fill="currentColor" />
              </svg>
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
            <Link className="hover:text-accent" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-accent" to="/terms">
              Terms
            </Link>
            <Link className="hover:text-accent" to="/contact">
              Contact
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

