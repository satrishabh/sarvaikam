import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import AdminPage from './pages/AdminPage';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import LoginPage from './pages/LoginPage';
import SkillsPage from './pages/SkillsPage';
import TopicPage from './pages/TopicPage';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-[15px] transition-colors ${isActive ? 'bg-track font-medium text-ink' : 'text-muted hover:text-ink'}`;

export default function App() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      {/* The only translucent surface: chrome defers to content. */}
      <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
        <nav className="mx-auto flex h-16 max-w-[1080px] items-center gap-2 px-5">
          <Link to="/" className="mr-2 flex shrink-0 items-center gap-2.5 rounded-lg sm:mr-4">
            <img src="/logo-mark.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="hidden font-display text-[19px] font-semibold tracking-tight sm:inline">Sarvaikam</span>
          </Link>
          <NavLink to="/" end className={navClass}>Explore</NavLink>
          <NavLink to="/skills" className={navClass}>Skill map</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-[15px] text-muted sm:inline">{user.name}</span>
                <button className="btn-quiet" onClick={logout}>Sign out</button>
              </>
            ) : (
              <Link to="/login" className="btn">Sign in</Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-12 sm:py-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/topics/:topicSlug" element={<TopicPage />} />
          <Route path="/topics/:topicSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={
            <div className="py-24 text-center">
              <h1 className="text-4xl font-semibold">This page doesn't exist</h1>
              <Link to="/" className="link mt-4 inline-block">Go to Explore</Link>
            </div>
          } />
        </Routes>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1080px] items-center gap-3 px-5 py-8 text-[14px] text-muted">
          <img src="/logo-mark.png" alt="" className="h-5 w-5 rounded" />
          Sarvaikam. Learn one step at a time.
        </div>
      </footer>
    </div>
  );
}
